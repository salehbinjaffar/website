const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");
const ARTICLES_DIR = path.join(UPLOAD_DIR, "articles");
const MAX_BYTES = 4 * 1024 * 1024;
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function ensureDirs() {
  for (const d of [UPLOAD_DIR, ARTICLES_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function parseDataUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) {
    const m = raw.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!m) return null;
    return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], "base64") };
  }
  return { mime: "image/jpeg", buffer: Buffer.from(raw, "base64") };
}

function saveBuffer(buffer, mime, subPath) {
  ensureDirs();
  if (!buffer || buffer.length > MAX_BYTES) {
    return { error: "Image too large (max 4MB)" };
  }
  const ext = EXT_BY_MIME[mime] || ".jpg";
  const filePath = path.join(UPLOAD_DIR, subPath + ext);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return { url: "/public/uploads/" + subPath.replace(/\\/g, "/") + ext };
}

function saveBase64Image(dataUrl, subPath) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || !EXT_BY_MIME[parsed.mime]) {
    return { error: "Invalid image format. Use JPG, PNG, WebP or GIF." };
  }
  return saveBuffer(parsed.buffer, parsed.mime, subPath);
}

function saveLogoFromBase64(dataUrl) {
  const old = ["logo.jpg", "logo.png", "logo.webp", "logo.gif"];
  old.forEach((f) => {
    const p = path.join(UPLOAD_DIR, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  return saveBase64Image(dataUrl, "logo");
}

function saveArticleImageFromBase64(dataUrl, articleId) {
  const id = articleId || "art_" + Date.now();
  const name = id.replace(/[^a-zA-Z0-9_-]/g, "") + "_" + crypto.randomBytes(4).toString("hex");
  return saveBase64Image(dataUrl, "articles/" + name);
}

function applyUploadToBody(body, articleId) {
  if (body.imageBase64 && body.imageBase64.length > 20) {
    const result = saveArticleImageFromBase64(body.imageBase64, articleId);
    if (result.url) return result.url;
  }
  return body.imageUrl || "";
}

function applyLogoToSettings(site, body) {
  if (body.removeLogo === "on") {
    site.settings.logoUrl = "";
    return;
  }
  if (body.logoBase64 && body.logoBase64.length > 20) {
    const result = saveLogoFromBase64(body.logoBase64);
    if (result.url) site.settings.logoUrl = result.url;
  }
}

module.exports = {
  saveBase64Image,
  saveLogoFromBase64,
  saveArticleImageFromBase64,
  applyUploadToBody,
  applyLogoToSettings,
  UPLOAD_DIR,
};
