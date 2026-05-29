const fs = require("fs");
const path = require("path");
const { getCategoryName } = require("./store");
const { socialIconsHtml } = require("./social");
const { renderBreakingTicker, renderSlider, menuLinkHtml } = require("./home-ui");

const TPL = path.join(__dirname, "..", "templates");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function load(name) {
  return fs.readFileSync(path.join(TPL, name), "utf8");
}

function replaceAll(html, map) {
  let out = html;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(`{{${key}}}`).join(value ?? "");
  }
  return out;
}

function darkenHex(hex, percent) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return "#9e1830";
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - Math.round((255 * percent) / 100));
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - Math.round((255 * percent) / 100));
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - Math.round((255 * percent) / 100));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function adsForPage(site, pageType) {
  const ads = site.ads || {};
  const map = {
    home: ads.showOnHome,
    article: ads.showOnArticle,
    privacy: ads.showOnPrivacy,
    contact: ads.showOnContact,
    live: ads.showOnHome,
    category: ads.showOnHome,
  };
  if (!map[pageType]) return { head: "", slot: "" };
  return {
    head: ads.googleHeadScript || "",
    slot: ads.googleBodySlot
      ? `<div class="ad-slot" aria-label="Advertisement">${ads.googleBodySlot}</div>`
      : "",
  };
}

function shareButtonsHtml(site, article, canonicalUrl) {
  const url = encodeURIComponent(canonicalUrl);
  const title = encodeURIComponent(article.title);
  const img = encodeURIComponent(article.imageUrl || "");
  const text = encodeURIComponent(`${article.title} — ${site.settings.siteName}`);
  return `<div class="share-bar" data-share-bar>
    <span class="share-label">शेयर करें:</span>
    <a class="share-btn share-wa" href="https://wa.me/?text=${text}%20${url}" target="_blank" rel="noopener" title="WhatsApp">WhatsApp</a>
    <a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener" title="Facebook">Facebook</a>
    <a class="share-btn share-x" href="https://twitter.com/intent/tweet?url=${url}&text=${title}" target="_blank" rel="noopener" title="X">X</a>
    <button type="button" class="share-btn share-copy" data-copy-url="${escapeHtml(canonicalUrl)}">लिंक कॉपी</button>
  </div>`;
}

