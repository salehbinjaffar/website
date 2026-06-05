# Image Upload Settings for News Articles

## Current Configuration

**File:** `php/bootstrap.php`
- **Upload Directory:** `public/uploads/`
- **Max File Size:** 8MB (8 * 1024 * 1024 bytes) - UPDATED
- **Allowed MIME Types:** image/jpeg, image/png, image/webp, image/gif
- **Article Images:** Stored in `public/uploads/articles/`

**File:** `public/js/admin-upload.js`
- **Max File Size:** 8MB (8 * 1024 * 1024 bytes) - UPDATED
- **Image Processing:** Client-side resize to max 1920px width
- **Output Format:** Base64 encoded data URL

## Settings to Check & Fix

### 1. PHP Upload Limits (php.ini)

Check these settings in your hosting's php.ini or ask your hosting provider:

```ini
upload_max_filesize = 8M
post_max_size = 8M
memory_limit = 128M
max_execution_time = 300
```

**How to check current limits:**
```php
<?php
phpinfo();
?>
```

### 2. Directory Permissions

Ensure these directories have correct permissions:

**Local Development:**
- `public/uploads/` - 755 (drwxr-xr-x)
- `public/uploads/articles/` - 755 (drwxr-xr-x)

**cPanel Hosting:**
- Set permissions to 755 via File Manager
- Right-click folder → Change Permissions → 755

### 3. Upload Function Settings

**File:** `php/bootstrap.php` (lines 259-273)

Current max size: 4MB. To increase:

```php
function nitv_save_upload_buffer(string $buffer, string $mime, string $subPath): ?string {
    $max = 8 * 1024 * 1024; // Changed from 4MB to 8MB
    if (strlen($buffer) > $max) return null;
    // ... rest of function
}
```

### 4. Form Settings

**File:** `templates/article-form.html`

Ensure the form has:
- `enctype="multipart/form-data"` attribute
- Proper input field for image upload

### 5. Browser Console Check

If upload fails, check browser console for:
- JavaScript errors
- Network errors (413 Payload Too Large)
- CORS issues

## Troubleshooting Steps

### Step 1: Check Upload Directory
```bash
# Check if directory exists and is writable
ls -la public/uploads/
ls -la public/uploads/articles/
```

**If directory doesn't exist on server:**
- Create `public/uploads/` folder
- Create `public/uploads/articles/` folder
- Set permissions to 755

### Step 2: Test PHP Upload Limits
Create a test file `test-upload.php`:
```php
<?php
echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "\n";
echo "post_max_size: " . ini_get('post_max_size') . "\n";
echo "memory_limit: " . ini_get('memory_limit') . "\n";
echo "max_execution_time: " . ini_get('max_execution_time') . "\n";
?>
```

### Step 3: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try uploading an image
4. Look for errors like:
   - "फाइल 8MB से छोटी होनी चाहिए" (File too large)
   - "केवल इमेज फाइल चुनें" (Invalid file type)
   - JavaScript errors

### Step 4: Check Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try uploading an image
4. Look for failed requests (red color)
5. Check response status code (413 = Payload Too Large)

### Step 5: Check Error Logs
- **Local:** Check PHP error logs
- **cPanel:** cPanel → Metrics → Errors

### Step 6: Verify File Upload
Check if files are being uploaded to `public/uploads/articles/`

## Common Issues & Solutions

### Issue: "File too large"
**Solution:** Increase `upload_max_filesize` and `post_max_size` in php.ini

### Issue: "Permission denied"
**Solution:** Set directory permissions to 755

### Issue: "Invalid file type"
**Solution:** Ensure image is JPEG, PNG, WebP, or GIF format

### Issue: "Upload fails silently"
**Solution:** Check PHP error logs and browser console

## Recommended Settings for Production

**php.ini:**
```ini
upload_max_filesize = 10M
post_max_size = 10M
memory_limit = 256M
max_execution_time = 300
```

**php/bootstrap.php:**
```php
$max = 10 * 1024 * 1024; // 10MB
```

## cPanel Specific Instructions

1. **Check PHP Version:** cPanel → Software → MultiPHP Manager
2. **Edit php.ini:** cPanel → Software → MultiPHP INI Editor
3. **Set Permissions:** cPanel → File Manager → Right-click folder → Change Permissions
4. **Check Error Logs:** cPanel → Metrics → Errors

## Testing Upload

After making changes:
1. Clear browser cache
2. Try uploading a small image (under 1MB)
3. Check if file appears in `public/uploads/articles/`
4. Verify image displays in article
