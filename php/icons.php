<?php
declare(strict_types=1);

function nitv_pick_menu_icon(string $url, string $label): string {
    $u = strtolower($url);
    $l = strtolower($label);
    $icons = [
        'home' => '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>',
        'live' => '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/></svg>',
        'video' => '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 6 4-6 4V9z"/></svg>',
        'default' => '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    ];
    if ($u === '/' || strpos($l, 'होम') !== false) return $icons['home'];
    if (strpos($u, '/live') !== false || strpos($l, 'live') !== false) return $icons['live'];
    if (strpos($l, 'वीडियो') !== false) return $icons['video'];
    return $icons['default'];
}

function nitv_menu_link_inner(string $url, string $label): string {
    return nitv_pick_menu_icon($url, $label) . '<span class="nav-label">' . $label . '</span>';
}
