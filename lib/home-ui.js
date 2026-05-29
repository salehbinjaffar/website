const { menuLinkHtml } = require("./icons");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function breakingItemHref(url) {
  const u = String(url || "/").trim();
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

function breakingItemAttrs(url) {
  return /^https?:\/\//i.test(String(url || "")) ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function getBreakingItems(site) {
  const b = site.breaking || {};
  const rss = b.rss || {};
  if (rss.enabled && Array.isArray(rss.items) && rss.items.length) {
    const max = Math.min(30, Number(rss.maxItems) || 12);
    return rss.items.slice(0, max);
  }
  if (rss.enabled && rss.mergeManual && Array.isArray(b.items) && b.items.length) {
    const manual = b.items;
    const fromRss = (rss.items || []).slice(0, Number(rss.maxItems) || 12);
    const seen = new Set(manual.map((it) => it.url));
    const merged = [...manual];
    for (const it of fromRss) {
      if (!seen.has(it.url)) merged.push(it);
    }
    return merged.slice(0, 30);
  }
  if (Array.isArray(b.items) && b.items.length) return b.items;
  const legacy = site.settings?.breakingText;
  if (legacy) return [{ text: legacy, url: "/" }];
  return [{ text: "ताज़ा खबरें News India TV पर", url: "/" }];
}

function renderBreakingTicker(site) {
  const b = site.breaking || {};
  const label = escapeHtml(b.label || "ब्रेकिंग");
  const speed = Number(b.speed) || 35;
  const items = getBreakingItems(site);
  const parts = items
    .map(
      (it) =>
        `<a href="${escapeHtml(breakingItemHref(it.url))}"${breakingItemAttrs(it.url)}>${escapeHtml(it.text)}</a><span class="breaking-sep">•</span>`
    )
    .join("");
  const track = `<div class="breaking-track" style="animation-duration:${speed}s">${parts}${parts}</div>`;
  return { label, track, speed };
}

function getSliderSlides(site, articles) {
  if (Array.isArray(site.slider) && site.slider.length) {
    return site.slider.filter((s) => s.imageUrl);
  }
  return articles
    .filter((a) => a.imageUrl)
    .slice(0, 5)
    .map((a) => ({
      title: a.title,
      imageUrl: a.imageUrl,
      link: `/article/${a.slug}`,
      category: a.categoryId,
    }));
}

function renderSlider(site, articles, getCategoryName) {
  const slides = getSliderSlides(site, articles);
  if (!slides.length) return "";

  const slidesHtml = slides
    .map(
      (s, i) => `<div class="slider-slide${i === 0 ? " is-active" : ""}" data-index="${i}">
      <a href="${escapeHtml(s.link || "#")}">
        <img src="${escapeHtml(s.imageUrl)}" alt="${escapeHtml(s.title)}">
        <div class="slider-caption">
          ${s.category ? `<span class="category-badge">${escapeHtml(getCategoryName(site, s.category))}</span>` : ""}
          <h2>${escapeHtml(s.title)}</h2>
        </div>
      </a>
    </div>`
    )
    .join("");

  const dots = slides
    .map((_, i) => `<button type="button" class="slider-dot${i === 0 ? " active" : ""}" data-go="${i}" aria-label="Slide ${i + 1}"></button>`)
    .join("");

  return `<section class="hero-slider" data-slider>
    <div class="slider-viewport">
      <div class="slider-track">${slidesHtml}</div>
      <button type="button" class="slider-arrow slider-prev" aria-label="पिछला">‹</button>
      <button type="button" class="slider-arrow slider-next" aria-label="अगला">›</button>
    </div>
    <div class="slider-dots">${dots}</div>
  </section>`;
}

function parseBreakingItems(body) {
  const indices = new Set();
  for (const key of Object.keys(body)) {
    const m = key.match(/^breaking_text_(\d+)$/);
    if (m) indices.add(Number(m[1]));
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({
      text: (body[`breaking_text_${i}`] || "").trim(),
      url: body[`breaking_url_${i}`] || "/",
    }))
    .filter((it) => it.text);
}

function parseSliderItems(body) {
  const indices = new Set();
  for (const key of Object.keys(body)) {
    const m = key.match(/^slider_title_(\d+)$/);
    if (m) indices.add(Number(m[1]));
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({
      id: `s${i}`,
      title: (body[`slider_title_${i}`] || "").trim(),
      imageUrl: (body[`slider_image_${i}`] || "").trim(),
      link: body[`slider_link_${i}`] || "/",
    }))
    .filter((s) => s.title && s.imageUrl);
}

function breakingEditorRows(site) {
  const items = getBreakingItems(site);
  if (!items.length) {
    return `<tr><td><input name="breaking_text_0" value=""></td><td><input name="breaking_url_0" value="/"></td><td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>`;
  }
  return items
    .map(
      (it, i) => `<tr>
        <td><input name="breaking_text_${i}" value="${escapeHtml(it.text)}"></td>
        <td><input name="breaking_url_${i}" value="${escapeHtml(it.url || "/")}"></td>
        <td><button type="button" class="link-btn row-remove">हटाएं</button></td>
      </tr>`
    )
    .join("");
}

function sliderEditorRows(site) {
  const slides = Array.isArray(site.slider) ? site.slider : [];
  if (!slides.length) return "";
  return slides
    .map(
      (s, i) => `<tr>
        <td><input name="slider_title_${i}" value="${escapeHtml(s.title)}"></td>
        <td><input name="slider_image_${i}" value="${escapeHtml(s.imageUrl)}"></td>
        <td><input name="slider_link_${i}" value="${escapeHtml(s.link || "/")}"></td>
        <td><button type="button" class="link-btn row-remove">हटाएं</button></td>
      </tr>`
    )
    .join("");
}

module.exports = {
  getBreakingItems,
  renderBreakingTicker,
  getSliderSlides,
  renderSlider,
  menuLinkHtml,
  parseBreakingItems,
  parseSliderItems,
  breakingEditorRows,
  sliderEditorRows,
};
