const { parseRssXml, fetchUrl, fetchFeedItems } = require("./rss");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseVideoId(url) {
  const raw = String(url || "").trim();
  const m = raw.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : "";
}

function normalizeChannelInput(input) {
  let raw = String(input || "").trim();
  if (!raw) return { channelName: "", channelId: "" };
  if (/^UC[\w-]{20,}$/i.test(raw)) return { channelName: "", channelId: raw };

  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const ch = u.pathname.match(/\/channel\/(UC[\w-]+)/i);
    if (ch) return { channelName: "", channelId: ch[1] };
    const handle = u.pathname.match(/\/@([\w.\-]+)/i);
    if (handle) return { channelName: handle[1], channelId: "" };
  } catch {
  }

  raw = raw.replace(/^@/, "").replace(/^https?:\/\//, "");
  const chMatch = raw.match(/(?:youtube\.com\/channel\/)(UC[\w-]+)/i);
  if (chMatch) return { channelName: "", channelId: chMatch[1] };
  const handleMatch = raw.match(/(?:youtube\.com\/)?@?([\w.\-]+)/i);
  if (handleMatch) return { channelName: handleMatch[1], channelId: "" };

  return { channelName: raw.replace(/\/$/, ""), channelId: "" };
}

async function resolveChannelId(channelName) {
  if (!channelName) return "";
  const url = `https://www.youtube.com/@${encodeURIComponent(channelName)}`;
  const html = await fetchUrl(url);
  const patterns = [
    /"channelId":"(UC[\w-]+)"/,
    /"externalId":"(UC[\w-]+)"/,
    /"browseId":"(UC[\w-]+)"/,
    /channel_id=(UC[\w-]+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return "";
}

function getChannelPublicUrl(yt) {
  if (yt.channelName) return `https://www.youtube.com/@${encodeURIComponent(yt.channelName)}`;
  if (yt.channelId) return `https://www.youtube.com/channel/${yt.channelId}`;
  return "https://www.youtube.com/";
}

function getYouTubeChannel(site) {
  const y = site.youtubeChannel || {};
  const channelName = (y.channelName || "").trim();
  const channelId = (y.channelId || "").trim();
  return {
    enabled: Boolean(y.enabled && (channelName || channelId)),
    channelName,
    channelId,
    pageTitle: (y.pageTitle || "YouTube — ताज़ा वीडियो").trim(),
    maxVideos: Math.min(50, Math.max(6, Number(y.maxVideos) || 24)),
    cacheMinutes: Math.min(360, Math.max(15, Number(y.cacheMinutes) || 45)),
    videos: Array.isArray(y.videos) ? y.videos : [],
    fetchedAt: y.fetchedAt || "",
    lastError: y.lastError || "",
  };
}

function channelCacheStale(site) {
  const y = getYouTubeChannel(site);
  if (!y.enabled) return false;
  if (!y.fetchedAt) return true;
  const age = Date.now() - new Date(y.fetchedAt).getTime();
  return age > y.cacheMinutes * 60 * 1000;
}

async function refreshYouTubeChannel(site, options = {}) {
  const y = site.youtubeChannel || (site.youtubeChannel = {});
  const norm = normalizeChannelInput(y.channelName || y.channelId || "");
  let channelId = y.channelId || norm.channelId;
  let channelName = y.channelName || norm.channelName;

  if (!channelId && channelName) {
    try {
      channelId = await resolveChannelId(channelName);
    } catch (e) {
      y.lastError = `Channel lookup failed: ${e.message}`;
      return { updated: false, error: y.lastError };
    }
  }

  if (!channelId) {
    y.lastError = "Could not find YouTube channel ID — check channel name";
    return { updated: false, error: y.lastError };
  }

  y.channelId = channelId;
  if (channelName) y.channelName = channelName;

  const maxVideos = Math.min(50, Math.max(6, Number(y.maxVideos) || 24));
  y.maxVideos = maxVideos;
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  try {
    const items = await fetchFeedItems(feedUrl, maxVideos);
    y.videos = items
      .map((it) => {
        const videoId = parseVideoId(it.url);
        return {
          title: it.text,
          url: it.url,
          videoId,
        };
      })
      .filter((v) => v.videoId);
    y.fetchedAt = new Date().toISOString();
    y.lastError = y.videos.length ? "" : "Feed returned no videos";
    site.youtubeChannel = y;
    return { updated: true, count: y.videos.length, error: y.lastError || null };
  } catch (e) {
    y.lastError = e.message;
    site.youtubeChannel = y;
    return { updated: false, error: y.lastError };
  }
}

async function ensureYouTubeChannel(site, options = {}) {
  const y = getYouTubeChannel(site);
  if (!y.enabled) return site;
  if (!options.force && !channelCacheStale(site)) return site;
  await refreshYouTubeChannel(site, options);
  return site;
}

function renderYouTubeVideoCards(videos) {
  if (!videos.length) {
    return '<p class="youtube-empty">अभी कोई वीडियो नहीं मिली। एडमिन में चैनल नाम जाँचें और फिर से अपडेट करें।</p>';
  }
  return videos
    .map((v) => {
      const id = escapeHtml(v.videoId);
      const title = escapeHtml(v.title || "वीडियो");
      const url = escapeHtml(v.url);
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const duration = v.duration || "10:30";
      const channelName = v.channelName || "News India TV";
      const views = v.views || "1.2K views";
      const uploadDate = v.uploadDate || "2 days ago";
      return `<article class="youtube-video-card">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="youtube-video-link">
          <div class="youtube-thumbnail-wrapper">
            <img src="${thumb}" alt="${title}" loading="lazy" decoding="async" width="480" height="270">
            <span class="youtube-duration-badge">${escapeHtml(duration)}</span>
          </div>
          <div class="youtube-video-info">
            <div class="youtube-video-details">
              <h3 class="youtube-video-title">${title}</h3>
              <p class="youtube-channel-name">${escapeHtml(channelName)}</p>
              <p class="youtube-video-meta">${escapeHtml(views)} • ${escapeHtml(uploadDate)}</p>
            </div>
          </div>
        </a>
      </article>`;
    })
    .join("");
}

function youtubeChannelStatusHtml(site) {
  const y = getYouTubeChannel(site);
  if (!y.enabled) return "<p class='hint'>YouTube पेज बंद है।</p>";
  const at = y.fetchedAt ? new Date(y.fetchedAt).toLocaleString("hi-IN") : "कभी नहीं";
  let html = `<p class="hint">आखिरी अपडेट: <strong>${escapeHtml(at)}</strong> — ${y.videos.length} वीडियो।`;
  if (y.channelId) html += ` Channel ID: <code>${escapeHtml(y.channelId)}</code>`;
  html += "</p>";
  if (y.lastError) {
    html += `<p class="error" style="font-size:0.9rem">${escapeHtml(y.lastError)}</p>`;
  }
  return html;
}

module.exports = {
  normalizeChannelInput,
  parseVideoId,
  getYouTubeChannel,
  getChannelPublicUrl,
  channelCacheStale,
  refreshYouTubeChannel,
  ensureYouTubeChannel,
  renderYouTubeVideoCards,
  youtubeChannelStatusHtml,
};
