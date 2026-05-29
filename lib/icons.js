/** Modern outline icons (Bhaskar-style nav) */
const ICONS = {
  home: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>',
  live: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/></svg>',
  video: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 6 4-6 4V9z"/></svg>',
  news: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>',
  sports: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20"/></svg>',
  entertainment: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5l14 7-14 7z"/></svg>',
  business: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20h18M7 20V10M12 20V4M17 20v-6"/></svg>',
  world: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3.5 3 14.5 0 20M12 2c-3 3.5-3 14.5 0 20"/></svg>',
  city: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M6 21V7l6-4 6 4v14M10 11h4v10"/></svg>',
  contact: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
  search: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  epaper: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  photo: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 17-6-6-4 4-2-2-4 4"/></svg>',
  default: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
};

function pickMenuIcon(url, label) {
  const u = String(url || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  if (u === "/" || l.includes("होम") || l === "home") return ICONS.home;
  if (u.includes("/live") || l.includes("live")) return ICONS.live;
  if (l.includes("वीडियो") || l.includes("video")) return ICONS.video;
  if (l.includes("फोटो") || l.includes("photo")) return ICONS.photo;
  if (l.includes("ई-पेपर") || l.includes("epaper")) return ICONS.epaper;
  if (u.includes("/contact") || l.includes("संपर्क")) return ICONS.contact;
  if (u.includes("cricket") || l.includes("क्रिकेट") || l.includes("खेल")) return ICONS.sports;
  if (u.includes("bollywood") || l.includes("बॉलीवुड")) return ICONS.entertainment;
  if (u.includes("business") || l.includes("व्यापार")) return ICONS.business;
  if (u.includes("duniya") || l.includes("दुनिया")) return ICONS.world;
  if (u.includes("city") || l.includes("शहर")) return ICONS.city;
  if (u.includes("desh") || l.includes("देश")) return ICONS.news;
  return ICONS.default;
}

function menuLinkHtml(url, label, classAttr) {
  const icon = pickMenuIcon(url, label);
  return `${icon}<span class="nav-label">${label}</span>`;
}

module.exports = { ICONS, pickMenuIcon, menuLinkHtml };
