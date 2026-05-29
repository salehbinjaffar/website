const crypto = require("crypto");
const { readSite, writeSite } = require("./store");

const SESSION_SECRET = process.env.NITV_SECRET || "news-india-tv-change-this-secret";
const DEFAULT_PASSWORD = "admin123";
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;

/** Same algorithm as PHP (index.php) so hosting and local Node both work. */
function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, useSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, "sha256")
    .toString("hex");
  return { hash, salt: useSalt };
}

function verifyPassword(password, hash, salt) {
  const attempt = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, "sha256")
    .toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(attempt, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function ensureAuthInitialized() {
  const site = readSite();
  if (site.auth.passwordHash && site.auth.passwordSalt) {
    return;
  }
  const { hash, salt } = hashPassword(DEFAULT_PASSWORD);
  site.auth.passwordHash = hash;
  site.auth.passwordSalt = salt;
  site.auth.hashAlgo = "pbkdf2";
  site.auth.username = site.auth.username || "admin";
  writeSite(site);
}

function checkLogin(username, password) {
  const site = readSite();
  const user = String(username || "").trim();
  const pass = String(password ?? "");
  if (user !== String(site.auth.username || "admin").trim()) return false;
  return verifyPassword(pass, site.auth.passwordHash, site.auth.passwordSalt);
}

function changePassword(currentPassword, newPassword) {
  const site = readSite();
  if (!verifyPassword(currentPassword, site.auth.passwordHash, site.auth.passwordSalt)) {
    return false;
  }
  const { hash, salt } = hashPassword(newPassword);
  site.auth.passwordHash = hash;
  site.auth.passwordSalt = salt;
  site.auth.hashAlgo = "pbkdf2";
  writeSite(site);
  return true;
}

function resetPassword(newPassword = DEFAULT_PASSWORD) {
  const site = readSite();
  const { hash, salt } = hashPassword(newPassword);
  site.auth.passwordHash = hash;
  site.auth.passwordSalt = salt;
  site.auth.hashAlgo = "pbkdf2";
  site.auth.username = site.auth.username || "admin";
  writeSite(site);
  return { username: site.auth.username, password: newPassword };
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function parseSession(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)nitv_session=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data.user || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function createSessionCookie(username) {
  const payload = {
    user: username,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const token = signSession(payload);
  return `nitv_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

function clearSessionCookie() {
  return "nitv_session=; Path=/; HttpOnly; Max-Age=0";
}

function requireAuth(req) {
  return parseSession(req.headers.cookie);
}

module.exports = {
  DEFAULT_PASSWORD,
  ensureAuthInitialized,
  checkLogin,
  changePassword,
  resetPassword,
  createSessionCookie,
  clearSessionCookie,
  requireAuth,
};
