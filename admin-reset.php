<?php
/**
 * ONE-TIME password reset for web hosting.
 * 1. Upload this file to your site root (same folder as index.php)
 * 2. Open: https://yourdomain.com/admin-reset.php
 * 3. DELETE this file immediately after login works
 */
declare(strict_types=1);

require __DIR__ . '/php/bootstrap.php';

$NEW_USER = 'admin';
$NEW_PASS = '#saleh67';

header('Content-Type: text/html; charset=utf-8');

$site = nitv_read_site();
$salt = bin2hex(random_bytes(16));
$site['auth'] = [
    'username' => $NEW_USER,
    'passwordHash' => nitv_hash_password($NEW_PASS, $salt),
    'passwordSalt' => $salt,
    'hashAlgo' => 'pbkdf2',
];

$ok = @file_put_contents(NITV_DATA, json_encode($site, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:2rem auto;padding:1rem">';
if ($ok === false) {
    echo '<h1 style="color:#b00020">Cannot write data/site.json</h1>';
    echo '<p>Set folder <code>data/</code> permissions to <strong>755</strong> or <strong>775</strong> in cPanel File Manager, then refresh this page.</p>';
} else {
    echo '<h1 style="color:#0d6b0d">Password reset OK</h1>';
    echo '<p><strong>Username:</strong> ' . htmlspecialchars($NEW_USER) . '</p>';
    echo '<p><strong>Password:</strong> ' . htmlspecialchars($NEW_PASS) . '</p>';
    echo '<p><a href="' . htmlspecialchars(nitv_url('/admin/login')) . '">Go to admin login</a></p>';
    echo '<p style="color:#b00020"><strong>Delete admin-reset.php now</strong> (security).</p>';
}
echo '</body></html>';
