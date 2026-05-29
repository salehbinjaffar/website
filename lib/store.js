const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "site.json");

const { mergeDefaults } = require("./defaults");
const { ensureBreakingRss, rssCacheStale } = require("./rss");

function readSite() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  return mergeDefaults(JSON.parse(raw));
}

async function readSiteWithRss(options = {}) {
  const site = readSite();
  if (!site.breaking?.rss?.enabled) return site;
  if (!options.refreshRss && !rssCacheStale(site)) return site;
  const stamp =
    (site.breaking.rss.fetchedAt || "") + "|" + (site.breaking.rss.items || []).length;
  await ensureBreakingRss(site, { force: Boolean(options.refreshRss) });
  const stampAfter =
    (site.breaking.rss.fetchedAt || "") + "|" + (site.breaking.rss.items || []).length;
  if (options.persist !== false && stamp !== stampAfter) writeSite(site);
  return site;
}

function writeSite(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getCategoryName(site, categoryId) {
  const cat = site.categories.find((c) => c.id === categoryId);
  return cat ? cat.name : "";
}

function sortedArticles(articles) {
  return [...articles].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return String(b.publishedAt).localeCompare(String(a.publishedAt));
  });
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function newId() {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  DATA_PATH,
  readSite,
  readSiteWithRss,
  writeSite,
  getCategoryName,
  sortedArticles,
  slugify,
  newId,
};
