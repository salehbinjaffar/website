<?php
declare(strict_types=1);
/**
 * Apache / cPanel entry point (public_html).
 * Upload the FULL project folder — not only public/css.
 */
require __DIR__ . '/php/bootstrap.php';

$site = nitv_read_site();
nitv_ensure_auth($site);
$site = nitv_read_site();

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$base = nitv_base_path();
if ($base !== '' && str_starts_with($path, $base)) {
    $path = substr($path, strlen($base)) ?: '/';
}
$path = '/' . trim($path, '/');
if ($path === '//') $path = '/';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function nitv_parse_menu(array $post, string $prefix): array {
    $items = [];
    foreach ($post as $key => $val) {
        if (preg_match('/^' . preg_quote($prefix, '/') . '_label_(\d+)$/', $key, $m)) {
            $i = (int)$m[1];
            $label = trim((string)$val);
            if ($label !== '') {
                $items[] = ['label' => $label, 'url' => $post[$prefix . '_url_' . $i] ?? '/'];
            }
        }
    }
    return $items;
}

function nitv_format_body(string $text): string {
    $t = trim($text);
    if ($t === '') return '';
    if (preg_match('/<[a-z][\s\S]*>/i', $t)) return $t;
    $out = '';
    foreach (preg_split('/\n\n+/', $t) as $p) {
        $p = trim($p);
        if ($p === '') continue;
        if (str_starts_with($p, '## ')) {
            $out .= '<h2>' . nitv_h(substr($p, 3)) . '</h2>';
        } else {
            $out .= '<p>' . nitv_h($p) . '</p>';
        }
    }
    return $out;
}

