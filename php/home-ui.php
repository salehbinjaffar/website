<?php
declare(strict_types=1);

function nitv_ui_escape(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function nitv_breaking_href(string $url): string {
    $u = trim($url);
    if ($u === '') return nitv_url('/');
    if (preg_match('#^https?://#i', $u)) return $u;
    return nitv_url(str_starts_with($u, '/') ? $u : '/' . $u);
}

function nitv_breaking_link_attrs(string $url): string {
    return preg_match('#^https?://#i', trim($url)) ? ' target="_blank" rel="noopener noreferrer"' : '';
}

function nitv_get_breaking_items(array $site): array {
    $b = $site['breaking'] ?? [];
    $rss = $b['rss'] ?? [];
    if (!empty($rss['enabled']) && !empty($rss['items']) && is_array($rss['items'])) {
        $max = min(30, (int)($rss['maxItems'] ?? 12));
        return array_slice($rss['items'], 0, $max);
    }
    if (!empty($b['items']) && is_array($b['items'])) {
        return $b['items'];
    }
    $legacy = $site['settings']['breakingText'] ?? '';
    return $legacy ? [['text' => $legacy, 'url' => '/']] : [['text' => 'ताज़ा खबरें', 'url' => '/']];
}

function nitv_render_breaking_ticker(array $site): array {
    $b = $site['breaking'] ?? [];
    $label = nitv_ui_escape($b['label'] ?? 'ब्रेकिंग');
    $speed = (int)($b['speed'] ?? 35);
    if ($speed < 15) $speed = 15;
    $parts = '';
    foreach (nitv_get_breaking_items($site) as $it) {
        $href = nitv_breaking_href((string)($it['url'] ?? '/'));
        $parts .= '<a href="' . nitv_ui_escape($href) . '"' . nitv_breaking_link_attrs((string)($it['url'] ?? '')) . '>'
            . nitv_ui_escape($it['text'] ?? '') . '</a><span class="breaking-sep">•</span>';
    }
    $track = '<div class="breaking-track" style="animation-duration:' . $speed . 's">' . $parts . $parts . '</div>';
    return ['label' => $label, 'track' => $track];
}

function nitv_get_slider_slides(array $site, array $articles): array {
    if (!empty($site['slider']) && is_array($site['slider'])) {
        return array_values(array_filter($site['slider'], fn($s) => !empty($s['imageUrl'])));
    }
    $out = [];
    foreach ($articles as $a) {
        if (empty($a['imageUrl'])) continue;
        $out[] = [
            'title' => $a['title'],
            'imageUrl' => $a['imageUrl'],
            'link' => '/article/' . $a['slug'],
            'category' => $a['categoryId'] ?? '',
        ];
        if (count($out) >= 5) break;
    }
    return $out;
}

function nitv_render_slider(array $site, array $articles): string {
    $slides = nitv_get_slider_slides($site, $articles);
    if (!$slides) return '';
    $html = '';
    foreach ($slides as $i => $s) {
        $cat = !empty($s['category']) ? '<span class="category-badge">' . nitv_ui_escape(nitv_cat_name($site, $s['category'])) . '</span>' : '';
        $active = $i === 0 ? ' is-active' : '';
        $html .= '<div class="slider-slide' . $active . '" data-index="' . $i . '"><a href="' . nitv_ui_escape(nitv_url($s['link'] ?? '#')) . '">
          <img src="' . nitv_ui_escape(nitv_media_url($s['imageUrl'])) . '" alt="">
          <div class="slider-caption">' . $cat . '<h2>' . nitv_ui_escape($s['title'] ?? '') . '</h2></div></a></div>';
    }
    $dots = '';
    foreach ($slides as $i => $_) {
        $dots .= '<button type="button" class="slider-dot' . ($i === 0 ? ' active' : '') . '" data-go="' . $i . '"></button>';
    }
    return '<section class="hero-slider" data-slider><div class="slider-viewport"><div class="slider-track">' . $html . '</div>
      <button type="button" class="slider-arrow slider-prev">‹</button>
      <button type="button" class="slider-arrow slider-next">›</button></div>
      <div class="slider-dots">' . $dots . '</div></section>';
}

function nitv_parse_breaking_post(array $post): array {
    $items = [];
    foreach ($post as $key => $val) {
        if (preg_match('/^breaking_text_(\d+)$/', $key, $m)) {
            $text = trim((string)$val);
            if ($text !== '') {
                $items[] = ['text' => $text, 'url' => $post['breaking_url_' . $m[1]] ?? '/'];
            }
        }
    }
    return $items;
}

function nitv_breaking_editor_rows(array $site): string {
    $items = nitv_get_breaking_items($site);
    if (!$items) {
        return '<tr><td><input name="breaking_text_0" value=""></td>
          <td><input name="breaking_url_0" value="/"></td>
          <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
    }
    $html = '';
    foreach ($items as $i => $it) {
        $html .= '<tr><td><input name="breaking_text_' . $i . '" value="' . nitv_ui_escape($it['text'] ?? '') . '"></td>
          <td><input name="breaking_url_' . $i . '" value="' . nitv_ui_escape($it['url'] ?? '/') . '"></td>
          <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
    }
    return $html;
}

function nitv_slider_editor_rows(array $site): string {
    $slides = $site['slider'] ?? [];
    if (!is_array($slides) || !$slides) return '';
    $html = '';
    foreach ($slides as $i => $s) {
        $html .= '<tr><td><input name="slider_title_' . $i . '" value="' . nitv_ui_escape($s['title'] ?? '') . '"></td>
          <td><input name="slider_image_' . $i . '" value="' . nitv_ui_escape($s['imageUrl'] ?? '') . '"></td>
          <td><input name="slider_link_' . $i . '" value="' . nitv_ui_escape($s['link'] ?? '/') . '"></td>
          <td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>';
    }
    return $html;
}

function nitv_parse_slider_post(array $post): array {
    $items = [];
    foreach ($post as $key => $val) {
        if (preg_match('/^slider_title_(\d+)$/', $key, $m)) {
            $title = trim((string)$val);
            $image = trim((string)($post['slider_image_' . $m[1]] ?? ''));
            if ($title !== '' && $image !== '') {
                $items[] = [
                    'id' => 's' . $m[1],
                    'title' => $title,
                    'imageUrl' => $image,
                    'link' => $post['slider_link_' . $m[1]] ?? '/',
                ];
            }
        }
    }
    return $items;
}
