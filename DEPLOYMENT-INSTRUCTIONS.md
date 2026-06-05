# cPanel Deployment Instructions

## Correct Upload Method

**❌ WRONG:** Uploading only `public/css` or partial folders
**✅ CORRECT:** Upload entire project structure to `public_html`

## Files Required in public_html

```
public_html/
├── .htaccess                    # REQUIRED - URL routing
├── index.php                    # REQUIRED - Main entry point
├── php/                         # REQUIRED - PHP functions
│   ├── bootstrap.php
│   ├── youtube.php
│   └── ...
├── templates/                   # REQUIRED - HTML templates
│   ├── layout.html
│   ├── home.html
│   └── ...
├── public/                      # REQUIRED - Static assets
│   ├── css/
│   ├── js/
│   └── uploads/
├── data/                        # REQUIRED - Site data
│   └── site.json
└── test-upload.php              # Optional - Diagnostic tool
```

## Step-by-Step Deployment

### 1. Download Latest Package
- `news-india-tv-upload-fix.zip` (includes all fixes)

### 2. Upload to cPanel
1. Go to cPanel → File Manager
2. Navigate to `public_html`
3. Delete all existing files (backup first if needed)
4. Upload the entire zip file
5. Extract the zip file in `public_html`

### 3. Verify File Structure
After extraction, ensure these files exist:
- `.htaccess` (in public_html root)
- `index.php` (in public_html root)
- `php/` folder
- `templates/` folder
- `public/` folder
- `data/` folder

### 4. Set Permissions
- `public/uploads/` → 755
- `public/uploads/articles/` → 755
- `data/` → 755

### 5. Check PHP Version
- cPanel → Software → MultiPHP Manager
- Ensure PHP 7.4 or higher is selected

### 6. Test Upload Functionality
1. Access: `https://newsindiatv.in/test-upload.php`
2. Check PHP settings
3. Test image upload

## Common Deployment Mistakes

### ❌ Uploading only public/ folder
**Result:** 404 errors, routing fails
**Fix:** Upload entire project including index.php and .htaccess

### ❌ Missing .htaccess file
**Result:** 404 errors, routing fails
**Fix:** Ensure .htaccess is in public_html root

### ❌ Wrong folder structure
**Result:** CSS/JS not loading, 404 errors
**Fix:** Maintain exact folder structure from zip

### ❌ Missing data/site.json
**Result:** Admin panel won't work, no articles
**Fix:** Ensure data folder and site.json exist

## Quick Verification

After deployment, test these URLs:
- Home: `https://newsindiatv.in/`
- Admin: `https://newsindiatv.in/admin`
- Test Upload: `https://newsindiatv.in/test-upload.php`
- Article: `https://newsindiatv.in/article/[slug]`

## If Still Getting 404 Errors

1. Check if `.htaccess` exists in `public_html`
2. Check if `index.php` exists in `public_html`
3. Check if mod_rewrite is enabled (contact hosting)
4. Check PHP version (must be 7.4+)
5. Check file permissions (755 for folders, 644 for files)

## Support

If deployment fails:
1. Check cPanel error logs: cPanel → Metrics → Errors
2. Verify file structure matches above
3. Ensure all required files are uploaded
4. Contact hosting provider if mod_rewrite is disabled
