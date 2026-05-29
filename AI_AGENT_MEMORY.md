# AI Agent Memory — News India TV

> **Purpose:** Handoff document for Cursor/other AI agents. Read this **before** editing so you stay aligned with user intent, architecture, and what is already done.  
> **Repo:** https://github.com/salehbinjaffar/website  
> **Local path:** `C:\Users\SBJ\Projects\news-india-tv`

---

## 1. Original user goal

Build a **Hindi news website** similar to **Amar Ujala** / **Dainik Bhaskar** for **News India TV**, with:

- HTML-style public site (not a heavy CMS UI for visitors)
- **Admin login** to edit all content (menus, articles, live TV, ads, pages, branding)
- Later: **Bhaskar-style** modern nav icons, **homepage image slider**, **scrolling breaking news** with admin edit
- Later: **RSS auto-fetch** for breaking ticker from external news sites
- Deploy on **cPanel / public_html** (shared hosting, Apache, PHP)

**Explicit rejection:** User did **not** want WordPress as the runtime (WordPress/docker was explored early then abandoned).

---

## 2. Tech stack (current)

| Layer | Choice |
|-------|--------|
| Content store | `data/site.json` (single JSON file) |
| Local dev server | `server.js` (Node.js, **no npm dependencies** — builtins only) |
| Production hosting | `index.php` + `.htaccess` → PHP bootstrap mirrors Node logic |
| Templates | `templates/*.html` with `{{PLACEHOLDER}}` replacement |
| Static assets | `public/css/`, `public/js/`, `public/uploads/` |
| Auth | PBKDF2 password hash in `site.json`; session cookie (Node) / PHP session (hosting) |

**Do not** add npm/webpack unless user asks — project is intentionally simple.

---

## 3. Chat / work timeline (summary)

| Phase | User ask | Outcome |
|-------|----------|---------|
| 1 | Site like Amar Ujala + admin | Built Node CMS + templates + `site.json` |
| 2 | No WordPress | Removed WP path; kept custom CMS |
| 3 | Admin login / password | Auth + `reset-password.js`, `admin-reset.php` for hosting |
| 4 | Hosting 404 | Full project upload + `index.php` front controller (not `public/` only) |
| 5 | Live TV HLS | `/live` page, Hls.js, URL in `site.json` → `live.hlsUrl` |
| 6 | Logo & image upload | Base64 upload → `public/uploads/`, admin forms |
| 7 | Bhaskar-style UI | Nav SVG icons, hero slider, breaking marquee, admin home-features |
| 8 | RSS breaking | `lib/rss.js`, `php/rss.php`, admin RSS config + cache |
| 9 | GitHub | Pushed to `salehbinjaffar/website`, README updated |

---

## 4. Progress checklist

### Done

- [x] Public home, category, article, contact, privacy, live pages
- [x] Admin: dashboard, settings, menu, pages, live, ads, articles CRUD
- [x] Admin: **home-features** (slider + manual breaking + **RSS feeds**)
- [x] PBKDF2 auth aligned Node + PHP
- [x] Password reset: `node reset-password.js '<pass>'` and one-time `admin-reset.php`
- [x] Open Graph / share buttons on articles
- [x] Google AdSense placeholders in admin
- [x] PHP port: `php/bootstrap.php`, `php/home-ui.php`, `php/icons.php`, `php/rss.php`
- [x] Deploy doc: `DEPLOY-APACHE.md`
- [x] GitHub repo + `README.md`

### Not requested / out of scope (unless user asks)

- [ ] MySQL/database
- [ ] Multi-user roles
- [ ] Comment system
- [ ] Search
- [ ] Automated tests / CI
- [ ] npm build pipeline

---

## 5. Key files map (where to edit what)

| Feature | Node | PHP | Admin UI | Data |
|---------|------|-----|----------|------|
| Routes | `server.js` | `index.php` | — | — |
| Layout / render | `lib/render.js` | `php/bootstrap.php` (`nitv_layout`) | `templates/layout.html` | — |
| Home slider | `lib/home-ui.js` | `php/home-ui.php` | `templates/admin/home-features.html` | `slider[]` |
| Breaking ticker | `lib/home-ui.js` | `php/home-ui.php` | same | `breaking.items[]` |
| RSS breaking | `lib/rss.js` | `php/rss.php` | same + `public/js/admin-home-features.js` | `breaking.rss` |
| Nav icons | `lib/icons.js` | `php/icons.php` | `templates/admin/menu.html` | `menu[]`, `topLinks[]` |
| Articles | `server.js` | `index.php` | `templates/admin/article-form.html` | `articles[]` |
| Auth | `lib/auth.js` | `php/bootstrap.php` | `templates/admin/login.html` | `auth` |
| Defaults merge | `lib/defaults.js` | `nitv_merge_defaults()` | — | — |
| Styles | — | — | — | `public/css/style.css` |

---

## 6. Issues resolved (do not re-break)

### Admin password / login

