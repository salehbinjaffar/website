const fs = require("fs");
const path = require("path");
const { getCategoryName } = require("./store");
const { socialIconsHtml } = require("./social");
const { renderBreakingTicker, renderSlider, menuLinkHtml } = require("./home-ui");
const { getYouTubeChannel, getChannelPublicUrl, renderYouTubeVideoCards } = require("./youtube");

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
    youtube: ads.showOnHome,
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

function renderHeaderBanner(site) {
  const hb = site.ads?.headerBanner;
  if (!hb?.enabled || !hb.slides || hb.slides.length === 0) {
    return "";
  }

  const slidesHtml = hb.slides
    .map((slide, i) => {
      const activeClass = i === 0 ? " is-active" : "";
      const imgUrl = escapeHtml(slide.imageUrl);
      const linkUrl = escapeHtml(slide.linkUrl || "");

      if (linkUrl) {
        return `<div class="header-ad-slide${activeClass}"><a href="${linkUrl}" target="_blank" rel="noopener noreferrer"><img src="${imgUrl}" alt="Advertisement"></a></div>`;
      } else {
        return `<div class="header-ad-slide${activeClass}"><img src="${imgUrl}" alt="Advertisement"></div>`;
      }
    })
    .join("");

  return `<div class="header-ad-slider">${slidesHtml}<div class="header-ad-dots"></div></div>`;
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
    <button type="button" class="share-btn share-copy" onclick="copyArticleLink('${escapeHtml(canonicalUrl)}', '${escapeHtml(article.title)}', '${escapeHtml(article.imageUrl)}')">लिंक कॉपी</button>
  </div>
  <script>
    function copyArticleLink(url, title, imageUrl) {
      const message = title + '\\n\\n' + url + '\\n\\n' + imageUrl;
      navigator.clipboard.writeText(message).then(() => {
        alert('लिंक और इमेज कॉपी हो गया!');
      });
    }
  </script>`;
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

  const emergency = site.emergencyMessage || {};
  let emergencyBanner = "";
  if (emergency.enabled && emergency.text) {
    const text = escapeHtml(emergency.text);
    const url = emergency.url ? escapeHtml(emergency.url) : "";
    const speed = emergency.speed || 20;
    if (url) {
      emergencyBanner = `<div class="emergency-banner"><div class="emergency-banner-wrap" style="animation-duration:${speed}s"><span class="emergency-banner-text"><a href="${url}" class="emergency-link">${text}</a></span></div></div>`;
    } else {
      emergencyBanner = `<div class="emergency-banner"><div class="emergency-banner-wrap" style="animation-duration:${speed}s"><span class="emergency-banner-text">${text}</span></div></div>`;
    }
  }

  const socialHtml = socialIconsHtml(s.social);

  const dateStr = new Date().toLocaleDateString("hi-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const footerLinks = `
    <a href="/">Home</a>
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
    EMERGENCY_BANNER: emergencyBanner,
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
    HEADER_AD_BANNER: renderHeaderBanner(site),
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

  const yt = getYouTubeChannel(site);
  let youtubeSection = "";
  if (yt.enabled && yt.videos && yt.videos.length > 0) {
    const displayName = yt.channelName ? `@${yt.channelName}` : "YouTube";
    const videoCards = renderYouTubeVideoCards(yt.videos.slice(0, 6));
    youtubeSection = `<section class="youtube-section"><header class="youtube-section-header">
      <h2 class="section-title">${escapeHtml(yt.pageTitle)}</h2>
      <p class="youtube-channel-label">YouTube चैनल</p>
      <p class="youtube-channel-name">
        <a href="${escapeHtml(getChannelPublicUrl(yt))}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayName)}</a>
      </p>
      <p class="youtube-channel-hint">नवीनतम वीडियो — थंबनेल पर क्लिक करके YouTube पर देखें।</p>
    </header>
    <div class="youtube-videos-grid">${videoCards}</div></section>`;
  }

  const newsFeedArticles = articles.slice(0, 8);
  const newsFeedHtml = renderNewsFeed(site, newsFeedArticles);

  let page = load("home.html");
  page = replaceAll(page, {
    SLIDER: sliderHtml,
    SIDE_LIST: sideHtml,
    YOUTUBE_SECTION: youtubeSection,
    NEWS_FEED: newsFeedHtml,
    NEWS_GRID: gridHtml,
    TRENDING: trendingHtml,
  });

  return layout(site, page, {
    title: site.settings.siteName + " — हिंदी न्यूज़",
    showAdmin: true,
    pageType: "home",
    extraScripts: '<script src="/public/js/home-slider.js"></script>',
  });
}