function layout(site, content, options = {}) {
  const s = site.settings;
  const accent = s.accentColor || "#c41e3a";
  const pageType = options.pageType || "home";
  const ads = adsForPage(site, pageType);

  const menuHtml = site.menu
    .map((m) => {
      const cls = [];
      if (m.url === "/live") cls.push("menu-live");
      if (options.activeUrl === m.url) cls.push("active");
      const classAttr = cls.length ? ` class="${cls.join(" ")}"` : "";
      const inner = menuLinkHtml(m.url, escapeHtml(m.label));
      return `<li><a href="${escapeHtml(m.url)}"${classAttr}>${inner}</a></li>`;
    })
    .join("");

  const topLinksHtml = site.topLinks
    .map((m) => {
      const inner = menuLinkHtml(m.url, escapeHtml(m.label));
      return `<li><a href="${escapeHtml(m.url)}">${inner}</a></li>`;
    })
    .join("");

  const breaking = renderBreakingTicker(site);

  const socialHtml = socialIconsHtml(s.social);

  const dateStr = new Date().toLocaleDateString("hi-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const footerLinks = `
    <a href="/contact">संपर्क</a>
    <a href="/privacy">गोपनीयता</a>
    <a href="/live">LIVE</a>
  `;

  const logoUrl = (s.logoUrl || "").trim();
  const logoHtml = logoUrl
    ? `<a class="logo logo-image-link" href="/"><img class="site-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(s.siteName)}"></a>`
    : `<a class="logo" href="/">${escapeHtml(s.siteName)}</a>`;

  let base = load("layout.html");
  base = base.replace('href="{{LAYOUT_CSS}}"', 'href="/public/css/style.css"');
  base = replaceAll(base, {
    LAYOUT_CSS: "/public/css/style.css",
    PAGE_TITLE: escapeHtml(options.title || s.siteName),
    SITE_NAME: escapeHtml(s.siteName),
    LOGO_HTML: logoHtml,
    TAGLINE: escapeHtml(s.tagline),
    BREAKING_LABEL: breaking.label,
    BREAKING_TRACK: breaking.track,
    ACCENT_COLOR: escapeHtml(accent),
    ACCENT_DARK: escapeHtml(darkenHex(accent, 12)),
    DATE_STR: escapeHtml(dateStr),
    MENU_ITEMS: menuHtml,
    TOP_LINKS: topLinksHtml,
    SOCIAL_LINKS: socialHtml,
    SOCIAL_FOOTER: socialIconsHtml(s.social, "social-icon-link footer-icon"),
    FOOTER_LINKS: footerLinks,
    MAIN_CONTENT: content,
    ADMIN_LINK: options.showAdmin
      ? '<a class="btn-primary" href="/admin">संपादन पैनल</a>'
      : "",
    META_TAGS: options.metaTags || "",
    GOOGLE_ADS_HEAD: ads.head,
    AD_SLOT: ads.slot,
    EXTRA_SCRIPTS: options.extraScripts || "",
  });
  return base;
}

function renderHome(site, articles) {
  const sliderHtml = renderSlider(site, articles, getCategoryName);
  const side = articles.slice(0, 4);
  const grid = articles.slice(4);

  const sideHtml = side
    .map(
      (a) => `<article class="compact-card">
        <a href="/article/${escapeHtml(a.slug)}" class="compact-link">
          <img class="compact-thumb" src="${escapeHtml(a.imageUrl)}" alt="">
          <div class="compact-body">
            <h3 class="compact-title">${escapeHtml(a.title)}</h3>
            <time>${escapeHtml(a.publishedAt)}</time>
          </div>
        </a>
      </article>`
    )
    .join("");

  const gridHtml = grid.map((a) => cardHtml(site, a)).join("");
  const trendingHtml = articles
    .slice(0, 6)
    .map((a) => `<li><a href="/article/${escapeHtml(a.slug)}">${escapeHtml(a.title)}</a></li>`)
    .join("");

  let page = load("home.html");
  page = replaceAll(page, {
    SLIDER: sliderHtml,
    SIDE_LIST: sideHtml,
    NEWS_GRID: gridHtml,
    TRENDING: trendingHtml,
  });

  return layout(site, page, {
    title: site.settings.siteName + " — हिंदी न्यूज़",
    showAdmin: true,
    pageType: "home",
    extraScripts:
      '<script src="/public/js/home-slider.js"></script>',
  });
}

function cardHtml(site, a) {
  if (!a) return "";
  return `<article class="news-card">
    <a href="/article/${escapeHtml(a.slug)}" class="card-link">
      <img class="card-image" src="${escapeHtml(a.imageUrl)}" alt="">
      <div class="card-body">
        <span class="category-badge">${escapeHtml(getCategoryName(site, a.categoryId))}</span>
        <h3 class="card-title">${escapeHtml(a.title)}</h3>
        <p class="card-meta"><time>${escapeHtml(a.publishedAt)}</time></p>
      </div>
    </a>
  </article>`;
}

function renderArticle(site, article, baseUrl) {
  const canonical = `${baseUrl}/article/${article.slug}`;
  const desc = escapeHtml(article.excerpt || article.title);
  const metaTags = `
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(article.title)}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${escapeHtml(article.imageUrl)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(article.title)}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${escapeHtml(article.imageUrl)}">
  `;

  let page = load("article.html");
  page = replaceAll(page, {
    TITLE: escapeHtml(article.title),
    CATEGORY: escapeHtml(getCategoryName(site, article.categoryId)),
    CATEGORY_URL: `/category/${escapeHtml(article.categoryId)}`,
    DATE: escapeHtml(article.publishedAt),
    IMAGE: escapeHtml(article.imageUrl),
    BODY: article.body,
    SHARE_BUTTONS: shareButtonsHtml(site, article, canonical),
  });

  return layout(site, page, {
    title: article.title + " — " + site.settings.siteName,
    showAdmin: true,
    pageType: "article",
    metaTags,
    extraScripts: '<script src="/public/js/share.js"></script>',
  });
}

function renderCategory(site, category, articles) {
  const gridHtml = articles.map((a) => cardHtml(site, a)).join("") || "<p>इस श्रेणी में कोई खबर नहीं।</p>";
  let page = load("category.html");
  page = replaceAll(page, { CATEGORY_NAME: escapeHtml(category.name), NEWS_GRID: gridHtml });
  return layout(site, page, {
    title: category.name + " — " + site.settings.siteName,
    showAdmin: true,
    activeUrl: `/category/${category.id}`,
    pageType: "category",
  });
}

function renderStaticPage(site, pageKey, options = {}) {
  const page = site.pages[pageKey];
  let html = load("page.html");
  html = replaceAll(html, {
    PAGE_HEADING: escapeHtml(page.title),
    PAGE_BODY: page.body,
  });
  return layout(site, html, {
    title: page.title + " — " + site.settings.siteName,
    showAdmin: true,
    activeUrl: options.activeUrl || `/${pageKey}`,
    pageType: options.pageType || pageKey,
  });
}

function renderLive(site) {
  const live = site.live || {};
  const hlsUrl = escapeHtml(live.hlsUrl || "");
  const poster = escapeHtml(live.posterUrl || "");
  let page = load("live.html");
  page = replaceAll(page, {
    LIVE_TITLE: escapeHtml(live.title || "लाइव"),
    HLS_URL: hlsUrl,
    POSTER_URL: poster,
    HAS_STREAM: live.hlsUrl
      ? ""
      : '<p class="live-placeholder">एडमिन में LIVE → HLS लिंक जोड़ें (.m3u8)</p>',
  });
  return layout(site, page, {
    title: (live.title || "LIVE") + " — " + site.settings.siteName,
    showAdmin: true,
    activeUrl: "/live",
    pageType: "live",
    extraScripts: live.hlsUrl
      ? '<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script><script src="/public/js/live.js"></script>'
      : "",
  });
}

function renderAdminPage(name, vars) {
  return replaceAll(load(path.join("admin", name)), vars);
}

module.exports = {
  escapeHtml,
  layout,
  renderHome,
  renderArticle,
  renderCategory,
  renderStaticPage,
  renderLive,
  renderAdminPage,
  cardHtml,
};
