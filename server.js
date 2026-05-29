const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const {
  readSite,
  readSiteWithRss,
  writeSite,
  getCategoryName,
  sortedArticles,
  slugify,
  newId,
} = require("./lib/store");
const {
  ensureAuthInitialized,
  checkLogin,
  changePassword,
  createSessionCookie,
  clearSessionCookie,
  requireAuth,
  DEFAULT_PASSWORD,
} = require("./lib/auth");
const {
  renderHome,
  renderArticle,
  renderCategory,
  renderStaticPage,
  renderLive,
  renderAdminPage,
  escapeHtml,
} = require("./lib/render");
const { applyUploadToBody, applyLogoToSettings } = require("./lib/upload");
const {
  parseBreakingItems,
  parseSliderItems,
  breakingEditorRows,
  sliderEditorRows,
} = require("./lib/home-ui");
const {
  parseRssFeedUrls,
  rssFeedEditorRows,
  rssStatusHtml,
  refreshBreakingRss,
} = require("./lib/rss");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, "public");

ensureAuthInitialized();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 12e6) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const params = new URLSearchParams(data);
        const obj = {};
        for (const [k, v] of params) obj[k] = v;
        resolve(obj);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function redirect(res, location, cookies = []) {
  res.writeHead(302, { Location: location, "Set-Cookie": cookies });
  res.end();
}