// --- Admin ---
if (str_starts_with($path, '/admin')) {
    if ($path === '/admin/login' && $method === 'GET') {
        $err = isset($_GET['error']) ? '<p class="error">गलत यूज़रनेम या पासवर्ड</p>' : '';
        echo nitv_admin_tpl('login.html', [
            'ERROR' => $err,
            'LOGIN_ACTION' => nitv_url('/admin/login'),
            'HOME_LINK' => nitv_url('/'),
        ]);
        exit;
    }
    if ($path === '/admin/login' && $method === 'POST') {
        $site = nitv_read_site();
        if (nitv_check_login($site, $_POST['username'] ?? '', $_POST['password'] ?? '')) {
            nitv_session_start();
            session_regenerate_id(true);
            $_SESSION['nitv_admin'] = true;
            header('Location: ' . nitv_url('/admin'));
        } else {
            header('Location: ' . nitv_url('/admin/login?error=1'));
        }
        exit;
    }
    if ($path === '/admin/logout') {
        unset($_SESSION['nitv_admin']);
        header('Location: ' . nitv_url('/admin/login'));
        exit;
    }

    nitv_require_admin();

    if ($path === '/admin/youtube') {
        if ($method === 'POST') {
            $norm = nitv_normalize_channel_input($_POST['channelName'] ?? '');
            $prev = $site['youtubeChannel'] ?? [];
            $site['youtubeChannel'] = [
                'enabled' => isset($_POST['youtubeEnabled']),
                'pageTitle' => trim($_POST['pageTitle'] ?? 'YouTube — ताज़ा वीडियो') ?: 'YouTube — ताज़ा वीडियो',
                'channelName' => $norm['channelName'] ?: trim(ltrim($_POST['channelName'] ?? '', '@')),
                'channelId' => $norm['channelId'] ?: ($prev['channelId'] ?? ''),
                'maxVideos' => min(50, max(6, (int)($_POST['maxVideos'] ?? 24))),
                'cacheMinutes' => min(360, max(15, (int)($_POST['cacheMinutes'] ?? 45))),
                'videos' => $prev['videos'] ?? [],
                'fetchedAt' => $prev['fetchedAt'] ?? '',
                'lastError' => $prev['lastError'] ?? '',
            ];
            unset($site['youtubeGallery'], $site['youtubePlaylist']);
            if (!empty($site['youtubeChannel']['enabled'])) {
                nitv_refresh_youtube_channel($site, isset($_POST['refreshYoutube']));
            }
            nitv_write_site($site);
            $q = isset($_POST['refreshYoutube']) ? '?saved=1&refreshed=1' : '?saved=1';
            header('Location: ' . nitv_url('/admin/youtube' . $q));
            exit;
        }
        $y = $site['youtubeChannel'] ?? [];
        $msg = isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '';
        if (isset($_GET['refreshed'])) {
            $msg .= "<p class='ok'>वीडियो अपडेट हो गए।</p>";
        }
        echo nitv_admin_tpl('youtube.html', [
            'ENABLED' => !empty($y['enabled']) ? 'checked' : '',
            'PAGE_TITLE' => nitv_h($y['pageTitle'] ?? 'YouTube — ताज़ा वीडियो'),
            'CHANNEL_NAME' => nitv_h($y['channelName'] ?? ''),
            'MAX_VIDEOS' => (string)($y['maxVideos'] ?? 24),
            'CACHE_MINUTES' => (string)($y['cacheMinutes'] ?? 45),
            'STATUS' => nitv_youtube_channel_status_html($site),
            'MESSAGE' => $msg,
        ]);
        exit;
    }

    if ($path === '/admin' && $method === 'GET') {
        echo nitv_admin_tpl('dashboard.html', [
            'SITE_NAME' => $site['settings']['siteName'],
            'ARTICLE_COUNT' => (string)count($site['articles']),
            'CATEGORY_COUNT' => (string)count($site['categories']),
        ]);
        exit;
    }

    if ($path === '/admin/settings') {
        if ($method === 'POST') {
            if (isset($_POST['removeLogo'])) {
                $site['settings']['logoUrl'] = '';
            } elseif (!empty($_POST['logoBase64'])) {
                $logoPath = nitv_save_logo_base64($_POST['logoBase64']);
                if ($logoPath) $site['settings']['logoUrl'] = $logoPath;
            }
            $site['settings']['siteName'] = $_POST['siteName'] ?? $site['settings']['siteName'];
            $site['settings']['tagline'] = $_POST['tagline'] ?? '';
            $site['settings']['breakingText'] = $_POST['breakingText'] ?? '';
            $site['settings']['accentColor'] = $_POST['accentColor'] ?? '#c41e3a';
            $site['settings']['social'] = [
                'facebook' => $_POST['facebook'] ?? '',
                'twitter' => $_POST['twitter'] ?? '',
                'youtube' => $_POST['youtube'] ?? '',
                'instagram' => $_POST['instagram'] ?? '',
                'whatsapp' => $_POST['whatsapp'] ?? '',
            ];
            if (!empty($_POST['username'])) $site['auth']['username'] = $_POST['username'];
            if (!empty($_POST['newPassword']) && strlen($_POST['newPassword']) >= 6) {
                if (nitv_verify($_POST['currentPassword'] ?? '', $site['auth']['passwordHash'], $site['auth']['passwordSalt'])) {
                    $salt = bin2hex(random_bytes(16));
                    $site['auth']['passwordSalt'] = $salt;
                    $site['auth']['passwordHash'] = nitv_hash_password($_POST['newPassword'], $salt);
                    $site['auth']['hashAlgo'] = 'pbkdf2';
                }
            }
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/settings?saved=1'));
            exit;
        }
        $s = $site['settings'];
        echo nitv_admin_tpl('settings.html', [
            'SITE_NAME' => nitv_h($s['siteName']),
            'TAGLINE' => nitv_h($s['tagline'] ?? ''),
            'BREAKING_TEXT' => nitv_h($s['breakingText'] ?? ''),
            'ACCENT_COLOR' => nitv_h($s['accentColor'] ?? '#c41e3a'),
            'FACEBOOK' => nitv_h($s['social']['facebook'] ?? ''),
            'TWITTER' => nitv_h($s['social']['twitter'] ?? ''),
            'YOUTUBE' => nitv_h($s['social']['youtube'] ?? ''),
            'INSTAGRAM' => nitv_h($s['social']['instagram'] ?? ''),
            'WHATSAPP' => nitv_h($s['social']['whatsapp'] ?? ''),
            'USERNAME' => nitv_h($site['auth']['username'] ?? 'admin'),
            'LOGO_PREVIEW' => !empty($s['logoUrl'])
                ? '<img id="logo-preview" class="upload-preview" src="' . nitv_h(nitv_media_url($s['logoUrl'])) . '" alt="Logo">'
                : '<img id="logo-preview" class="upload-preview" style="display:none" alt="">',
            'MESSAGE' => isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '',
        ]);
        exit;
    }

    if ($path === '/admin/home-features') {
        if ($method === 'POST') {
            $speed = (int)($_POST['breakingSpeed'] ?? 35);
            if ($speed < 15) $speed = 15;
            if ($speed > 120) $speed = 120;
            $rssPrev = $site['breaking']['rss'] ?? [];
            $site['breaking'] = [
                'label' => trim($_POST['breakingLabel'] ?? 'ब्रेकिंग'),
                'speed' => $speed,
                'items' => nitv_parse_breaking_post($_POST),
                'rss' => [
                    'enabled' => isset($_POST['rssEnabled']),
                    'maxItems' => min(30, max(3, (int)($_POST['rssMaxItems'] ?? 12))),
                    'cacheMinutes' => min(360, max(5, (int)($_POST['rssCacheMinutes'] ?? 20))),
                    'mergeManual' => isset($_POST['rssMergeManual']),
                    'feeds' => nitv_rss_parse_feed_urls($_POST),
                    'items' => $rssPrev['items'] ?? [],
                    'fetchedAt' => $rssPrev['fetchedAt'] ?? '',
                    'lastError' => $rssPrev['lastError'] ?? '',
                ],
            ];
            $site['slider'] = nitv_parse_slider_post($_POST);
            $site['emergencyMessage'] = [
                'enabled' => isset($_POST['emergencyEnabled']),
                'text' => trim($_POST['emergencyText'] ?? ''),
                'url' => trim($_POST['emergencyUrl'] ?? ''),
                'speed' => min(60, max(10, (int)($_POST['emergencySpeed'] ?? 20))),
            ];
            unset($site['youtubeGallery'], $site['youtubePlaylist']);
            if (!empty($site['breaking']['rss']['enabled'])) {
                nitv_rss_refresh($site, isset($_POST['refreshRss']));
            }
            nitv_write_site($site);
            $q = isset($_POST['refreshRss']) ? '?saved=1&refreshed=1' : '?saved=1';
            header('Location: ' . nitv_url('/admin/home-features' . $q));
            exit;
        }
        $b = $site['breaking'] ?? [];
        $rss = $b['rss'] ?? [];
        $emergency = $site['emergencyMessage'] ?? [];
        $msg = isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '';
        if (isset($_GET['refreshed'])) {
            $msg .= "<p class='ok'>RSS फ़ीड अपडेट हो गई।</p>";
        }
        echo nitv_admin_tpl('home-features.html', [
            'BREAKING_LABEL' => nitv_h($b['label'] ?? 'ब्रेकिंग'),
            'BREAKING_SPEED' => (string)($b['speed'] ?? 35),
            'RSS_ENABLED' => !empty($rss['enabled']) ? 'checked' : '',
            'RSS_MAX_ITEMS' => (string)($rss['maxItems'] ?? 12),
            'RSS_CACHE_MINUTES' => (string)($rss['cacheMinutes'] ?? 20),
            'RSS_MERGE_MANUAL' => !empty($rss['mergeManual']) ? 'checked' : '',
            'RSS_FEED_ROWS' => nitv_rss_feed_rows($site),
            'RSS_STATUS' => nitv_rss_status_html($site),
            'BREAKING_ROWS' => nitv_breaking_editor_rows($site),
            'SLIDER_ROWS' => nitv_slider_editor_rows($site),
            'EMERGENCY_ENABLED' => !empty($emergency['enabled']) ? 'checked' : '',
            'EMERGENCY_TEXT' => nitv_h($emergency['text'] ?? ''),
            'EMERGENCY_URL' => nitv_h($emergency['url'] ?? ''),
            'EMERGENCY_SPEED' => (string)($emergency['speed'] ?? 20),
            'MESSAGE' => $msg,
        ]);
        exit;
    }

    if ($path === '/admin/menu') {
        if ($method === 'POST') {
            $menu = nitv_parse_menu($_POST, 'menu');
            $top = nitv_parse_menu($_POST, 'top');
            if ($menu) $site['menu'] = $menu;
            if ($top) $site['topLinks'] = $top;
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/menu?saved=1'));
            exit;
        }
        $mrows = $trows = '';
        foreach ($site['menu'] as $i => $m) {
            $mrows .= '<tr><td><input name="menu_label_' . $i . '" value="' . nitv_h($m['label']) . '"></td>
              <td><input name="menu_url_' . $i . '" value="' . nitv_h($m['url']) . '"></td>
              <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
        }
        foreach ($site['topLinks'] as $i => $m) {
            $trows .= '<tr><td><input name="top_label_' . $i . '" value="' . nitv_h($m['label']) . '"></td>
              <td><input name="top_url_' . $i . '" value="' . nitv_h($m['url']) . '"></td>
              <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
        }
        echo nitv_admin_tpl('menu.html', [
            'MENU_ROWS' => $mrows, 'TOP_ROWS' => $trows,
            'MENU_COUNT' => (string)count($site['menu']),
            'TOP_COUNT' => (string)count($site['topLinks']),
            'MESSAGE' => isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '',
        ]);
        exit;
    }

    if ($path === '/admin/pages') {
        if ($method === 'POST') {
            $site['pages']['contact'] = ['title' => $_POST['contactTitle'] ?? 'संपर्क', 'body' => nitv_format_body($_POST['contactBody'] ?? '')];
            $site['pages']['privacy'] = ['title' => $_POST['privacyTitle'] ?? 'गोपनीयता', 'body' => nitv_format_body($_POST['privacyBody'] ?? '')];
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/pages?saved=1'));
            exit;
        }
        $strip = fn($html) => strip_tags(str_replace(['</p>', '<p>', '<h2>'], ["\n", '', "\n## "], $html));
        echo nitv_admin_tpl('pages.html', [
            'CONTACT_TITLE' => nitv_h($site['pages']['contact']['title']),
            'CONTACT_BODY' => nitv_h($strip($site['pages']['contact']['body'])),
            'PRIVACY_TITLE' => nitv_h($site['pages']['privacy']['title']),
            'PRIVACY_BODY' => nitv_h($strip($site['pages']['privacy']['body'])),
            'MESSAGE' => isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '',
        ]);
        exit;
    }

    if ($path === '/admin/live') {
        if ($method === 'POST') {
            $site['live'] = [
                'enabled' => isset($_POST['enabled']),
                'tabLabel' => $_POST['tabLabel'] ?? 'LIVE',
                'title' => $_POST['title'] ?? 'लाइव',
                'hlsUrl' => trim($_POST['hlsUrl'] ?? ''),
                'posterUrl' => trim($_POST['posterUrl'] ?? ''),
            ];
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/live?saved=1'));
            exit;
        }
        $l = $site['live'];
        echo nitv_admin_tpl('live.html', [
            'ENABLED' => !empty($l['enabled']) ? 'checked' : '',
            'TAB_LABEL' => nitv_h($l['tabLabel'] ?? 'LIVE'),
            'TITLE' => nitv_h($l['title'] ?? ''),
            'HLS_URL' => nitv_h($l['hlsUrl'] ?? ''),
            'POSTER_URL' => nitv_h($l['posterUrl'] ?? ''),
            'MESSAGE' => isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '',
        ]);
        exit;
    }

    if ($path === '/admin/ads') {
        if ($method === 'POST') {
            // Parse header banner slides
            $headerBannerSlides = [];
            if (isset($_POST['headerBannerSlides']) && is_array($_POST['headerBannerSlides'])) {
                foreach ($_POST['headerBannerSlides'] as $i => $slide) {
                    $imageUrl = '';
                    // Handle file upload
                    if (isset($_FILES['headerBannerSlides']['name'][$i]['imageFile']) && 
                        !empty($_FILES['headerBannerSlides']['name'][$i]['imageFile'])) {
                        $file = [
                            'name' => $_FILES['headerBannerSlides']['name'][$i]['imageFile'],
                            'type' => $_FILES['headerBannerSlides']['type'][$i]['imageFile'],
                            'tmp_name' => $_FILES['headerBannerSlides']['tmp_name'][$i]['imageFile'],
                            'error' => $_FILES['headerBannerSlides']['error'][$i]['imageFile'],
                            'size' => $_FILES['headerBannerSlides']['size'][$i]['imageFile'],
                        ];
                        $uploaded = nitv_save_uploaded_file($file, 'header-banner/' . uniqid('hb_'));
                        if ($uploaded) {
                            $imageUrl = $uploaded;
                        }
                    }
                    // Use URL if no file uploaded
                    if (empty($imageUrl) && !empty($slide['imageUrl'])) {
                        $imageUrl = trim($slide['imageUrl']);
                    }
                    // Keep existing URL if neither file nor new URL provided
                    if (empty($imageUrl) && isset($hb['slides'][$i]['imageUrl'])) {
                        $imageUrl = $hb['slides'][$i]['imageUrl'];
                    }
                    
                    if (!empty($imageUrl)) {
                        $headerBannerSlides[] = [
                            'imageUrl' => $imageUrl,
                            'linkUrl' => trim($slide['linkUrl'] ?? ''),
                        ];
                    }
                }
            }

            $site['ads'] = [
                'googleHeadScript' => $_POST['headScript'] ?? '',
                'googleBodySlot' => $_POST['bodySlot'] ?? '',
                'showOnHome' => isset($_POST['showOnHome']),
                'showOnArticle' => isset($_POST['showOnArticle']),
                'showOnPrivacy' => isset($_POST['showOnPrivacy']),
                'showOnContact' => isset($_POST['showOnContact']),
                'headerBanner' => [
                    'enabled' => isset($_POST['headerBannerEnabled']),
                    'slides' => $headerBannerSlides,
                ],
            ];
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/ads?saved=1'));
            exit;
        }
        $a = $site['ads'];
        $hb = $a['headerBanner'] ?? [];
        $slidesHtml = '';
        foreach ($hb['slides'] ?? [] as $i => $slide) {
            $slidesHtml .= '<div class="slide-item">
              <h4>स्लाइड ' . ($i + 1) . '</h4>
              <label>छवि अपलोड करें (728x90)</label>
              <input type="file" name="headerBannerSlides[' . $i . '][imageFile]" accept="image/*" onchange="previewImage(this)">
              <div class="image-preview" id="preview-' . $i . '" style="display:none; margin: 0.5rem 0;">
                <img style="max-width: 100%; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">
              </div>';
            if (!empty($slide['imageUrl'])) {
                $slidesHtml .= '<div style="margin: 0.5rem 0;">
                  <small>वर्तमान छवि:</small><br>
                  <img src="' . nitv_h(nitv_media_url($slide['imageUrl'])) . '" style="max-width: 100%; max-height: 60px; border: 1px solid #ddd; border-radius: 4px; margin-top: 0.25rem;">
                </div>';
            }
            $slidesHtml .= '<label>या छवि URL (वैकल्पिक)</label>
              <input type="text" name="headerBannerSlides[' . $i . '][imageUrl]" value="' . nitv_h($slide['imageUrl']) . '" placeholder="https://example.com/ad-728x90.jpg">
              <label>लिंक URL (वैकल्पिक)</label>
              <input type="text" name="headerBannerSlides[' . $i . '][linkUrl]" value="' . nitv_h($slide['linkUrl'] ?? '') . '" placeholder="https://example.com">
              <button type="button" class="remove-slide" onclick="this.parentElement.remove()">हटाएं</button>
            </div>';
        }
        echo nitv_admin_tpl('ads.html', [
            'HEAD_SCRIPT' => htmlspecialchars($a['googleHeadScript'] ?? '', ENT_NOQUOTES),
            'BODY_SLOT' => htmlspecialchars($a['googleBodySlot'] ?? '', ENT_NOQUOTES),
            'SHOW_HOME' => !empty($a['showOnHome']) ? 'checked' : '',
            'SHOW_ARTICLE' => !empty($a['showOnArticle']) ? 'checked' : '',
            'SHOW_PRIVACY' => !empty($a['showOnPrivacy']) ? 'checked' : '',
            'SHOW_CONTACT' => !empty($a['showOnContact']) ? 'checked' : '',
            'HEADER_BANNER_ENABLED' => !empty($hb['enabled']) ? 'checked' : '',
            'HEADER_BANNER_SLIDES' => $slidesHtml,
            'MESSAGE' => isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '',
        ]);
        exit;
    }

    if ($path === '/admin/articles') {
        if ($method === 'POST' && isset($_POST['id']) && !isset($_POST['title'])) {
            $site['articles'] = array_values(array_filter($site['articles'], fn($a) => $a['id'] !== $_POST['id']));
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/articles'));
            exit;
        }
        $rows = '';
        foreach (nitv_sorted_articles($site['articles']) as $a) {
            $rows .= '<tr><td>' . nitv_h(mb_substr($a['title'], 0, 55)) . '</td>
              <td>' . nitv_h(nitv_cat_name($site, $a['categoryId'])) . '</td>
              <td>' . (!empty($a['featured']) ? 'हाँ' : '') . '</td>
              <td><a href="' . nitv_h(nitv_url('/article/' . $a['slug'])) . '" target="_blank">देखें</a> ·
              <a href="' . nitv_h(nitv_url('/admin/articles/edit?id=' . urlencode($a['id']))) . '">संपादित</a></td></tr>';
        }
        echo nitv_admin_tpl('articles.html', [
            'ARTICLE_ROWS' => $rows ?: "<tr><td colspan='4'>कोई खबर नहीं</td></tr>",
            'MESSAGE' => isset($_GET['saved']) ? "<p class='ok'>सेव हो गया</p>" : '',
        ]);
        exit;
    }

    if ($path === '/admin/articles/new' || $path === '/admin/articles/edit') {
        $article = null;
        if ($path === '/admin/articles/edit') {
            foreach ($site['articles'] as $a) {
                if ($a['id'] === ($_GET['id'] ?? '')) { $article = $a; break; }
            }
            if (!$article) { http_response_code(404); echo 'Not found'; exit; }
        }
        if ($method === 'POST' && isset($_POST['title'])) {
            $id = $_POST['id'] ?: ('id_' . bin2hex(random_bytes(6)));
            $slug = trim($_POST['slug'] ?? '') ?: preg_replace('/[^a-z0-9-]+/', '-', strtolower($_POST['title']));
            $body = nitv_format_body($_POST['body'] ?? '');
            $imageUrl = trim($_POST['imageUrl'] ?? '');
            if (!empty($_POST['imageBase64'])) {
                $uploaded = nitv_save_article_base64($_POST['imageBase64'], $id);
                if ($uploaded) $imageUrl = $uploaded;
            }
            $payload = [
                'id' => $id, 'slug' => $slug, 'title' => $_POST['title'],
                'categoryId' => $_POST['categoryId'] ?? '', 'excerpt' => $_POST['excerpt'] ?? '',
                'body' => $body, 'imageUrl' => $imageUrl,
                'publishedAt' => $_POST['publishedAt'] ?? date('Y-m-d'),
                'featured' => isset($_POST['featured']),
            ];
            if ($payload['featured']) {
                foreach ($site['articles'] as &$x) {
                    if ($x['id'] !== $id) $x['featured'] = false;
                }
            }
            $found = false;
            foreach ($site['articles'] as $i => $x) {
                if ($x['id'] === $id) { $site['articles'][$i] = $payload; $found = true; break; }
            }
            if (!$found) array_unshift($site['articles'], $payload);
            nitv_write_site($site);
            header('Location: ' . nitv_url('/admin/articles?saved=1'));
            exit;
        }
        $opts = '';
        foreach ($site['categories'] as $c) {
            $sel = ($article && $article['categoryId'] === $c['id']) ? ' selected' : '';
            $opts .= '<option value="' . nitv_h($c['id']) . '"' . $sel . '>' . nitv_h($c['name']) . '</option>';
        }
        $bodyPlain = $article ? strip_tags(str_replace(['</p>', '<p>'], ["\n\n", ''], $article['body'])) : '';
        $action = $article
            ? nitv_url('/admin/articles/edit?id=' . urlencode($article['id']))
            : nitv_url('/admin/articles/new');
        echo nitv_admin_tpl('article-form.html', [
            'FORM_TITLE' => $article ? 'खबर संपादित करें' : 'नई खबर',
            'ACTION' => $action,
            'ID' => nitv_h($article['id'] ?? ''),
            'TITLE' => nitv_h($article['title'] ?? ''),
            'SLUG' => nitv_h($article['slug'] ?? ''),
            'EXCERPT' => nitv_h($article['excerpt'] ?? ''),
            'BODY' => nitv_h($bodyPlain),
            'IMAGE_URL' => nitv_h($article['imageUrl'] ?? ''),
            'IMAGE_PREVIEW' => !empty($article['imageUrl'])
                ? '<img id="article-image-preview" class="upload-preview" src="' . nitv_h(nitv_media_url($article['imageUrl'])) . '" alt="">'
                : '<img id="article-image-preview" class="upload-preview" style="display:none" alt="">',
            'PUBLISHED_AT' => nitv_h($article['publishedAt'] ?? date('Y-m-d')),
            'FEATURED' => !empty($article['featured']) ? 'checked' : '',
            'CATEGORY_OPTIONS' => $opts,
        ]);
        exit;
    }

    http_response_code(404);
    echo 'Admin page not found';
    exit;
}

