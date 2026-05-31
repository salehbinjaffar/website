<?php
declare(strict_types=1);

function nitv_youtube_parse_video_id(string $url): string {
    if (preg_match('/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([\w-]{11})/', $url, $m)) {
        return $m[1];
    }
    return '';
}

function nitv_normalize_channel_input(string $input): array {
    $raw = trim($input);
    if ($raw === '') return ['channelName' => '', 'channelId' => ''];
    if (preg_match('/^UC[\w-]{20,}$/i', $raw)) {
        return ['channelName' => '', 'channelId' => $raw];
    }
    if (preg_match('#youtube\.com/channel/(UC[\w-]+)#i', $raw, $m)) {
        return ['channelName' => '', 'channelId' => $m[1]];
    }
    if (preg_match('#/@([\w.\-]+)#', $raw, $m)) {
        return ['channelName' => $m[1], 'channelId' => ''];
    }
    $raw = ltrim($raw, '@');
    return ['channelName' => $raw, 'channelId' => ''];
}

function nitv_resolve_channel_id(string $channelName): string {
    if ($channelName === '') return '';
    $url = 'https://www.youtube.com/@' . rawurlencode($channelName);
    $html = nitv_rss_http_get($url);
    if ($html === null) return '';
    foreach ([
        '/"channelId":"(UC[\w-]+)"/',
        '/"externalId":"(UC[\w-]+)"/',
        '/"browseId":"(UC[\w-]+)"/',
    ] as $re) {
        if (preg_match($re, $html, $m)) return $m[1];
    }
    return '';
}

function nitv_get_youtube_channel(array $site): array {
    $y = $site['youtubeChannel'] ?? [];
    return [
        'enabled' => !empty($y['enabled']) && (!empty($y['channelName']) || !empty($y['channelId'])),
        'channelName' => trim($y['channelName'] ?? ''),
        'channelId' => trim($y['channelId'] ?? ''),
        'pageTitle' => trim($y['pageTitle'] ?? 'YouTube — ताज़ा वीडियो'),
        'maxVideos' => min(50, max(6, (int)($y['maxVideos'] ?? 24))),
        'cacheMinutes' => min(360, max(15, (int)($y['cacheMinutes'] ?? 45))),
        'videos' => $y['videos'] ?? [],
        'fetchedAt' => $y['fetchedAt'] ?? '',
        'lastError' => $y['lastError'] ?? '',
    ];
}

function nitv_channel_public_url(array $y): string {
    if (!empty($y['channelName'])) {
        return 'https://www.youtube.com/@' . rawurlencode($y['channelName']);
    }
    if (!empty($y['channelId'])) {
        return 'https://www.youtube.com/channel/' . $y['channelId'];
    }
    return 'https://www.youtube.com/';
}

function nitv_youtube_channel_stale(array $site): bool {
    $y = nitv_get_youtube_channel($site);
    if (!$y['enabled']) return false;
    if ($y['fetchedAt'] === '') return true;
    return time() - strtotime($y['fetchedAt']) > $y['cacheMinutes'] * 60;
}

function nitv_refresh_youtube_channel(array &$site, bool $force = false): array {
    $y = &$site['youtubeChannel'];
    $channelName = trim($y['channelName'] ?? '');
    $channelId = trim($y['channelId'] ?? '');

    if ($channelId === '' && $channelName !== '') {
        $channelId = nitv_resolve_channel_id($channelName);
    }
    if ($channelId === '') {
        $y['lastError'] = 'चैनल ID नहीं मिली — चैनल नाम जाँचें';
        return ['updated' => false, 'error' => $y['lastError']];
    }
    $y['channelId'] = $channelId;

    $feed = 'https://www.youtube.com/feeds/videos.xml?channel_id=' . rawurlencode($channelId);
    $items = nitv_rss_fetch_feed($feed, $y['maxVideos'] ?? 24);
    $videos = [];
    foreach ($items as $it) {
        $vid = nitv_youtube_parse_video_id($it['url'] ?? '');
        if ($vid === '') continue;
        $videos[] = ['title' => $it['text'] ?? '', 'url' => $it['url'], 'videoId' => $vid];
    }
    $y['videos'] = $videos;
    $y['fetchedAt'] = gmdate('c');
    $y['lastError'] = $videos ? '' : 'फ़ीड से कोई वीडियो नहीं मिली';
    return ['updated' => (bool)$videos, 'count' => count($videos), 'error' => $y['lastError'] ?: null];
}

function nitv_ensure_youtube_channel(array &$site, bool $force = false): void {
    $y = nitv_get_youtube_channel($site);
    if (!$y['enabled']) return;
    if (!$force && !nitv_youtube_channel_stale($site)) return;
    nitv_refresh_youtube_channel($site, $force);
}

function nitv_render_youtube_video_cards(array $videos): string {
    if (!$videos) {
        return '<p class="youtube-empty">अभी कोई वीडियो नहीं मिली।</p>';
    }
    $html = '';
    foreach ($videos as $v) {
        $id = nitv_h($v['videoId'] ?? '');
        $title = nitv_h($v['title'] ?? 'वीडियो');
        $url = nitv_h($v['url'] ?? '#');
        $thumb = 'https://i.ytimg.com/vi/' . $id . '/hqdefault.jpg';
        $html .= '<article class="youtube-video-card"><a href="' . $url . '" target="_blank" rel="noopener noreferrer" class="youtube-video-link">
          <img src="' . $thumb . '" alt="' . $title . '" loading="lazy" decoding="async" width="480" height="360">
          <h3 class="youtube-video-title">' . $title . '</h3></a></article>';
    }
    return $html;
}

function nitv_render_youtube_page(array $site): string {
    $yt = nitv_get_youtube_channel($site);
    $display = $yt['channelName'] !== '' ? '@' . $yt['channelName'] : 'YouTube';
    return nitv_replace(nitv_tpl('youtube.html'), [
        'PAGE_HEADING' => nitv_h($yt['pageTitle']),
        'CHANNEL_URL' => nitv_h(nitv_channel_public_url($yt)),
        'CHANNEL_DISPLAY' => nitv_h($display),
        'VIDEO_CARDS' => nitv_render_youtube_video_cards($yt['videos']),
    ]);
}

function nitv_youtube_channel_status_html(array $site): string {
    $y = nitv_get_youtube_channel($site);
    if (!$y['enabled']) return '<p class="hint">YouTube पेज बंद है।</p>';
    $at = $y['fetchedAt'] ? date('d M Y, H:i', strtotime($y['fetchedAt'])) : 'कभी नहीं';
    $html = '<p class="hint">आखिरी अपडेट: <strong>' . nitv_h($at) . '</strong> — ' . count($y['videos']) . ' वीडियो।</p>';
    if ($y['lastError']) {
        $html .= '<p class="error" style="font-size:0.9rem">' . nitv_h($y['lastError']) . '</p>';
    }
    return $html;
}