function sendHtml(res, html, status = 200, cookies) {
  const headers = { "Content-Type": "text/html; charset=utf-8" };
  if (cookies) headers["Set-Cookie"] = cookies;
  res.writeHead(status, headers);
  res.end(html);
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC, pathname.replace(/^\/public\//, ""));
  if (!filePath.startsWith(PUBLIC)) {
    sendText(res, "Forbidden", 403);
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function requireAdmin(req, res) {
  const session = requireAuth(req);
  if (!session) {
    redirect(res, "/admin/login");
    return null;
  }
  return session;
}

function categoryOptions(site, selected) {
  return site.categories
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}"${c.id === selected ? " selected" : ""}>${escapeHtml(c.name)}</option>`
    )
    .join("");
}

function articlesTable(site) {
  const rows = sortedArticles(site.articles)
    .map(
      (a) => `<tr>
        <td>${escapeHtml(a.title.length > 55 ? a.title.slice(0, 55) + "…" : a.title)}</td>
        <td>${escapeHtml(getCategoryName(site, a.categoryId))}</td>
        <td>${a.featured ? "हाँ" : ""}</td>
        <td>
          <a href="/article/${escapeHtml(a.slug)}" target="_blank">देखें</a>
          · <a href="/admin/articles/edit?id=${escapeHtml(a.id)}">संपादित</a>
          · <form class="inline" method="post" action="/admin/articles/delete" onsubmit="return confirm('हटाएं?')">
            <input type="hidden" name="id" value="${escapeHtml(a.id)}">
            <button type="submit" class="link-btn">हटाएं</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
  return rows || "<tr><td colspan='4'>कोई खबर नहीं</td></tr>";
}

function parseIndexedMenu(body, prefix) {
  const indices = new Set();
  for (const key of Object.keys(body)) {
    const m = key.match(new RegExp(`^${prefix}_label_(\\d+)$`));
    if (m) indices.add(Number(m[1]));
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({
      label: (body[`${prefix}_label_${i}`] || "").trim(),
      url: body[`${prefix}_url_${i}`] || "/",
    }))
    .filter((item) => item.label);
}

function menuEditorRows(site, prefix) {
  const list = prefix === "menu" ? site.menu : site.topLinks;
  const p = prefix === "menu" ? "menu" : "top";
  return list
    .map(
      (m, i) => `<tr>
        <td><input name="${p}_label_${i}" value="${escapeHtml(m.label)}"></td>
        <td><input name="${p}_url_${i}" value="${escapeHtml(m.url)}"></td>
        <td><button type="button" class="link-btn row-remove">हटाएं</button></td>
      </tr>`
    )
    .join("");
}

function baseUrl(req) {
  const host = req.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/public/") && serveStatic(req, res, pathname)) return;

  try {
    if (pathname === "/admin/login" && req.method === "GET") {
      const msg = url.searchParams.get("error") ? "<p class='error'>गलत यूज़रनेम या पासवर्ड</p>" : "";
      return sendHtml(res, renderAdminPage("login.html", { ERROR: msg, LOGIN_ACTION: "/admin/login", HOME_LINK: "/" }));
    }

    if (pathname === "/admin/login" && req.method === "POST") {
      const body = await parseBody(req);
      if (checkLogin(body.username, body.password)) {
        return redirect(res, "/admin", [createSessionCookie(body.username)]);
      }
      return redirect(res, "/admin/login?error=1");
    }

    if (pathname === "/admin/logout") {
      return redirect(res, "/admin/login", [clearSessionCookie()]);
    }

    if (pathname.startsWith("/admin")) {
      const session = requireAdmin(req, res);
      if (!session) return;

      if (pathname === "/admin" && req.method === "GET") {
        const site = readSite();
        return sendHtml(
          res,
          renderAdminPage("dashboard.html", {
            SITE_NAME: site.settings.siteName,
            ARTICLE_COUNT: String(site.articles.length),
            CATEGORY_COUNT: String(site.categories.length),
          })
        );
      }

      if (pathname === "/admin/home-features" && req.method === "GET") {
        const site = readSite();
        const b = site.breaking || {};
        const rss = b.rss || {};
        let msg = url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "";
        if (url.searchParams.get("refreshed")) {
          msg += "<p class='ok'>RSS फ़ीड अपडेट हो गई।</p>";
        }
        return sendHtml(
          res,
          renderAdminPage("home-features.html", {
            BREAKING_LABEL: escapeHtml(b.label || "ब्रेकिंग"),
            BREAKING_SPEED: String(b.speed || 35),
            RSS_ENABLED: rss.enabled ? "checked" : "",
            RSS_MAX_ITEMS: String(rss.maxItems || 12),
            RSS_CACHE_MINUTES: String(rss.cacheMinutes || 20),
            RSS_MERGE_MANUAL: rss.mergeManual ? "checked" : "",
            RSS_FEED_ROWS: rssFeedEditorRows(site),
            RSS_STATUS: rssStatusHtml(site),
            BREAKING_ROWS: breakingEditorRows(site),
            SLIDER_ROWS: sliderEditorRows(site),
            MESSAGE: msg,
          })
        );
      }

      if (pathname === "/admin/home-features" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        const speed = Math.min(120, Math.max(15, Number(body.breakingSpeed) || 35));
        const rssPrev = site.breaking?.rss || {};
        site.breaking = {
          label: (body.breakingLabel || "ब्रेकिंग").trim(),
          speed,
          items: parseBreakingItems(body),
          rss: {
            enabled: body.rssEnabled === "on",
            maxItems: Math.min(30, Math.max(3, Number(body.rssMaxItems) || 12)),
            cacheMinutes: Math.min(360, Math.max(5, Number(body.rssCacheMinutes) || 20)),
            mergeManual: body.rssMergeManual === "on",
            feeds: parseRssFeedUrls(body),
            items: rssPrev.items || [],
            fetchedAt: rssPrev.fetchedAt || "",
            lastError: rssPrev.lastError || "",
          },
        };
        site.slider = parseSliderItems(body);
        if (site.breaking.rss.enabled) {
          await refreshBreakingRss(site, { force: body.refreshRss === "on" });
        }
        writeSite(site);
        const q = body.refreshRss === "on" ? "?saved=1&refreshed=1" : "?saved=1";
        return redirect(res, "/admin/home-features" + q);
      }

      if (pathname === "/admin/settings" && req.method === "GET") {
        const site = readSite();
        const s = site.settings;
        return sendHtml(
          res,
          renderAdminPage("settings.html", {
            SITE_NAME: s.siteName,
            TAGLINE: s.tagline,
            BREAKING_TEXT: s.breakingText,
            ACCENT_COLOR: s.accentColor,
            FACEBOOK: s.social.facebook || "",
            TWITTER: s.social.twitter || "",
            YOUTUBE: s.social.youtube || "",
            INSTAGRAM: s.social.instagram || "",
            WHATSAPP: s.social.whatsapp || "",
            USERNAME: site.auth.username,
            LOGO_PREVIEW: s.logoUrl
              ? `<img id="logo-preview" class="upload-preview" src="${escapeHtml(s.logoUrl)}" alt="Logo">`
              : `<img id="logo-preview" class="upload-preview" style="display:none" alt="">`,
            MESSAGE: url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "",
          })
        );
      }

      if (pathname === "/admin/settings" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        applyLogoToSettings(site, body);
        site.settings.siteName = body.siteName || site.settings.siteName;
        site.settings.tagline = body.tagline || "";
        site.settings.breakingText = body.breakingText || "";
        site.settings.accentColor = body.accentColor || "#c41e3a";
        site.settings.social = {
          facebook: body.facebook || "",
          twitter: body.twitter || "",
          youtube: body.youtube || "",
          instagram: body.instagram || "",
          whatsapp: body.whatsapp || "",
        };
        if (body.newPassword && body.newPassword.length >= 6) {
          if (!changePassword(body.currentPassword, body.newPassword)) {
            return redirect(res, "/admin/settings?error=pass");
          }
        }
        if (body.username) site.auth.username = body.username;
        writeSite(site);
        return redirect(res, "/admin/settings?saved=1");
      }

      if (pathname === "/admin/menu" && req.method === "GET") {
        const site = readSite();
        return sendHtml(
          res,
          renderAdminPage("menu.html", {
            MENU_ROWS: menuEditorRows(site, "menu"),
            TOP_ROWS: menuEditorRows(site, "top"),
            MENU_COUNT: String(site.menu.length),
            TOP_COUNT: String(site.topLinks.length),
            MESSAGE: url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "",
          })
        );
      }

      if (pathname === "/admin/menu" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        const menu = parseIndexedMenu(body, "menu");
        const topLinks = parseIndexedMenu(body, "top");
        if (menu.length) site.menu = menu;
        if (topLinks.length) site.topLinks = topLinks;
        writeSite(site);
        return redirect(res, "/admin/menu?saved=1");
      }

      if (pathname === "/admin/pages" && req.method === "GET") {
        const site = readSite();
        return sendHtml(
          res,
          renderAdminPage("pages.html", {
            CONTACT_TITLE: site.pages.contact.title,
            CONTACT_BODY: site.pages.contact.body.replace(/<\/p>/gi, "\n").replace(/<p>/gi, "").replace(/<[^>]+>/g, ""),
            PRIVACY_TITLE: site.pages.privacy.title,
            PRIVACY_BODY: site.pages.privacy.body.replace(/<\/p>/gi, "\n\n").replace(/<p>/gi, "").replace(/<h2>/gi, "\n## ").replace(/<\/h2>/gi, "\n").replace(/<[^>]+>/g, ""),
            MESSAGE: url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "",
          })
        );
      }

      if (pathname === "/admin/pages" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        const formatBody = (text) => {
          const t = (text || "").trim();
          if (!t) return "";
          if (/<[a-z][\s\S]*>/i.test(t)) return t;
          return t
            .split(/\n\n+/)
            .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
            .join("");
        };
        const privacyRaw = (body.privacyBody || "").trim();
        const privacyBody = /<[a-z][\s\S]*>/i.test(privacyRaw)
          ? privacyRaw
          : (body.privacyBody || "")
          .split(/\n\n+/)
          .map((block) => {
            const t = block.trim();
            if (t.startsWith("## ")) return `<h2>${escapeHtml(t.slice(3))}</h2>`;
            return `<p>${escapeHtml(t)}</p>`;
          })
          .join("");
        site.pages.contact = {
          title: body.contactTitle || "संपर्क",
          body: formatBody(body.contactBody),
        };
        site.pages.privacy = {
          title: body.privacyTitle || "गोपनीयता",
          body: privacyBody,
        };
        writeSite(site);
        return redirect(res, "/admin/pages?saved=1");
      }

      if (pathname === "/admin/live" && req.method === "GET") {
        const site = readSite();
        const live = site.live;
        return sendHtml(
          res,
          renderAdminPage("live.html", {
            ENABLED: live.enabled ? "checked" : "",
            TAB_LABEL: live.tabLabel || "LIVE",
            TITLE: live.title || "",
            HLS_URL: live.hlsUrl || "",
            POSTER_URL: live.posterUrl || "",
            MESSAGE: url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "",
          })
        );
      }

      if (pathname === "/admin/live" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        site.live = {
          enabled: body.enabled === "on",
          tabLabel: body.tabLabel || "LIVE",
          title: body.title || "लाइव",
          hlsUrl: (body.hlsUrl || "").trim(),
          posterUrl: (body.posterUrl || "").trim(),
        };
        const liveItem = site.menu.find((m) => m.url === "/live");
        if (liveItem) liveItem.label = site.live.tabLabel;
        else if (site.live.enabled) site.menu.push({ label: site.live.tabLabel, url: "/live" });
        writeSite(site);
        return redirect(res, "/admin/live?saved=1");
      }

      if (pathname === "/admin/ads" && req.method === "GET") {
        const site = readSite();
        const ads = site.ads;
        return sendHtml(
          res,
          renderAdminPage("ads.html", {
            HEAD_SCRIPT: ads.googleHeadScript || "",
            BODY_SLOT: ads.googleBodySlot || "",
            SHOW_HOME: ads.showOnHome ? "checked" : "",
            SHOW_ARTICLE: ads.showOnArticle ? "checked" : "",
            SHOW_PRIVACY: ads.showOnPrivacy ? "checked" : "",
            SHOW_CONTACT: ads.showOnContact ? "checked" : "",
            MESSAGE: url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "",
          })
        );
      }

      if (pathname === "/admin/ads" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        site.ads = {
          googleHeadScript: body.headScript || "",
          googleBodySlot: body.bodySlot || "",
          showOnHome: body.showOnHome === "on",
          showOnArticle: body.showOnArticle === "on",
          showOnPrivacy: body.showOnPrivacy === "on",
          showOnContact: body.showOnContact === "on",
        };
        writeSite(site);
        return redirect(res, "/admin/ads?saved=1");
      }

      if (pathname === "/admin/articles" && req.method === "GET") {
        const site = readSite();
        return sendHtml(
          res,
          renderAdminPage("articles.html", {
            ARTICLE_ROWS: articlesTable(site),
            MESSAGE: url.searchParams.get("saved") ? "<p class='ok'>सेव हो गया</p>" : "",
          })
        );
      }

      if (pathname === "/admin/articles/new" && req.method === "GET") {
        const site = readSite();
        return sendHtml(
          res,
          renderAdminPage("article-form.html", {
            FORM_TITLE: "नई खबर",
            ACTION: "/admin/articles/save",
            ID: "",
            TITLE: "",
            SLUG: "",
            EXCERPT: "",
            BODY: "",
            IMAGE_URL: "",
            PUBLISHED_AT: new Date().toISOString().slice(0, 10),
            FEATURED: "",
            IMAGE_PREVIEW: `<img id="article-image-preview" class="upload-preview" style="display:none" alt="">`,
            CATEGORY_OPTIONS: categoryOptions(site, site.categories[0]?.id),
          })
        );
      }

      if (pathname === "/admin/articles/edit" && req.method === "GET") {
        const site = readSite();
        const article = site.articles.find((a) => a.id === url.searchParams.get("id"));
        if (!article) return sendText(res, "Not found", 404);
        return sendHtml(
          res,
          renderAdminPage("article-form.html", {
            FORM_TITLE: "खबर संपादित करें",
            ACTION: "/admin/articles/save",
            ID: article.id,
            TITLE: article.title,
            SLUG: article.slug,
            EXCERPT: article.excerpt,
            BODY: article.body.replace(/<\/p>/g, "\n").replace(/<p>/g, "").replace(/<[^>]+>/g, ""),
            IMAGE_URL: article.imageUrl,
            IMAGE_PREVIEW: article.imageUrl
              ? `<img id="article-image-preview" class="upload-preview" src="${escapeHtml(article.imageUrl)}" alt="">`
              : `<img id="article-image-preview" class="upload-preview" style="display:none" alt="">`,
            PUBLISHED_AT: article.publishedAt,
            FEATURED: article.featured ? "checked" : "",
            CATEGORY_OPTIONS: categoryOptions(site, article.categoryId),
          })
        );
      }

      if (pathname === "/admin/articles/save" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        const id = body.id || newId();
        let article = site.articles.find((a) => a.id === id);
        const slug = body.slug || slugify(body.title);
        const bodyHtml = body.body
          .split(/\n\n+/)
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join("");
        const imageUrl = applyUploadToBody(body, id);
        const payload = {
          id,
          slug,
          title: body.title,
          categoryId: body.categoryId,
          excerpt: body.excerpt,
          body: bodyHtml,
          imageUrl,
          publishedAt: body.publishedAt,
          featured: body.featured === "on",
        };
        if (payload.featured) {
          site.articles.forEach((a) => {
            if (a.id !== id) a.featured = false;
          });
        }
        if (article) Object.assign(article, payload);
        else site.articles.unshift(payload);
        writeSite(site);
        return redirect(res, "/admin/articles?saved=1");
      }

      if (pathname === "/admin/articles/delete" && req.method === "POST") {
        const site = readSite();
        const body = await parseBody(req);
        site.articles = site.articles.filter((a) => a.id !== body.id);
        writeSite(site);
        return redirect(res, "/admin/articles");
      }

      return sendText(res, "Admin page not found", 404);
    }

    const site = await readSiteWithRss();
    const articles = sortedArticles(site.articles);

    if (pathname === "/" || pathname === "/index.html") {
      return sendHtml(res, renderHome(site, articles));
    }

    if (pathname === "/contact") {
      return sendHtml(res, renderStaticPage(site, "contact", { activeUrl: "/contact", pageType: "contact" }));
    }

    if (pathname === "/privacy") {
      return sendHtml(res, renderStaticPage(site, "privacy", { activeUrl: "/privacy", pageType: "privacy" }));
    }

    if (pathname === "/live") {
      return sendHtml(res, renderLive(site));
    }

    if (pathname.startsWith("/article/")) {
      const slug = pathname.slice("/article/".length);
      const article = site.articles.find((a) => a.slug === slug);
      if (!article) return sendText(res, "खबर नहीं मिली", 404);
      return sendHtml(res, renderArticle(site, article, baseUrl(req)));
    }

    if (pathname.startsWith("/category/")) {
      const catId = pathname.slice("/category/".length);
      const category = site.categories.find((c) => c.id === catId);
      if (!category) return sendText(res, "श्रेणी नहीं मिली", 404);
      const catArticles = articles.filter((a) => a.categoryId === catId);
      return sendHtml(res, renderCategory(site, category, catArticles));
    }

    if (serveStatic(req, res, "/public/css/style.css")) return;

    sendText(res, "पेज नहीं मिला", 404);
  } catch (err) {
    console.error(err);
    sendText(res, "Server error", 500);
  }
});

server.listen(PORT, () => {
  console.log(`News India TV running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Login — user: admin  password: ${DEFAULT_PASSWORD}`);
});