// --- Public ---
$site = nitv_read_site_public();
$host = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$canonicalBase = $host . nitv_base_path();

if ($path === '/' || $path === '/index.html') {
    $articles = nitv_sorted_articles($site['articles']);
    $sliderHtml = nitv_render_slider($site, $articles);
    $side = '';
    foreach (array_slice($articles, 0, 4) as $a) {
        $side .= '<article class="compact-card"><a class="compact-link" href="' . nitv_h(nitv_url('/article/' . $a['slug'])) . '"><img class="compact-thumb" src="' . nitv_h(nitv_media_url($a['imageUrl'])) . '"><div class="compact-body"><h3 class="compact-title">' . nitv_h($a['title']) . '</h3></div></a></article>';
    }
    $grid = '';
    foreach (array_slice($articles, 4) as $a) $grid .= nitv_card($site, $a);
    $trend = '';
    foreach (array_slice($articles, 0, 6) as $a) {
        $trend .= '<li><a href="' . nitv_h(nitv_url('/article/' . $a['slug'])) . '">' . nitv_h($a['title']) . '</a></li>';
    }
    $yt = nitv_get_youtube_channel($site);
    $youtubeSection = '';
    if ($yt['enabled'] && !empty($yt['videos'])) {
        $display = $yt['channelName'] !== '' ? '@' . $yt['channelName'] : 'YouTube';
        $videoCards = nitv_render_youtube_video_cards(array_slice($yt['videos'], 0, 6));
        $youtubeSection = '<section class="youtube-section"><header class="youtube-section-header">
          <h2 class="section-title">' . nitv_h($yt['pageTitle']) . '</h2>
          <p class="youtube-channel-label">YouTube चैनल</p>
          <p class="youtube-channel-name">
            <a href="' . nitv_h(nitv_channel_public_url($yt)) . '" target="_blank" rel="noopener noreferrer">' . nitv_h($display) . '</a>
          </p>
          <p class="youtube-channel-hint">नवीनतम वीडियो — थंबनेल पर क्लिक करके YouTube पर देखें।</p>
        </header>
        <div class="youtube-videos-grid">' . $videoCards . '</div></section>';
    }
    $newsFeed = nitv_render_news_feed($site, $sortedArticles);
    $page = nitv_replace(nitv_tpl('home.html'), [
        'SLIDER' => $sliderHtml,
        'SIDE_LIST' => $side,
        'YOUTUBE_SECTION' => $youtubeSection,
        'NEWS_FEED' => $newsFeed,
        'NEWS_GRID' => $grid,
        'TRENDING' => $trend,
    ]);
    echo nitv_layout($site, $page, [
        'title' => $site['settings']['siteName'],
        'pageType' => 'home',
        'extraScripts' => '<script src="' . nitv_h(nitv_asset('public/js/home-slider.js')) . '"></script>',
    ]);
    exit;
}

