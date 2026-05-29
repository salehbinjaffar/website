# Fix “404 Not Found” on Apache / cPanel

## Why you saw the error

Hosting **only serves static files** (HTML, CSS, images). This project needs **PHP** (or Node) to run routes like `/`, `/admin`, `/article/...`.

If you uploaded **only** the `public/` folder, the server has no `index.php` → **404**.

## Correct upload (cPanel / public_html)

Upload the **entire** `news-india-tv` folder contents into `public_html`:

```
public_html/
├── index.php          ← required
├── .htaccess          ← required
├── data/
│   └── site.json      ← must be writable (chmod 664)
├── php/
├── templates/
├── public/
│   ├── css/
│   └── js/
```

Do **not** upload only `public/css`.

## After upload

1. **PHP 7.4+** must be enabled (most hosts have this).
2. Set permissions: `data/site.json` → **664**, folder `data/` → **755**.
3. Open: `https://yourdomain.com/`
4. Admin: `https://yourdomain.com/admin`  
   Login: `admin` / `admin123`

**Password not working?** Re-upload `data/site.json` after running on your PC:  
`node reset-password.js` (sets password to `admin123` for both Node and PHP).

## Subfolder install

If the site lives at `https://yourdomain.com/news/`:

1. Upload files into `public_html/news/`
2. Edit `.htaccess` and set: `RewriteBase /news/`

## Node.js (local PC)

```powershell
cd news-india-tv
node server.js
```

Then open http://localhost:3000 — no Apache needed locally.

## Still 404?

- Confirm `index.php` exists in `public_html`
- Confirm `.htaccess` was uploaded (hidden files on in FTP)
- In cPanel → **Select PHP Version** → 7.4 or 8.x
- Check **Error Log** in cPanel for PHP errors
