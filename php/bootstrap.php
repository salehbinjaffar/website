<?php
declare(strict_types=1);

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool {
        return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

define('NITV_ROOT', dirname(__DIR__));
define('NITV_DATA', NITV_ROOT . '/data/site.json');
define('NITV_TPL', NITV_ROOT . '/templates');
define('NITV_DEFAULT_PASSWORD', 'admin123');

/** Subfolder install e.g. /news-india-tv */
function nitv_base_path(): string {
    $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($dir === '/' || $dir === '.') {
        return '';
    }
    return rtrim($dir, '/');
}

function nitv_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $path = nitv_base_path();
    if ($path === '') {
        $path = '/';
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $path,
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

nitv_session_start();

function nitv_url(string $path = ''): string {
    $base = nitv_base_path();
    $path = $path === '' ? '/' : (str_starts_with($path, '/') ? $path : '/' . $path);
    return $base . ($path === '/' && $base === '' ? '/' : $path);
}

function nitv_asset(string $path): string {
    return nitv_base_path() . '/' . ltrim($path, '/');
}

function nitv_read_site(): array {
    $raw = file_get_contents(NITV_DATA);
    $site = json_decode($raw ?: '{}', true) ?: [];
    return nitv_merge_defaults($site);
}

function nitv_read_site_public(bool $forceRss = false): array {
    $site = nitv_read_site();
    if (empty($site['breaking']['rss']['enabled'])) {
        return $site;
    }
    $stamp = ($site['breaking']['rss']['fetchedAt'] ?? '') . '|' . count($site['breaking']['rss']['items'] ?? []);
    nitv_rss_ensure($site, $forceRss);
    $stampAfter = ($site['breaking']['rss']['fetchedAt'] ?? '') . '|' . count($site['breaking']['rss']['items'] ?? []);
    if ($stamp !== $stampAfter) {
        nitv_write_site($site);
    }
    return $site;
}

function nitv_write_site(array $site): void {
    file_put_contents(NITV_DATA, json_encode($site, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function nitv_merge_defaults(array $site): array {
    $site['settings'] = $site['settings'] ?? [];
    $site['settings']['logoUrl'] = $site['settings']['logoUrl'] ?? '';
    $site['settings']['social'] = array_merge([
        'facebook' => '', 'twitter' => '', 'youtube' => '', 'instagram' => '', 'whatsapp' => '',
    ], $site['settings']['social'] ?? []);
    $site['pages'] = array_merge([
        'contact' => ['title' => 'संपर्क करें', 'body' => '<p>संपर्क जानकारी यहाँ।</p>'],
        'privacy' => ['title' => 'गोपनीयता नीति', 'body' => '<p>गोपनीयता नीति।</p>'],
    ], $site['pages'] ?? []);
    $site['live'] = array_merge([
        'enabled' => true, 'tabLabel' => 'LIVE', 'title' => 'लाइव', 'hlsUrl' => '', 'posterUrl' => '',
    ], $site['live'] ?? []);
    $site['ads'] = array_merge([
        'googleHeadScript' => '', 'googleBodySlot' => '',
        'showOnHome' => true, 'showOnArticle' => true, 'showOnPrivacy' => true, 'showOnContact' => false,
    ], $site['ads'] ?? []);
    $site['menu'] = $site['menu'] ?? [];
    $site['topLinks'] = $site['topLinks'] ?? [];
    $site['categories'] = $site['categories'] ?? [];
    $site['articles'] = $site['articles'] ?? [];
    $legacyBreaking = $site['settings']['breakingText'] ?? '';
    $site['breaking'] = array_merge(
        ['label' => 'ब्रेकिंग', 'speed' => 35, 'items' => []],
        $site['breaking'] ?? []
    );
    if (empty($site['breaking']['items']) && $legacyBreaking !== '') {
        $site['breaking']['items'] = [['text' => $legacyBreaking, 'url' => '/']];
    }
    $site['slider'] = $site['slider'] ?? [];
    $site['breaking']['rss'] = array_merge(
        [
            'enabled' => false,
            'maxItems' => 12,
            'cacheMinutes' => 20,
            'mergeManual' => false,
            'feeds' => [],
            'items' => [],
            'fetchedAt' => '',
            'lastError' => '',
        ],
        $site['breaking']['rss'] ?? []
    );
    $site['youtubeChannel'] = array_merge(
        [
            'enabled' => false,
            'channelName' => '',
            'channelId' => '',
            'pageTitle' => 'YouTube — ताज़ा वीडियो',
            'maxVideos' => 24,
            'cacheMinutes' => 45,
            'videos' => [],
            'fetchedAt' => '',
            'lastError' => '',
        ],
        $site['youtubeChannel'] ?? []
    );
    unset($site['youtubeGallery'], $site['youtubePlaylist']);
    $site['emergencyMessage'] = array_merge(
        [
            'enabled' => false,
            'text' => '',
            'url' => '',
            'speed' => 20,
        ],
        $site['emergencyMessage'] ?? []
    );
    return $site;
}

function nitv_hash_password(string $password, string $salt): string {
    return hash_pbkdf2('sha256', $password, $salt, 100000, 64);
}

function nitv_ensure_auth(array &$site): void {
    if (!empty($site['auth']['passwordHash']) && !empty($site['auth']['passwordSalt'])) {
        return;
    }
    $salt = bin2hex(random_bytes(16));
    $site['auth']['passwordHash'] = nitv_hash_password(NITV_DEFAULT_PASSWORD, $salt);
    $site['auth']['passwordSalt'] = $salt;
    $site['auth']['hashAlgo'] = 'pbkdf2';
    $site['auth']['username'] = $site['auth']['username'] ?? 'admin';
    nitv_write_site($site);
}

function nitv_h(string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function nitv_tpl(string $file): string {
    return file_get_contents(NITV_TPL . '/' . $file);
}

function nitv_replace(string $html, array $vars): string {
    foreach ($vars as $k => $v) {
        $html = str_replace('{{' . $k . '}}', (string)$v, $html);
    }
    return $html;
}

function nitv_cat_name(array $site, string $id): string {
    foreach ($site['categories'] as $c) {
        if ($c['id'] === $id) return $c['name'];
    }
    return '';
}

function nitv_sorted_articles(array $articles): array {
    usort($articles, function ($a, $b) {
        if (!empty($a['featured']) && empty($b['featured'])) return -1;
        if (empty($a['featured']) && !empty($b['featured'])) return 1;
        return strcmp($b['publishedAt'] ?? '', $a['publishedAt'] ?? '');
    });
    return $articles;
}

function nitv_social_icons(array $social, string $class = 'social-icon-link'): string {
    $icons = [
        'facebook' => '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.02 10.125 11.91v-8.385H7.078v-3.525h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.525h-2.796v8.385C19.612 23.093 24 18.027 24 12.073z"/></svg>',
        'twitter' => '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
        'youtube' => '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
        'instagram' => '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
        'whatsapp' => '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>',
    ];
    $html = '';
    foreach ($icons as $key => $svg) {
        if (empty($social[$key])) continue;
        $href = $social[$key];
        if ($key === 'whatsapp' && !str_starts_with($href, 'http')) {
            $href = 'https://wa.me/' . preg_replace('/\D/', '', $href);
        }
        $html .= '<a class="' . nitv_h($class) . '" href="' . nitv_h($href) . '" target="_blank" rel="noopener">' . $svg . '</a>';
    }
    return $html;
}

function nitv_darken(string $hex, int $pct = 12): string {
    $h = ltrim($hex, '#');
    if (strlen($h) !== 6) return '#9e1830';
    $r = max(0, hexdec(substr($h, 0, 2)) - round(255 * $pct / 100));
    $g = max(0, hexdec(substr($h, 2, 2)) - round(255 * $pct / 100));
    $b = max(0, hexdec(substr($h, 4, 2)) - round(255 * $pct / 100));
    return sprintf('#%02x%02x%02x', $r, $g, $b);
}

function nitv_ads(array $site, string $pageType): array {
    $ads = $site['ads'] ?? [];
    $map = ['home' => 'showOnHome', 'article' => 'showOnArticle', 'privacy' => 'showOnPrivacy', 'contact' => 'showOnContact', 'live' => 'showOnHome', 'youtube' => 'showOnHome', 'category' => 'showOnHome'];
    $key = $map[$pageType] ?? 'showOnHome';
    if (empty($ads[$key])) return ['head' => '', 'slot' => ''];
    $slot = !empty($ads['googleBodySlot']) ? '<div class="ad-slot">' . $ads['googleBodySlot'] . '</div>' : '';
    return ['head' => $ads['googleHeadScript'] ?? '', 'slot' => $slot];
}

function nitv_render_header_banner(array $site): string {
    $hb = $site['ads']['headerBanner'] ?? [];
    if (empty($hb['enabled']) || empty($hb['slides'])) {
        return '';
    }
    
    $slidesHtml = '';
    foreach ($hb['slides'] as $i => $slide) {
        $imgUrl = nitv_h(nitv_media_url($slide['imageUrl'] ?? ''));
        $linkUrl = nitv_h($slide['linkUrl'] ?? '');
        $activeClass = $i === 0 ? ' is-active' : '';
        
        if ($linkUrl) {
            $slidesHtml .= '<div class="header-ad-slide' . $activeClass . '"><a href="' . $linkUrl . '" target="_blank" rel="noopener noreferrer"><img src="' . $imgUrl . '" alt="Advertisement"></a></div>';
        } else {
            $slidesHtml .= '<div class="header-ad-slide' . $activeClass . '"><img src="' . $imgUrl . '" alt="Advertisement"></div>';
        }
    }
    
    return '<div class="header-ad-slider">' . $slidesHtml . '<div class="header-ad-dots"></div></div>';
}

function nitv_upload_dir(): string {
    return NITV_ROOT . '/public/uploads';
}

function nitv_save_upload_buffer(string $buffer, string $mime, string $subPath): ?string {
    $max = 4 * 1024 * 1024;
    if (strlen($buffer) > $max) return null;
    $exts = ['image/jpeg' => '.jpg', 'image/png' => '.png', 'image/webp' => '.webp', 'image/gif' => '.gif'];
    if (!isset($exts[$mime])) return null;
    $dir = nitv_upload_dir();
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $articlesDir = $dir . '/articles';
    if (!is_dir($articlesDir)) mkdir($articlesDir, 0755, true);
    $file = $dir . '/' . $subPath . $exts[$mime];
    $parent = dirname($file);
    if (!is_dir($parent)) mkdir($parent, 0755, true);
    file_put_contents($file, $buffer);
    return '/public/uploads/' . str_replace('\\', '/', $subPath) . $exts[$mime];
}

function nitv_parse_data_url(string $raw): ?array {
    $raw = trim($raw);
    if ($raw === '') return null;
    if (preg_match('#^data:(image/[a-z+]+);base64,(.+)$#i', $raw, $m)) {
        return ['mime' => strtolower($m[1]), 'buffer' => base64_decode($m[2], true)];
    }
    $bin = base64_decode($raw, true);
    return $bin ? ['mime' => 'image/jpeg', 'buffer' => $bin] : null;
}

function nitv_save_logo_base64(string $data): ?string {
    $parsed = nitv_parse_data_url($data);
    if (!$parsed) return null;
    foreach (glob(nitv_upload_dir() . '/logo.*') as $old) {
        @unlink($old);
    }
    return nitv_save_upload_buffer($parsed['buffer'], $parsed['mime'], 'logo');
}

function nitv_save_article_base64(string $data, string $articleId): ?string {
    $parsed = nitv_parse_data_url($data);
    if (!$parsed) return null;
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '', $articleId ?: 'art') . '_' . bin2hex(random_bytes(4));
    return nitv_save_upload_buffer($parsed['buffer'], $parsed['mime'], 'articles/' . $name);
}

function nitv_save_uploaded_file(array $file, string $subPath): ?string {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) return null;
    $mime = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
    $buffer = file_get_contents($file['tmp_name']);
    if ($buffer === false) return null;
    return nitv_save_upload_buffer($buffer, $mime, $subPath);
}

function nitv_media_url(string $url): string {
    $url = trim($url);
    if ($url === '') return '';
    if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) return $url;
    return nitv_asset(ltrim($url, '/'));
}

function nitv_layout(array $site, string $content, array $opts = []): string {
    $s = $site['settings'];
    $accent = $s['accentColor'] ?? '#c41e3a';
    $pageType = $opts['pageType'] ?? 'home';
    $ad = nitv_ads($site, $pageType);
    $active = $opts['activeUrl'] ?? '';

    $menu = '';
    foreach ($site['menu'] as $m) {
        $cls = [];
        if (($m['url'] ?? '') === '/live') $cls[] = 'menu-live';
        if ($active === ($m['url'] ?? '')) $cls[] = 'active';
        $ca = $cls ? ' class="' . implode(' ', $cls) . '"' : '';
        $inner = nitv_menu_link_inner($m['url'] ?? '/', nitv_h($m['label']));
        $menu .= '<li><a href="' . nitv_h(nitv_url($m['url'])) . '"' . $ca . '>' . $inner . '</a></li>';
    }
    $top = '';
    foreach ($site['topLinks'] as $m) {
        $inner = nitv_menu_link_inner($m['url'] ?? '/', nitv_h($m['label']));
        $top .= '<li><a href="' . nitv_h(nitv_url($m['url'])) . '">' . $inner . '</a></li>';
    }
    $breaking = nitv_render_breaking_ticker($site);
    $social = nitv_social_icons($s['social'] ?? []);
    $css = nitv_asset('public/css/style.css');
    $footer = '<a href="' . nitv_h(nitv_url('/contact')) . '">संपर्क</a><a href="' . nitv_h(nitv_url('/privacy')) . '">गोपनीयता</a><a href="' . nitv_h(nitv_url('/live')) . '">LIVE</a>';

    $logoUrl = trim($s['logoUrl'] ?? '');
    $logoHtml = $logoUrl
        ? '<a class="logo logo-image-link" href="' . nitv_h(nitv_url('/')) . '"><img class="site-logo" src="' . nitv_h(nitv_media_url($logoUrl)) . '" alt="' . nitv_h($s['siteName']) . '"></a>'
        : '<a class="logo" href="' . nitv_h(nitv_url('/')) . '">' . nitv_h($s['siteName']) . '</a>';

    return nitv_replace(nitv_tpl('layout.html'), [
        'PAGE_TITLE' => nitv_h($opts['title'] ?? $s['siteName']),
        'META_TAGS' => $opts['metaTags'] ?? '',
        'ACCENT_COLOR' => nitv_h($accent),
        'ACCENT_DARK' => nitv_h(nitv_darken($accent)),
        'DATE_STR' => nitv_h(date('l, j F Y')),
        'SITE_NAME' => nitv_h($s['siteName']),
        'LOGO_HTML' => $logoHtml,
        'TAGLINE' => nitv_h($s['tagline'] ?? ''),
        'BREAKING_LABEL' => $breaking['label'],
        'BREAKING_TRACK' => $breaking['track'],
        'MENU_ITEMS' => $menu,
        'TOP_LINKS' => $top,
        'SOCIAL_LINKS' => $social,
        'SOCIAL_FOOTER' => nitv_social_icons($s['social'] ?? [], 'social-icon-link footer-icon'),
        'FOOTER_LINKS' => $footer,
        'MAIN_CONTENT' => $content,
        'ADMIN_LINK' => '<a class="btn-primary" href="' . nitv_h(nitv_url('/admin')) . '">संपादन पैनल</a>',
        'GOOGLE_ADS_HEAD' => $ad['head'],
        'AD_SLOT' => $ad['slot'],
        'HEADER_AD_BANNER' => nitv_render_header_banner($site),
        'EXTRA_SCRIPTS' => str_replace('/public/', nitv_asset('public/'), $opts['extraScripts'] ?? ''),
        'LAYOUT_CSS' => nitv_asset('public/css/style.css'),
    ]);
}

function nitv_card(array $site, array $a): string {
    $img = nitv_media_url($a['imageUrl'] ?? '');
    return '<article class="news-card"><a href="' . nitv_h(nitv_url('/article/' . $a['slug'])) . '" class="card-link">
      <img class="card-image" src="' . nitv_h($img) . '" alt="">
      <div class="card-body"><span class="category-badge">' . nitv_h(nitv_cat_name($site, $a['categoryId'])) . '</span>
      <h3 class="card-title">' . nitv_h($a['title']) . '</h3>
      <p class="card-meta"><time>' . nitv_h($a['publishedAt'] ?? '') . '</time></p></div></a></article>';
}

function nitv_share(array $site, array $article, string $canonical): string {
    $url = rawurlencode($canonical);
    $title = rawurlencode($article['title']);
    $text = rawurlencode($article['title'] . ' — ' . $site['settings']['siteName']);
    return '<div class="share-bar"><span class="share-label">शेयर करें:</span>
      <a class="share-btn share-wa" href="https://wa.me/?text=' . $text . '%20' . $url . '" target="_blank">WhatsApp</a>
      <a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=' . $url . '" target="_blank">Facebook</a>
      <a class="share-btn share-x" href="https://twitter.com/intent/tweet?url=' . $url . '&text=' . $title . '" target="_blank">X</a>
      <button type="button" class="share-btn share-copy" data-copy-url="' . nitv_h($canonical) . '">लिंक कॉपी</button></div>';
}

function nitv_verify(string $pass, string $hash, string $salt): bool {
    return hash_equals($hash, nitv_hash_password($pass, $salt));
}

function nitv_check_login(array $site, string $user, string $pass): bool {
    $user = trim($user);
    $pass = (string) $pass;
    if ($user !== trim($site['auth']['username'] ?? 'admin')) {
        return false;
    }
    return nitv_verify($pass, $site['auth']['passwordHash'], $site['auth']['passwordSalt']);
}

function nitv_require_admin(): void {
    if (empty($_SESSION['nitv_admin'])) {
        header('Location: ' . nitv_url('/admin/login'));
        exit;
    }
}

function nitv_admin_tpl(string $name, array $vars): string {
    $html = nitv_tpl('admin/' . $name);
    $html = str_replace('href="/public/', 'href="' . nitv_h(nitv_asset('public/')), $html);
    $html = str_replace('src="/public/', 'src="' . nitv_h(nitv_asset('public/')), $html);
    foreach ($vars as $k => $v) {
        $html = str_replace('{{' . $k . '}}', (string)$v, $html);
    }
    $html = preg_replace_callback('#(href|action)="(/[^"]+)"#', function ($m) {
        return $m[1] . '="' . nitv_h(nitv_url($m[2])) . '"';
    }, $html);
    return $html;
}

require_once __DIR__ . '/icons.php';
require_once __DIR__ . '/rss.php';
require_once __DIR__ . '/home-ui.php';
require_once __DIR__ . '/youtube.php';

function nitv_render_news_feed(array $site, array $articles): string {
    if (empty($articles)) return '';
    
    $cards = '';
    foreach ($articles as $article) {
        $category = nitv_cat_name($site, $article['categoryId'] ?? '');
        $date = date('d M Y', strtotime($article['publishedAt'] ?? 'now'));
        $articleUrl = nitv_url('/article/' . ($article['slug'] ?? ''));
        $articleTitle = nitv_h($article['title'] ?? '');
        $articleImage = nitv_h(nitv_media_url($article['imageUrl'] ?? ''));
        
        $cards .= '<article class="news-feed-card" onclick="window.location.href=\'' . nitv_h($articleUrl) . '\'">
      <div class="news-feed-content">
        <span class="news-feed-category">' . nitv_h($category) . '</span>
        <h3 class="news-feed-headline">' . $articleTitle . '</h3>
        <div class="news-feed-meta">
          <time>' . nitv_h($date) . '</time>
        </div>
        <div class="news-feed-share-icons">
          <button class="news-feed-share-btn" title="Share on Facebook" onclick="event.stopPropagation(); shareArticle(\'facebook\', \'' . nitv_h($articleUrl) . '\')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </button>
          <button class="news-feed-share-btn" title="Share on X" onclick="event.stopPropagation(); shareArticle(\'twitter\', \'' . nitv_h($articleUrl) . '\')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </button>
          <button class="news-feed-share-btn" title="Copy Link" onclick="event.stopPropagation(); copyArticleLink(\'' . nitv_h($articleUrl) . '\', \'' . $articleTitle . '\', \'' . $articleImage . '\')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
        </div>
      </div>
      <div class="news-feed-thumbnail-wrapper">
        <img src="' . $articleImage . '" alt="' . $articleTitle . '" loading="lazy">
      </div>
    </article>';
    }
    
    return '<section class="news-feed-section">
    <header class="news-feed-header">
      <h2 class="news-feed-title">ताज़ा समाचार</h2>
    </header>
    <div class="news-feed-list">
      ' . $cards . '
    </div>
    <button class="news-feed-load-more" id="loadMoreNews">और खबरें देखें</button>
  </section>
  <script>
    function shareArticle(platform, url) {
      const shareUrl = encodeURIComponent(url);
      if (platform === \'facebook\') {
        window.open(\'https://www.facebook.com/sharer/sharer.php?u=\' + shareUrl, \'_blank\');
      } else if (platform === \'twitter\') {
        window.open(\'https://twitter.com/intent/tweet?url=\' + shareUrl, \'_blank\');
      }
    }
    function copyArticleLink(url, title, imageUrl) {
      const message = title + \'\\n\\n\' + url + \'\\n\\n\' + imageUrl;
      navigator.clipboard.writeText(message).then(() => {
        alert(\'लिंक और इमेज कॉपी हो गया!\');
      });
    }
  </script>';
}

function nitv_render_emergency_banner(array $site): string {
    $emergency = $site['emergencyMessage'] ?? [];
    if (empty($emergency['enabled']) || empty($emergency['text'])) {
        return '';
    }
    
    $text = nitv_h($emergency['text'] ?? '');
    $url = nitv_h($emergency['url'] ?? '');
    $speed = (int)($emergency['speed'] ?? 20);
    
    if ($url) {
        return '<div class="emergency-banner"><div class="emergency-banner-wrap" style="animation-duration:' . $speed . 's"><span class="emergency-banner-text"><a href="' . $url . '" class="emergency-link">' . $text . '</a></span></div></div>';
    } else {
        return '<div class="emergency-banner"><div class="emergency-banner-wrap" style="animation-duration:' . $speed . 's"><span class="emergency-banner-text">' . $text . '</span></div></div>';
    }
}