if ($path === '/contact' || $path === '/privacy') {
    $key = $path === '/contact' ? 'contact' : 'privacy';
    $p = $site['pages'][$key];
    $page = nitv_replace(nitv_tpl('page.html'), ['PAGE_HEADING' => nitv_h($p['title']), 'PAGE_BODY' => $p['body']]);
    echo nitv_layout($site, $page, ['title' => $p['title'], 'activeUrl' => $path, 'pageType' => $key]);
    exit;
}

if ($path === '/live') {
    $l = $site['live'];
    $has = !empty($l['hlsUrl']) ? '' : '<p class="live-placeholder">एडमिन → LIVE में HLS (.m3u8) लिंक जोड़ें</p>';
    $page = nitv_replace(nitv_tpl('live.html'), [
        'LIVE_TITLE' => nitv_h($l['title'] ?? 'लाइव'),
        'HLS_URL' => nitv_h($l['hlsUrl'] ?? ''),
        'POSTER_URL' => nitv_h($l['posterUrl'] ?? ''),
        'HAS_STREAM' => $has,
    ]);
    $scripts = !empty($l['hlsUrl'])
        ? '<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script><script src="' . nitv_h(nitv_asset('public/js/live.js')) . '"></script>'
        : '';
    echo nitv_layout($site, $page, ['title' => 'LIVE', 'activeUrl' => '/live', 'pageType' => 'live', 'extraScripts' => $scripts]);
    exit;
}

