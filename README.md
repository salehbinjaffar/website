# News India TV

Hindi news website (Dainik Bhaskar / Amar Ujala style) with **admin panel**, **live HLS TV**, **image slider**, **scrolling breaking news** (manual or **RSS auto-fetch**), and **cPanel/Apache** hosting support. No WordPress.

**Repository:** [github.com/salehbinjaffar/website](https://github.com/salehbinjaffar/website)

**For AI agents / handoff:** see **[AI_AGENT_MEMORY.md](AI_AGENT_MEMORY.md)** (chat summary, progress, resolved issues, file map).

## Features

| Feature | Description |
|--------|-------------|
| **Home slider** | Rotating hero images (manual slides or latest articles) |
| **Breaking ticker** | Marquee under header — manual lines or **RSS from any news site** |
| **Modern nav** | SVG icons on main menu (home, live, video, etc.) |
| **Live TV** | HLS (`.m3u8`) player on `/live` |
| **Articles** | Categories, featured story, image upload, social share (OG tags) |
| **Admin** | Login, menus, pages, ads, logo, password reset |
| **Hosting** | Node.js locally; **PHP `index.php`** on shared hosting (no Node required) |

## Quick start (local)

**Requirements:** [Node.js](https://nodejs.org/) 18+ (no `npm install` — uses Node built-ins only)

```powershell
cd news-india-tv
node server.js
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Public site |
| http://localhost:3000/admin | Admin panel |

**Default login:** `admin` / `admin123` — change immediately in Admin → सेटिंग, or run:

```powershell
node reset-password.js "YourNewPassword"
```

## RSS breaking news

1. Admin → **स्लाइडर / ब्रेकिंग** (`/admin/home-features`)
2. Enable **RSS से ब्रेकिंग चलाएं**
3. Add feed URL(s) from the source site (e.g. `/rss.xml`, `/feed`)
4. Set cache minutes and click **अभी RSS अपडेट करें**

Headlines link to the original publisher. If a feed fails, manual breaking lines are used.

## Deploy to cPanel / `public_html`

Upload the **entire project** (not only `public/`). See **[DEPLOY-APACHE.md](DEPLOY-APACHE.md)**.

- Entry point: `index.php` + `.htaccess`
- Writable: `data/` (for `site.json` and uploads)
- PHP: `curl` or `allow_url_fopen` for RSS fetch

One-time password fix on server: upload `admin-reset.php`, open once in browser, then delete it.

## Admin sections

| Path | What you edit |
|------|----------------|
| `/admin/settings` | Site name, logo, colors, social links, password |
| `/admin/home-features` | Slider, breaking ticker, **RSS feeds** |
| `/admin/menu` | Main nav + top links |
| `/admin/articles` | News stories and images |
| `/admin/live` | HLS stream URL |
| `/admin/ads` | Google AdSense snippets |
| `/admin/pages` | Contact & privacy pages |

## Project layout

```
news-india-tv/
├── server.js          # Node dev server
├── index.php          # Apache/cPanel entry
├── data/site.json     # All content & settings
├── lib/               # Node helpers (render, rss, auth, …)
├── php/               # PHP port of same logic
├── templates/         # HTML layouts
└── public/            # CSS, JS, uploads
```

## Data backup

Back up `data/site.json` and `public/uploads/` before updates.

## License

Private project — all rights reserved unless otherwise noted.
