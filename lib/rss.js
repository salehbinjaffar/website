const http = require("http");
const https = require("https");
const { URL } = require("url");

function decodeXmlEntities(str) {
  return String(str ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function stripTags(str) {
  return decodeXmlEntities(String(str ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (m) return stripTags(m[1]);
  const self = block.match(new RegExp(`<${name}[^>]*\\/\\s*>`, "i"));
  if (self) return "";
  const attr = block.match(new RegExp(`<${name}[^>]*href=["']([^"']+)["']`, "i"));
  return attr ? attr[1].trim() : "";
}

function parseRssXml(xml) {
  const items = [];
  const seen = new Set();

  const add = (title, url) => {
    const text = stripTags(title).slice(0, 220);
    const link = (url || "").trim();
    if (!text || !link || seen.has(link)) return;
    seen.add(link);
    items.push({ text, url: link });
  };

  let m;
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = tagValue(block, "title");
    let link = tagValue(block, "link");
    if (!link) {
      const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
      if (guid) link = stripTags(guid[1]);
    }
    add(title, link);
  }

  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml))) {
    const block = m[1];
    const title = tagValue(block, "title");
    let link = tagValue(block, "link");
    if (!link) {
      const alt = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (alt) link = alt[1];
    }
    add(title, link);
  }

  return items;
}

function isValidFeedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!isValidFeedUrl(url)) return reject(new Error("Invalid URL"));
    if (redirects > 5) return reject(new Error("Too many redirects"));

    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent": "NewsIndiaTV-RSS/1.0",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).href;
          res.resume();
          return resolve(fetchUrl(next, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => {
          chunks.push(c);
          if (Buffer.concat(chunks).length > 2e6) {
            req.destroy();
            reject(new Error("Feed too large"));
          }
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

async function fetchFeedItems(feedUrl, maxPerFeed) {
  const xml = await fetchUrl(feedUrl);
  return parseRssXml(xml).slice(0, maxPerFeed);
}

async function refreshBreakingRss(site, options = {}) {
  const b = site.breaking || (site.breaking = {});
  const rss = b.rss || (b.rss = {});
  if (!rss.enabled) return { updated: false, error: null };

  const feeds = (rss.feeds || []).map((f) => (typeof f === "string" ? f : f.url)).filter(isValidFeedUrl);
  if (!feeds.length) return { updated: false, error: "No feed URLs" };

  const maxTotal = Math.min(30, Math.max(3, Number(rss.maxItems) || 12));
  const perFeed = Math.max(3, Math.ceil(maxTotal / feeds.length));
  const all = [];
  const errors = [];

  for (const url of feeds) {
    try {
      const items = await fetchFeedItems(url, perFeed);
      all.push(...items);
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }

  if (!all.length && errors.length) {
    rss.lastError = errors.join("; ");
    return { updated: false, error: rss.lastError };
  }

  const deduped = [];
  const seen = new Set();
  for (const it of all) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    deduped.push(it);
    if (deduped.length >= maxTotal) break;
  }

  rss.items = deduped;
  rss.fetchedAt = new Date().toISOString();
  rss.lastError = errors.length ? errors.join("; ") : "";
  b.rss = rss;
  site.breaking = b;

  return { updated: true, error: rss.lastError || null, count: deduped.length };
}

function rssCacheStale(site) {
  const rss = site.breaking?.rss;
  if (!rss?.enabled) return false;
  const mins = Math.min(360, Math.max(5, Number(rss.cacheMinutes) || 20));
  if (!rss.fetchedAt) return true;
  const age = Date.now() - new Date(rss.fetchedAt).getTime();
  return age > mins * 60 * 1000;
}

async function ensureBreakingRss(site, options = {}) {
  const rss = site.breaking?.rss;
  if (!rss?.enabled) return site;
  if (!options.force && !rssCacheStale(site)) return site;
  await refreshBreakingRss(site, options);
  return site;
}

function parseRssFeedUrls(body) {
  const indices = new Set();
  for (const key of Object.keys(body)) {
    const m = key.match(/^rss_url_(\d+)$/);
    if (m) indices.add(Number(m[1]));
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => (body[`rss_url_${i}`] || "").trim())
    .filter(isValidFeedUrl)
    .map((url) => ({ url }));
}

function rssFeedEditorRows(site) {
  const feeds = site.breaking?.rss?.feeds || [];
  const urls = feeds.map((f) => (typeof f === "string" ? f : f.url || "")).filter(Boolean);
  if (!urls.length) {
    return `<tr><td><input name="rss_url_0" type="url" placeholder="https://example.com/rss.xml" value=""></td>
      <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>`;
  }
  return urls
    .map(
      (url, i) => `<tr>
        <td><input name="rss_url_${i}" type="url" value="${String(url).replace(/"/g, "&quot;")}" placeholder="https://..."></td>
        <td><button type="button" class="link-btn row-remove">हटाएं</button></td>
      </tr>`
    )
    .join("");
}

function rssStatusHtml(site) {
  const rss = site.breaking?.rss || {};
  if (!rss.enabled) return "<p class='hint'>RSS बंद है — मैन्युअल खबरें दिखेंगी।</p>";
  const at = rss.fetchedAt ? new Date(rss.fetchedAt).toLocaleString("hi-IN") : "कभी नहीं";
  const n = (rss.items || []).length;
  let html = `<p class="hint">आखिरी RSS अपडेट: <strong>${at}</strong> — ${n} खबरें कैश में।</p>`;
  if (rss.lastError) {
    html += `<p class="error" style="font-size:0.9rem">चेतावनी: ${String(rss.lastError).replace(/</g, "&lt;")}</p>`;
  }
  return html;
}

module.exports = {
  parseRssXml,
  fetchFeedItems,
  refreshBreakingRss,
  ensureBreakingRss,
  rssCacheStale,
  parseRssFeedUrls,
  rssFeedEditorRows,
  rssStatusHtml,
  isValidFeedUrl,
};