if ($path === '/youtube' || $path === '/youtube.html') {
    if (!empty($site['youtubeChannel']['enabled'])) {
        $stamp = ($site['youtubeChannel']['fetchedAt'] ?? '') . '|' . count($site['youtubeChannel']['videos'] ?? []);
        nitv_ensure_youtube_channel($site, false);
        $stampAfter = ($site['youtubeChannel']['fetchedAt'] ?? '') . '|' . count($site['youtubeChannel']['videos'] ?? []);
        if ($stamp !== $stampAfter) {
            nitv_write_site($site);
        }
    }
    $yt = nitv_get_youtube_channel($site);
    $page = nitv_render_youtube_page($site);
    echo nitv_layout($site, $page, [
        'title' => $yt['pageTitle'] . ' — ' . $site['settings']['siteName'],
        'activeUrl' => '/youtube',
        'pageType' => 'youtube',
    ]);
    exit;
}

if (str_starts_with($path, '/article/')) {
    $slug = substr($path, 9);
    $article = null;
    foreach ($site['articles'] as $a) {
        if ($a['slug'] === $slug) { $article = $a; break; }
    }
    if (!$article) { http_response_code(404); echo 'खबर नहीं मिली'; exit; }
    $canonical = $canonicalBase . '/article/' . $slug;
    $meta = '<meta property="og:image" content="' . nitv_h($article['imageUrl']) . '">
      <meta property="og:title" content="' . nitv_h($article['title']) . '">
      <meta property="og:url" content="' . nitv_h($canonical) . '">';
    $share = nitv_share($site, $article, $canonical);
    $page = nitv_replace(nitv_tpl('article.html'), [
        'TITLE' => nitv_h($article['title']),
        'CATEGORY' => nitv_h(nitv_cat_name($site, $article['categoryId'])),
        'CATEGORY_URL' => nitv_h(nitv_url('/category/' . $article['categoryId'])),
        'DATE' => nitv_h($article['publishedAt'] ?? ''),
        'IMAGE' => nitv_h(nitv_media_url($article['imageUrl'] ?? '')),
        'BODY' => $article['body'],
        'SHARE_BUTTONS' => $share,
    ]);
    echo nitv_layout($site, $page, [
        'title' => $article['title'],
        'pageType' => 'article',
        'metaTags' => $meta,
        'extraScripts' => '<script src="' . nitv_h(nitv_asset('public/js/share.js')) . '"></script>',
    ]);
    exit;
}

