const DEFAULTS = {
  pages: {
    contact: {
      title: "संपर्क करें",
      body: "<p>सुझाव और समाचार के लिए हमें लिखें।</p><p><strong>ईमेल:</strong> contact@newsindiatv.com</p><p><strong>फोन:</strong> +91-XXXXXXXXXX</p><p><strong>पता:</strong> नई दिल्ली, भारत</p>",
    },
    privacy: {
      title: "गोपनीयता नीति",
      body: "<p>यह गोपनीयता नीति बताती है कि News India TV आपकी जानकारी कैसे एकत्र और उपयोग करता है।</p><h2>डेटा संग्रह</h2><p>हम विश्लेषण और विज्ञापन के लिए कुकीज़ का उपयोग कर सकते हैं।</p><h2>Google विज्ञापन</h2><p>यह साइट Google AdSense जैसी तृतीय-पक्ष सेवाओं का उपयोग कर सकती है। Google आपकी जानकारी का उपयोग विज्ञापन वैयक्तिकरण के लिए कर सकता है। अधिक जानकारी के लिए <a href=\"https://policies.google.com/privacy\" target=\"_blank\" rel=\"noopener\">Google Privacy Policy</a> देखें।</p>",
    },
  },
  live: {
    enabled: true,
    tabLabel: "LIVE",
    title: "News India TV — लाइव",
    hlsUrl: "",
    posterUrl: "",
  },
  ads: {
    googleHeadScript: "",
    googleBodySlot: "",
    showOnHome: true,
    showOnArticle: true,
    showOnPrivacy: true,
    showOnContact: false,
  },
};

function mergeDefaults(site) {
  site.settings = site.settings || {};
  site.settings.social = {
    facebook: "",
    twitter: "",
    youtube: "",
    instagram: "",
    whatsapp: "",
    ...(site.settings.social || {}),
  };
  site.pages = { ...DEFAULTS.pages, ...(site.pages || {}) };
  site.live = { ...DEFAULTS.live, ...(site.live || {}) };
  site.ads = { ...DEFAULTS.ads, ...(site.ads || {}) };
  site.menu = site.menu || [];
  site.topLinks = site.topLinks || [];
  site.breaking = site.breaking || {
    label: "ब्रेकिंग",
    speed: 35,
    items: site.settings?.breakingText
      ? [{ text: site.settings.breakingText, url: "/" }]
      : [],
  };
  site.breaking.rss = {
    enabled: false,
    maxItems: 12,
    cacheMinutes: 20,
    speed: 35,
    mergeManual: false,
    feeds: [],
    items: [],
    fetchedAt: "",
    lastError: "",
    ...(site.breaking.rss || {}),
  };
  site.emergencyMessage = {
    enabled: false,
    text: "",
    url: "",
    speed: 20,
    ...(site.emergencyMessage || {}),
  };
  site.slider = site.slider || [];
  site.youtubeChannel = {
    enabled: false,
    channelName: "",
    channelId: "",
    pageTitle: "YouTube — ताज़ा वीडियो",
    maxVideos: 24,
    cacheMinutes: 45,
    videos: [],
    fetchedAt: "",
    lastError: "",
    ...(site.youtubeChannel || {}),
  };
  delete site.youtubeGallery;
  delete site.youtubePlaylist;
  return site;
}

module.exports = { DEFAULTS, mergeDefaults };