function renderYouTube(site) {
  const yt = getYouTubeChannel(site);
  const displayName = yt.channelName
    ? `@${yt.channelName}`
    : yt.channelId
      ? "YouTube Channel"
      : "YouTube";
  let page = load("youtube.html");
  page = replaceAll(page, {
    PAGE_HEADING: escapeHtml(yt.pageTitle),
    CHANNEL_URL: escapeHtml(getChannelPublicUrl(yt)),
    CHANNEL_DISPLAY: escapeHtml(displayName),
    VIDEO_CARDS: renderYouTubeVideoCards(yt.videos),
  });
  return layout(site, page, {
    title: yt.pageTitle + " — " + site.settings.siteName,
    showAdmin: true,
    activeUrl: "/youtube",
    pageType: "youtube",
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

function renderNewsFeed(site, articles) {
  if (!articles.length) return "";
  
  const cards = articles.map((article) => {
    const category = getCategoryName(site, article.categoryId);
    const date = new Date(article.publishedAt).toLocaleDateString("hi-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const articleUrl = `/article/${escapeHtml(article.slug)}`;
    
    return `<article class="news-feed-card" onclick="window.location.href='${articleUrl}'">
      <div class="news-feed-content">
        <span class="news-feed-category">${escapeHtml(category)}</span>
        <h3 class="news-feed-headline">${escapeHtml(article.title)}</h3>
        <div class="news-feed-meta">
          <time>${escapeHtml(date)}</time>
        </div>
        <div class="news-feed-share-icons">
          <button class="news-feed-share-btn" title="Share on Facebook" onclick="event.stopPropagation(); shareArticle('facebook', '${articleUrl}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </button>
          <button class="news-feed-share-btn" title="Share on X" onclick="event.stopPropagation(); shareArticle('twitter', '${articleUrl}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </button>
          <button class="news-feed-share-btn" title="Copy Link" onclick="event.stopPropagation(); copyArticleLink('${articleUrl}', '${escapeHtml(article.title)}', '${escapeHtml(article.imageUrl)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
        </div>
      </div>
      <div class="news-feed-thumbnail-wrapper">
        <img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy">
      </div>
    </article>`;
  }).join("");
  
  return `<section class="news-feed-section">
    <header class="news-feed-header">
      <h2 class="news-feed-title">ताज़ा समाचार</h2>
    </header>
    <div class="news-feed-list">
      ${cards}
    </div>
    <button class="news-feed-load-more" id="loadMoreNews">और खबरें देखें</button>
  </section>
  <script>
    function shareArticle(platform, url) {
      const shareUrl = encodeURIComponent(url);
      if (platform === 'facebook') {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + shareUrl, '_blank');
      } else if (platform === 'twitter') {
        window.open('https://twitter.com/intent/tweet?url=' + shareUrl, '_blank');
      }
    }
    function copyArticleLink(url, title, imageUrl) {
      const message = title + '\\n\\n' + url + '\\n\\n' + imageUrl;
      navigator.clipboard.writeText(message).then(() => {
        alert('लिंक और इमेज कॉपी हो गया!');
      });
    }
  </script>`;
}

function renderArticle(site, article, baseUrl) {
  const canonical = `${baseUrl}/article/${article.slug}`;
  const desc = escapeHtml(article.excerpt || article.title);
  // Ensure image URL is absolute for WhatsApp/OG crawlers
  const imageUrl = article.imageUrl.startsWith('http') 
    ? article.imageUrl 
    : `${baseUrl}${article.imageUrl.startsWith('/') ? '' : '/'}${article.imageUrl}`;
  const metaTags = `
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(article.title)}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(article.title)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:site_name" content="${escapeHtml(site.settings.siteName)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(article.title)}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    <meta name="twitter:image:alt" content="${escapeHtml(article.title)}">
  `;

  let page = load("article.html");
  const tagsHtml = article.tags && article.tags.length 
    ? `<div class="article-tags">` + article.tags.map(tag => 
      `<span class="article-tag">#${escapeHtml(tag)}</span>`
    ).join('') + `</div>` 
    : '';
  page = replaceAll(page, {
    TITLE: escapeHtml(article.title),
    CATEGORY: escapeHtml(getCategoryName(site, article.categoryId)),
    CATEGORY_URL: `/category/${escapeHtml(article.categoryId)}`,
    DATE: escapeHtml(article.publishedAt),
    IMAGE: escapeHtml(article.imageUrl),
    BODY: article.body,
    TAGS: tagsHtml,
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
  renderYouTube,
  renderAdminPage,
  cardHtml,
};
