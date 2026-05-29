<?php
declare(strict_types=1);

function nitv_rss_decode(string $s): string {
    $s = preg_replace('/<!\[CDATA\[([\s\S]*?)\]\]>/', '$1', $s) ?? $s;
    return html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function nitv_rss_tag_value(string $block, string $name): string {
    if (preg_match('/<' . preg_quote($name, '/') . '[^>]*>([\s\S]*?)<\/' . preg_quote($name, '/') . '>/i', $block, $m)) {
        $inner = nitv_rss_decode($m[1]);
        return trim(preg_replace('/<[^>]+>/', ' ', $inner) ?? $inner);
    }
    if (preg_match('/<' . preg_quote($name, '/') . '[^>]+href=["\']([^"\']+)["\']/i', $block, $m)) {
        return trim($m[1]);
    }
    return '';
}

function nitv_rss_parse_xml(string $xml): array {
    $items = [];
    $seen = [];
    $add = function (string $title, string $url) use (&$items, &$seen) {
        $text = mb_substr(trim(preg_replace('/\s+/u', ' ', nitv_rss_decode($title)) ?: ''), 0, 220);
        $link = trim($url);
        if ($text === '' || $link === '' || isset($seen[$link])) return;
        $seen[$link] = true;
        $items[] = ['text' => $text, 'url' => $link];
    };

    if (preg_match_all('/<item[\s>]([\s\S]*?)<\/item>/i', $xml, $matches)) {
        foreach ($matches[1] as $block) {
            $title = nitv_rss_tag_value($block, 'title');
            $link = nitv_rss_tag_value($block, 'link');
            if ($link === '' && preg_match('/<guid[^>]*>([^<]+)<\/guid>/i', $block, $g)) {
                $link = trim(nitv_rss_decode($g[1]));
            }
            $add($title, $link);
        }
    }
    if (preg_match_all('/<entry[\s>]([\s\S]*?)<\/entry>/i', $xml, $matches)) {
        foreach ($matches[1] as $block) {
            $add(nitv_rss_tag_value($block, 'title'), nitv_rss_tag_value($block, 'link'));
        }
    }
    return $items;
}

function nitv_rss_valid_url(string $url): bool {
    return (bool)filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url);
}

function nitv_rss_http_get(string $url): ?string {
    if (!nitv_rss_valid_url($url)) return null;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_USERAGENT => 'NewsIndiaTV-RSS/1.0',
            CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml, text/xml, */*'],
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body === false || $code !== 200) return null;
        return (string)$body;
    }
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 15,
            'header' => "User-Agent: NewsIndiaTV-RSS/1.0\r\nAccept: application/rss+xml, */*\r\n",
            'follow_location' => 1,
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    return $body === false ? null : (string)$body;
}

function nitv_rss_fetch_feed(string $feedUrl, int $maxPerFeed): array {
    $xml = nitv_rss_http_get($feedUrl);
    if ($xml === null || $xml === '') return [];
    return array_slice(nitv_rss_parse_xml($xml), 0, $maxPerFeed);
}

function nitv_rss_refresh(array &$site, bool $force = false): array {
    $b = &$site['breaking'];
    $rss = $b['rss'] ?? [];
    if (empty($rss['enabled'])) {
        return ['updated' => false, 'error' => null];
    }

    $feeds = [];
    foreach ($rss['feeds'] ?? [] as $f) {
        $u = is_string($f) ? $f : ($f['url'] ?? '');
        if (nitv_rss_valid_url($u)) $feeds[] = $u;
    }
    if (!$feeds) {
        return ['updated' => false, 'error' => 'No feed URLs'];
    }

    $maxTotal = min(30, max(3, (int)($rss['maxItems'] ?? 12)));
    $perFeed = max(3, (int)ceil($maxTotal / count($feeds)));
    $all = [];
    $errors = [];

    foreach ($feeds as $url) {
        try {
            $items = nitv_rss_fetch_feed($url, $perFeed);
            if (!$items) $errors[] = $url . ': empty or failed';
            else $all = array_merge($all, $items);
        } catch (Throwable $e) {
            $errors[] = $url . ': ' . $e->getMessage();
        }
    }

    if (!$all && $errors) {
        $b['rss']['lastError'] = implode('; ', $errors);
        return ['updated' => false, 'error' => $b['rss']['lastError']];
    }

    $deduped = [];
    $seen = [];
    foreach ($all as $it) {
        $link = $it['url'] ?? '';
        if (isset($seen[$link])) continue;
        $seen[$link] = true;
        $deduped[] = $it;
        if (count($deduped) >= $maxTotal) break;
    }

    $b['rss']['items'] = $deduped;
    $b['rss']['fetchedAt'] = gmdate('c');
    $b['rss']['lastError'] = $errors ? implode('; ', $errors) : '';

    return ['updated' => true, 'error' => $b['rss']['lastError'] ?: null, 'count' => count($deduped)];
}

function nitv_rss_cache_stale(array $site): bool {
    $rss = $site['breaking']['rss'] ?? [];
    if (empty($rss['enabled'])) return false;
    $mins = min(360, max(5, (int)($rss['cacheMinutes'] ?? 20)));
    if (empty($rss['fetchedAt'])) return true;
    $age = time() - strtotime($rss['fetchedAt']);
    return $age > $mins * 60;
}

function nitv_rss_ensure(array &$site, bool $force = false): void {
    $rss = $site['breaking']['rss'] ?? [];
    if (empty($rss['enabled'])) return;
    if (!$force && !nitv_rss_cache_stale($site)) return;
    nitv_rss_refresh($site, $force);
}

function nitv_rss_parse_feed_urls(array $post): array {
    $urls = [];
    foreach ($post as $key => $val) {
        if (preg_match('/^rss_url_(\d+)$/', $key)) {
            $u = trim((string)$val);
            if (nitv_rss_valid_url($u)) $urls[] = ['url' => $u];
        }
    }
    return $urls;
}

function nitv_rss_feed_rows(array $site): string {
    $feeds = $site['breaking']['rss']['feeds'] ?? [];
    $urls = [];
    foreach ($feeds as $f) {
        $urls[] = is_string($f) ? $f : ($f['url'] ?? '');
    }
    $urls = array_values(array_filter($urls));
    if (!$urls) {
        return '<tr><td><input name="rss_url_0" type="url" placeholder="https://example.com/rss.xml" value=""></td>
          <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
    }
    $html = '';
    foreach ($urls as $i => $url) {
        $html .= '<tr><td><input name="rss_url_' . $i . '" type="url" value="' . nitv_ui_escape($url) . '"></td>
          <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
    }
    return $html;
}

function nitv_rss_status_html(array $site): string {
    $rss = $site['breaking']['rss'] ?? [];
    if (empty($rss['enabled'])) {
        return '<p class="hint">RSS बंद है — मैन्युअल खबरें दिखेंगी।</p>';
    }
    $at = !empty($rss['fetchedAt']) ? date('d M Y, H:i', strtotime($rss['fetchedAt'])) : 'कभी नहीं';
    $n = count($rss['items'] ?? []);
    $html = '<p class="hint">आखिरी RSS अपडेट: <strong>' . nitv_ui_escape($at) . '</strong> — ' . $n . ' खबरें।</p>';
    if (!empty($rss['lastError'])) {
        $html .= '<p class="error" style="font-size:0.9rem">' . nitv_ui_escape($rss['lastError']) . '</p>';
    }
    return $html;
}