- **Problem:** Node used scrypt; PHP used PBKDF2 → login failed on hosting.
- **Fix:** Unified on **PBKDF2** (`hashAlgo: pbkdf2` in `site.json`). Use `reset-password.js` locally or `admin-reset.php` once on server.

### 404 on cPanel

- **Problem:** Only `public/` folder uploaded.
- **Fix:** Upload **entire project**; Apache uses root `index.php` + `.htaccess`.

### RSS parser returned 0 items

- **Problem:** `stripTags()` removed `<![CDATA[` as a tag before CDATA decode.
- **Fix:** Run `decodeXmlEntities` (CDATA) **before** stripping HTML tags in `lib/rss.js` and `php/rss.php`.

### PHP breaking links for RSS

- **Problem:** `nitv_url()` wrapped external URLs incorrectly.
- **Fix:** `nitv_breaking_href()` — external `http(s)` kept as-is; internal paths use `nitv_url()`.

### `site.json` write on every PHP request

- **Problem:** RSS refresh wrote file every page load.
- **Fix:** `nitv_read_site_public()` only writes when cache timestamp/item count changes.

---

## 7. Configuration reference (`data/site.json`)

Important top-level keys:

```json
{
  "settings": { "siteName", "tagline", "accentColor", "logoUrl", "social", "breakingText" },
  "breaking": {
    "label", "speed", "items": [{ "text", "url" }],
    "rss": {
      "enabled", "maxItems", "cacheMinutes", "mergeManual",
      "feeds": [{ "url" }],
      "items": [], "fetchedAt", "lastError"
    }
  },
  "slider": [{ "title", "imageUrl", "link" }],
  "live": { "enabled", "tabLabel", "title", "hlsUrl", "posterUrl" },
  "ads": { "googleHeadScript", "googleBodySlot", "showOn*" },
  "menu", "topLinks", "categories", "articles", "pages", "auth"
}
```

**Live stream** (user-provided): HLS URL stored in `live.hlsUrl` (newsindiatvlive.in `.m3u8`).

**Security:** Do **not** commit real admin passwords. Hash lives in `auth.passwordHash` / `auth.passwordSalt`. Change via admin settings or `reset-password.js`.

---

## 8. How to run & verify

### Local (Node)

```powershell
cd C:\Users\SBJ\Projects\news-india-tv
node server.js
# http://localhost:3000  |  Admin: /admin
```

Default login after fresh install: `admin` / `admin123` — **user should change this.**

### Hosting (PHP)

- Doc: `DEPLOY-APACHE.md`
- Needs writable `data/` and `public/uploads/`
- RSS needs PHP **curl** or `allow_url_fopen`

### RSS admin test

1. `/admin/home-features` → enable RSS → add feed URL (e.g. BBC Hindi RSS for test)
2. Click **अभी RSS अपडेट करें**
3. Check homepage breaking ticker

---

## 9. Instructions for the next AI agent

1. **Read this file + `README.md`** before large changes.
2. **Keep Node and PHP in sync** — any logic change in `lib/*` likely needs `php/*` mirror.
3. **Minimize scope** — user prefers small, focused diffs; match existing patterns.
4. **Never** commit `.env`, PATs, or plaintext passwords.
5. **Do not** reintroduce WordPress unless user explicitly asks.
6. **Admin routes** exist in both `server.js` and `index.php` — update both.
7. **Breaking content priority:** If `breaking.rss.enabled` and cached `rss.items` exist → show RSS; else manual `breaking.items`; else legacy `settings.breakingText`.
8. **External breaking links** must open off-site (`target="_blank"`) — already handled in `breakingItemHref` / `nitv_breaking_href`.
9. **Git:** Remote `origin` → `https://github.com/salehbinjaffar/website.git`, branch `main`.
10. **Commits:** Only when user asks; use clear messages.

---

## 10. Known limitations / gotchas

- Some publishers **block** server-side RSS fetch — show `lastError` in admin, fall back to manual lines.
- `data/site.json` is the **only** database — concurrent edits can overwrite; no locking.
- Git was installed via winget on user's Windows machine (`C:\Program Files\Git\cmd\git.exe`) — may need fresh shell for PATH.
- `docker-compose.yml` may remain from early WP experiment — **not** used for current deploy path.
- No `package.json` / `npm install` — do not assume dependencies exist.

---

## 11. User preferences (inferred)

- Hindi UI labels in admin are intentional — keep them.
- Visual style: red accent (`#c41e3a`), dense news layout, Bhaskar-like ticker + slider.
- Wants things to work on **cheap PHP hosting**, not only localhost.
- Prefers agent to **run commands** and fix issues, not only give instructions.

---

## 12. Document maintenance

When you complete a significant task:

1. Update **§4 Progress checklist**
2. Add row to **§3 timeline**
3. Add **§6** entry if you fixed a non-obvious bug
4. Update **§5** if new modules/paths were added

Last updated: **2026-05-28** (RSS breaking + GitHub initial push + this memory file).