if (str_starts_with($path, '/category/')) {
    $cid = substr($path, 10);
    $cat = null;
    foreach ($site['categories'] as $c) {
        if ($c['id'] === $cid) { $cat = $c; break; }
    }
    if (!$cat) { http_response_code(404); echo 'श्रेणी नहीं मिली'; exit; }
    $grid = '';
    foreach (nitv_sorted_articles($site['articles']) as $a) {
        if ($a['categoryId'] === $cid) $grid .= nitv_card($site, $a);
    }
    $page = nitv_replace(nitv_tpl('category.html'), ['CATEGORY_NAME' => nitv_h($cat['name']), 'NEWS_GRID' => $grid ?: '<p>कोई खबर नहीं</p>']);
    echo nitv_layout($site, $page, ['title' => $cat['name'], 'activeUrl' => '/category/' . $cid, 'pageType' => 'category']);
    exit;
}

http_response_code(404);
echo '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem"><h1>404 — सही तरीका</h1>
<p>पूरा <strong>news-india-tv</strong> फोल्डर <code>public_html</code> में अपलोड करें (केवल <code>public/css</code> नहीं)।</p>
<p><code>index.php</code> और <code>.htaccess</code> ज़रूरी हैं। PHP 7.4+ चाहिए।</p>
<p><a href="' . nitv_h(nitv_url('/')) . '">होम</a></p></body></html>';
