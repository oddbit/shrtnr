// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import pkg from "../../package.json";

export function serveAdminUI(email: string): Response {
  const html = ADMIN_HTML
    .replace("__CURRENT_USER__", escapeForJs(email))
    .replace("__APP_VERSION__", pkg.version);
  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

function escapeForJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>shrtnr — Admin</title>
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
  <style>
    :root, [data-theme="oddbit"] {
      --bg: #001110;
      --surface-dim: #001110;
      --surface-low: #001715;
      --surface: #001e1c;
      --surface-high: #002422;
      --surface-highest: #002b28;
      --surface-bright: #00322f;
      --primary: #ff9061;
      --primary-dark: #FF7637;
      --primary-glow: rgba(255,144,97,0.12);
      --secondary: #b5f2af;
      --secondary-container: #1b511f;
      --on-bg: #d3fcf6;
      --on-bg-muted: #8cb3ae;
      --outline: #294e4b;
      --danger: #ef4444;
      --font-display: 'Space Grotesk', system-ui, sans-serif;
      --font-body: 'Manrope', system-ui, sans-serif;
      --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
      --radius: 0.375rem;
      --radius-lg: 0.75rem;
    }
    [data-theme="dark"] {
      --bg: #0f1923;
      --surface-dim: #0f1923;
      --surface-low: #152028;
      --surface: #1a2733;
      --surface-high: #1f2f3d;
      --surface-highest: #253648;
      --surface-bright: #2b3d52;
      --primary: #ff9061;
      --primary-dark: #FF7637;
      --primary-glow: rgba(255,144,97,0.10);
      --secondary: #f0c27a;
      --secondary-container: #3a2e1a;
      --on-bg: #e2e8f0;
      --on-bg-muted: #8899aa;
      --outline: #2d3f52;
      --danger: #ef4444;
    }
    [data-theme="light"] {
      --bg: #f0f2f0;
      --surface-dim: #e4e8e5;
      --surface-low: #e9ece9;
      --surface: #ffffff;
      --surface-high: #f6f7f6;
      --surface-highest: #eaedeb;
      --surface-bright: #dfe3e0;
      --primary: #c0582e;
      --primary-dark: #a8461e;
      --primary-glow: rgba(192,88,46,0.06);
      --secondary: #2d6e3f;
      --secondary-container: #e2f0e5;
      --on-bg: #1b2420;
      --on-bg-muted: #5c6d64;
      --outline: #c4cdc7;
      --danger: #c42b2b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: var(--bg); color: var(--on-bg); min-height: 100vh; display: flex; }
    .icon { font-family: 'Material Symbols Outlined'; font-size: 20px; vertical-align: middle; font-variation-settings: 'FILL' 0, 'wght' 400; }
    .icon-fill { font-variation-settings: 'FILL' 1, 'wght' 400; }

    /* Sidebar */
    .sidebar { width: 240px; background: var(--surface-low); padding: 1.5rem 1rem; display: flex; flex-direction: column; min-height: 100vh; position: fixed; left: 0; top: 0; }
    .sidebar-brand { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--on-bg); margin-bottom: 2rem; padding: 0 0.5rem; }
    .sidebar-brand span { color: var(--primary); }
    .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
    .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: var(--radius); color: var(--on-bg-muted); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); text-decoration: none; }
    .nav-item:hover { color: var(--on-bg); background: var(--surface); }
    .nav-item.active { color: var(--secondary); background: var(--secondary-container); }
    .sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .sidebar-user { padding: 0.75rem; border-radius: var(--radius); background: var(--surface); }
    .sidebar-oddbit { text-align: center; padding: 0.75rem 0 0.25rem; }
    .sidebar-oddbit a { display: inline-block; opacity: 0.5; transition: opacity 0.2s; color: var(--on-bg-muted); }
    .sidebar-oddbit a:hover { opacity: 0.8; }
    [data-theme="light"] .sidebar-oddbit a { color: #09322f; opacity: 1; }
    [data-theme="light"] .sidebar { background: #dce3dd; border-right: 1px solid #c4cdc7; }
    [data-theme="light"] .sidebar-user { background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    [data-theme="light"] .bento-card { box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #dfe3e0; }
    [data-theme="light"] .bento-card:hover { background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    [data-theme="light"] .hero-input { background: #ffffff; border-color: #c4cdc7; }
    [data-theme="light"] .modal-inner { box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    [data-theme="light"] .slug-chip { border-color: #c4cdc7; }
    [data-theme="light"] .stat-bar { background: #dfe3e0; }
    [data-theme="light"] .btn-primary { color: #fff; }
    [data-theme="light"] .btn-secondary { color: #fff; }
    [data-theme="light"] .nav-item.active { color: #1b5e20; }
    [data-theme="oddbit"] .sidebar-oddbit a, :root .sidebar-oddbit a { color: #a7e3a1; }
    .sidebar-oddbit svg { width: 80px; height: auto; }
    .sidebar-oddbit .copyright { font-size: 0.65rem; color: var(--on-bg-muted); margin-top: 0.25rem; opacity: 0.5; }
    .sidebar-user-email { font-size: 0.75rem; color: var(--on-bg-muted); word-break: break-all; }
    .sidebar-user-logout { font-size: 0.75rem; color: var(--primary); text-decoration: none; margin-top: 0.25rem; display: inline-block; }
    .sidebar-user-logout:hover { text-decoration: underline; }

    /* Main */
    .main { margin-left: 240px; flex: 1; padding: 2rem 2.5rem; min-height: 100vh; }

    /* Page header */
    .page-header { margin-bottom: 2rem; }
    .page-title { font-family: var(--font-display); font-size: 2rem; font-weight: 700; }
    .page-subtitle { color: var(--on-bg-muted); font-size: 0.875rem; margin-top: 0.25rem; }

    /* Bento grid */
    .bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; margin-bottom: 2rem; }
    .bento-card { background: var(--surface); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; transition: background 0.2s; }
    .bento-card:hover { background: var(--surface-high); }
    .bento-card.span-2 { grid-column: span 2; }
    .bento-card.span-3 { grid-column: span 3; }
    .bento-label { font-size: 0.75rem; color: var(--secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .bento-value { font-family: var(--font-display); font-size: 2rem; font-weight: 700; }
    .bento-value.small { font-size: 1rem; font-weight: 500; }

    /* Stat bars */
    .stat-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; }
    .stat-name { font-size: 0.8rem; min-width: 100px; color: var(--on-bg); }
    .stat-bar { flex: 1; height: 8px; background: var(--surface-low); border-radius: 4px; overflow: hidden; }
    .stat-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease-out; }
    .stat-fill.orange { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); }
    .stat-fill.mint { background: var(--secondary); }
    .stat-count { font-family: var(--font-mono); font-size: 0.8rem; color: var(--on-bg-muted); min-width: 40px; text-align: right; }

    /* Links list */
    .link-item { background: var(--surface); border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1rem; transition: background 0.2s; display: flex; align-items: center; gap: 1rem; cursor: pointer; }
    .link-item:hover { background: var(--surface-high); }
    .link-info { flex: 1; min-width: 0; }
    .link-slugs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.3rem; }
    .slug-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--surface-highest); border: 2px solid var(--outline); border-radius: var(--radius); padding: 0.2rem 0.6rem; font-family: var(--font-mono); font-size: 0.8rem; cursor: pointer; transition: border-color 0.2s; }
    .slug-chip:hover { border-color: var(--secondary); }
    .slug-chip.vanity { border-color: var(--primary); }
    .slug-chip .icon { font-size: 14px; }
    .link-url { font-size: 0.8rem; color: var(--on-bg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .link-label { font-size: 0.75rem; color: var(--secondary); }
    .link-meta { display: flex; align-items: center; gap: 1.5rem; }
    .link-clicks { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: var(--primary); min-width: 60px; text-align: center; }
    .link-clicks-label { font-size: 0.65rem; color: var(--on-bg-muted); text-transform: uppercase; }
    .link-actions { display: flex; gap: 0.25rem; }
    .link-actions button { background: transparent; border: none; color: var(--on-bg-muted); cursor: pointer; padding: 0.4rem; border-radius: var(--radius); transition: all 0.2s; }
    .link-actions button:hover { color: var(--on-bg); background: var(--surface-highest); }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border: none; border-radius: var(--radius); font-family: var(--font-body); font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #1a0800; }
    .btn-primary:hover { filter: brightness(1.1); }
    .btn-secondary { background: var(--secondary); color: #0a1a09; }
    .btn-secondary:hover { filter: brightness(1.1); }
    .btn-ghost { background: transparent; color: var(--on-bg-muted); border: 2px solid var(--outline); }
    .btn-ghost:hover { border-color: var(--on-bg-muted); color: var(--on-bg); }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-danger:hover { filter: brightness(1.1); }
    .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
    .btn:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
    .btn-lg { padding: 0.75rem 1.5rem; font-size: 1rem; }

    /* Hero input */
    .hero-input-wrap { display: flex; gap: 0.75rem; margin-bottom: 2rem; }
    .hero-input { flex: 1; padding: 0.75rem 1rem; background: var(--surface-low); border: 2px solid var(--outline); border-radius: var(--radius); color: var(--on-bg); font-family: var(--font-body); font-size: 1rem; }
    .hero-input:focus { outline: none; border-color: var(--secondary); box-shadow: 0 0 0 3px rgba(181,242,175,0.15); }
    .hero-input::placeholder { color: var(--on-bg-muted); }

    /* Forms */
    .theme-toggle { display: inline-flex; background: var(--surface-low); border-radius: var(--radius-lg); padding: 3px; gap: 2px; border: 1px solid var(--outline); }
    .theme-toggle .theme-btn { padding: 0.5rem 1rem; background: transparent; border: none; border-radius: calc(var(--radius-lg) - 2px); color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; }
    .theme-toggle .theme-btn:hover { color: var(--on-bg); }
    .theme-toggle .theme-btn.active { background: var(--surface); color: var(--on-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    .theme-toggle .theme-btn .icon { font-size: 16px; }
    .form-group { margin-bottom: 1rem; }
    .form-label { display: block; font-size: 0.75rem; color: var(--secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
    .form-input { width: 100%; padding: 0.6rem 0.85rem; background: var(--surface-low); border: 2px solid var(--outline); border-radius: var(--radius); color: var(--on-bg); font-family: var(--font-body); font-size: 0.875rem; }
    .form-input:focus { outline: none; border-color: var(--secondary); box-shadow: 0 0 0 3px rgba(181,242,175,0.15); }
    .form-row { display: flex; gap: 1rem; }
    .form-row > * { flex: 1; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,17,16,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
    .modal { background: var(--surface-bright); border-radius: var(--radius-lg); padding: 1.75rem; width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
    .modal-title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem; }
    .modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; }

    /* Toast */
    .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.75rem 1.25rem; border-radius: var(--radius); font-size: 0.875rem; font-weight: 600; z-index: 200; animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .toast-success { background: var(--secondary); color: #0a1a09; }
    .toast-error { background: var(--danger); color: #fff; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* Chart */
    .chart-container { position: relative; height: 160px; display: flex; align-items: flex-end; gap: 3px; padding-top: 1rem; }
    .chart-bar { flex: 1; background: linear-gradient(180deg, var(--primary), var(--primary-dark)); border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s ease-out; position: relative; }
    .chart-bar:hover { filter: brightness(1.2); }
    .chart-bar:hover::after { content: attr(data-label); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: var(--surface-bright); color: var(--on-bg); font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: var(--radius); white-space: nowrap; margin-bottom: 4px; }
    .chart-dates { display: flex; justify-content: space-between; margin-top: 0.5rem; }
    .chart-dates span { font-size: 0.65rem; color: var(--on-bg-muted); }

    /* Link detail view */
    .detail-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
    .detail-back { background: none; border: none; color: var(--on-bg-muted); cursor: pointer; padding: 0.4rem; border-radius: var(--radius); }
    .detail-back:hover { color: var(--on-bg); background: var(--surface); }
    .detail-hero { background: var(--surface); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.4rem; }
    .detail-short-url { font-family: var(--font-display); font-size: 1.75rem; font-weight: 700; color: var(--primary); word-break: break-all; }
    .detail-dest { font-size: 0.85rem; color: var(--on-bg-muted); margin-top: 0.25rem; word-break: break-all; }
    .detail-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.4rem; }
    .detail-grid .bento-card { margin-bottom: 0; }

    /* QR */
    .qr-wrap { display: flex; justify-content: center; padding: 1rem; }
    .qr-wrap canvas { border-radius: var(--radius); }

    /* Settings bar */
    .settings-inline { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; background: var(--surface); border-radius: var(--radius-lg); margin-bottom: 1.4rem; }
    .settings-inline .form-label { margin: 0; }
    .settings-inline .form-input { width: 70px; }

    /* Toolbar */
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.4rem; }
    .toolbar-count { color: var(--on-bg-muted); font-size: 0.875rem; }
    .toolbar-sort { display: flex; gap: 0.25rem; }
    .sort-btn { background: transparent; border: 2px solid var(--outline); border-radius: var(--radius); color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.75rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.3rem; }
    .sort-btn:hover { border-color: var(--on-bg-muted); color: var(--on-bg); }
    .sort-btn.active { border-color: var(--secondary); color: var(--secondary); }
    .link-disabled { opacity: 0.5; }
    .disabled-badge { display: inline-flex; align-items: center; gap: 0.2rem; background: var(--danger); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: var(--radius); text-transform: uppercase; letter-spacing: 0.05em; }
    .link-date { font-size: 0.7rem; color: var(--on-bg-muted); margin-top: 0.2rem; }
    .pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 1.4rem; padding: 0.75rem 0; }
    .pagination-pages { display: flex; gap: 0.25rem; }
    .page-btn { background: transparent; border: 2px solid var(--outline); border-radius: var(--radius); color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; min-width: 2rem; text-align: center; }
    .page-btn:hover { border-color: var(--on-bg-muted); color: var(--on-bg); }
    .page-btn.active { border-color: var(--primary); color: var(--primary); }
    .page-btn:disabled { opacity: 0.3; cursor: default; }
    .per-page { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--on-bg-muted); }
    .per-page-btn { background: transparent; border: none; color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.75rem; font-weight: 600; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: var(--radius); }
    .per-page-btn:hover { color: var(--on-bg); }
    .per-page-btn.active { color: var(--secondary); }

    /* Empty state */
    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--on-bg-muted); }
    .empty-state .icon { font-size: 48px; margin-bottom: 1rem; display: block; }
    .empty-state p { margin-bottom: 1rem; }

    /* Responsive */
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; padding: 1rem; }
      .bento { grid-template-columns: 1fr; }
      .bento-card.span-2, .bento-card.span-3 { grid-column: span 1; }
      .detail-grid { grid-template-columns: 1fr; }
      .hero-input-wrap { flex-direction: column; }
      .form-row { flex-direction: column; }
    }
  </style>
</head>
<body>

<!-- Sidebar -->
<nav class="sidebar">
  <div class="sidebar-brand">shrtnr<span>.</span></div>
  <div class="sidebar-nav">
    <a class="nav-item active" data-view="dashboard" href="/_/admin/dashboard" onclick="event.preventDefault();switchView('dashboard')">
      <span class="icon">dashboard</span> Dashboard
    </a>
    <a class="nav-item" data-view="links" href="/_/admin/links" onclick="event.preventDefault();switchView('links')">
      <span class="icon">link</span> Links
    </a>
    <a class="nav-item" data-view="settings" href="/_/admin/settings" onclick="event.preventDefault();switchView('settings')">
      <span class="icon">settings</span> Settings
    </a>
  </div>
  <div class="sidebar-footer">
    <div class="sidebar-user">
      <div class="sidebar-user-email" id="user-email"></div>
      <a href="/_/cdn-cgi/access/logout" class="sidebar-user-logout">Sign out</a>
    </div>
    <div class="sidebar-oddbit">
      <a href="https://oddbit.id" target="_blank" rel="noopener" title="Oddbit">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2578.3 660.9"><path fill="currentColor" d="M49.5,369.5c-1,7.6-1.9,18-1.9,36.2,0,108.5,88.6,199.9,191.5,199.9s185.6-85.7,185.6-196.2-81-192.3-194.2-192.3S55.2,288.5,27.6,319l56.1-110.5c33.3-22.9,95.2-46.7,151.4-46.7,136.1,0,248.6,112.3,248.6,249.5s-110.5,249.5-244.7,249.5S25.6,595.2,0,465.7l49.5-96.2Z"/><path fill="currentColor" d="M521.8,411.3c0-141,112.3-243.7,227.6-243.7s108.5,18.2,143.8,43.8l36.2,71.4c-44.8-34.2-106.6-61.8-164.7-61.8-111.5,0-183.8,93.3-183.8,190.5s79,194.2,188.5,194.2,182.9-80,182.9-194.2V0h59.1v411.3c0,149.4-124.8,249.5-241.9,249.5s-247.6-110.5-247.6-249.5Z"/><path fill="currentColor" d="M1060.6,411.3c0-141,112.3-243.7,227.6-243.7s108.5,18.2,143.8,43.8l36.2,71.4c-44.8-34.2-106.6-61.8-164.7-61.8-111.5,0-183.8,93.3-183.8,190.5s79,194.2,188.5,194.2,182.9-80,182.9-194.2V0h59.1v411.3c0,149.4-124.8,249.5-241.9,249.5s-247.6-110.5-247.6-249.5Z"/><path fill="currentColor" d="M1614.7,411.3V0h59.1v411.3c0,114.2,90.5,194.2,182.9,194.2s188.5-91.3,188.5-194.2-72.4-190.5-183.8-190.5-119.9,27.6-164.7,61.8l36.2-71.4c35.2-25.6,85.7-43.8,143.8-43.8,115.2,0,227.6,102.9,227.6,243.7s-110.5,249.5-247.6,249.5-241.9-99.9-241.9-249.5v.2Z"/><path fill="currentColor" d="M2147.9,70.4c0-21.9,19-39.9,40.9-39.9s40.9,18.2,40.9,39.9-19,39.9-40.9,39.9-40.9-18.2-40.9-39.9ZM2159.2,647.5V175.2h59.1v472.3h-59.1Z"/><path fill="currentColor" d="M2286.8,464.7V187.5l59.1-61.8v315.1c0,102.9,55.2,164.7,140,164.7s64.7-8.6,92.3-26.6v53.4c-27.6,20-60,28.6-97.2,28.6-106.6,0-194.2-84.7-194.2-196.2ZM2365,230.4l28.6-55.2h184.8v55.2h-213.4Z"/></svg>
      </a>
      <div class="copyright" id="copyright-year"></div>
    </div>
  </div>
</nav>

<!-- Main content -->
<div class="main" id="app">

  <!-- Dashboard View -->
  <div id="view-dashboard">
    <div class="page-header">
      <div class="page-title">Dashboard</div>
      <div class="page-subtitle">Overview of your short links</div>
    </div>

    <!-- Quick shorten -->
    <div class="hero-input-wrap">
      <input class="hero-input" id="quick-url" type="url" placeholder="Paste a long URL to shorten...">
      <button class="btn btn-primary btn-lg" onclick="quickShorten()">
        <span class="icon">bolt</span> Shorten
      </button>
    </div>

    <div id="dashboard-stats"></div>
  </div>

  <!-- Links View -->
  <div id="view-links" style="display:none">
    <div class="page-header">
      <div class="page-title">Links</div>
      <div class="page-subtitle">Manage all your short links</div>
    </div>
    <div class="toolbar">
      <div style="display:flex;align-items:center;gap:1rem">
        <div class="toolbar-count" id="link-count"></div>
        <div class="toolbar-sort">
          <button class="sort-btn active" id="sort-recent" onclick="sortLinks('recent')"><span class="icon" style="font-size:16px">schedule</span> Recent</button>
          <button class="sort-btn" id="sort-popular" onclick="sortLinks('popular')"><span class="icon" style="font-size:16px">trending_up</span> Popular</button>
        </div>
        <button class="sort-btn" id="toggle-disabled" onclick="toggleShowDisabled()"><span class="icon" style="font-size:16px">block</span> Show disabled</button>
      </div>
      <button class="btn btn-primary" onclick="showCreateModal()">
        <span class="icon">add</span> New Link
      </button>
    </div>
    <div id="links-list"></div>
  </div>

  <!-- Settings View -->
  <div id="view-settings" style="display:none">
    <div class="page-header">
      <div class="page-title">Settings</div>
      <div class="page-subtitle">Configure your URL shortener</div>
    </div>
    <div class="bento-card" style="max-width:480px">
      <div class="form-group">
        <label class="form-label">Theme</label>
        <div class="theme-toggle" id="theme-picker">
          <button class="theme-btn active" data-theme="oddbit" onclick="setTheme('oddbit')"><span class="icon">eco</span> Oddbit</button>
          <button class="theme-btn" data-theme="dark" onclick="setTheme('dark')"><span class="icon">dark_mode</span> Dark</button>
          <button class="theme-btn" data-theme="light" onclick="setTheme('light')"><span class="icon">light_mode</span> Light</button>
        </div>
      </div>
    </div>
    <div class="bento-card" style="max-width:480px;margin-top:1.4rem">
      <div class="form-group">
        <label class="form-label">Default Slug Length</label>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <input class="form-input" type="number" id="slug-length-input" min="3" value="3" style="width:80px">
          <button class="btn btn-secondary btn-sm" onclick="saveSettings()">Save</button>
        </div>
        <div style="font-size:0.75rem;color:var(--on-bg-muted);margin-top:0.4rem" id="slug-combo-hint"></div>
      </div>
    </div>
    <div class="bento-card" style="max-width:480px;margin-top:1.4rem">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Version</label>
        <div id="version-status" style="font-size:0.875rem">
          <span style="color:var(--on-bg-muted)"><span class="icon" style="font-size:16px;vertical-align:text-bottom;animation:spin 1s linear infinite">progress_activity</span> Checking for updates...</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Link Detail View -->
  <div id="view-detail" style="display:none"></div>
</div>

<!-- Modal -->
<div id="modal-overlay" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modal"></div>
</div>

<!-- Toast -->
<div id="toast" class="toast" style="display:none"></div>

<script>
const API = '/_/api';
const CURRENT_USER = '__CURRENT_USER__';
const APP_VERSION = '__APP_VERSION__';
const REPO_URL = 'https://github.com/oddbit/shrtnr';
let links = [];
let dashboardData = null;
let currentView = 'dashboard';
let linkSort = 'recent';
let linkPage = 1;
let linksPerPage = 25;
let showDisabled = false;

document.getElementById('user-email').textContent = CURRENT_USER;
document.getElementById('copyright-year').textContent = '\\u00A9 ' + new Date().getFullYear();

// ---- Navigation ----
function switchView(view, pushState) {
  if (typeof pushState === 'undefined') pushState = true;
  currentView = view;
  ['dashboard','links','settings','detail'].forEach(v => {
    document.getElementById('view-' + v).style.display = v === view ? '' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  if (pushState && view !== 'detail') {
    history.pushState({ view: view }, '', '/_/admin/' + view);
  }
  if (view === 'dashboard') loadDashboard();
  if (view === 'links') loadLinks();
  if (view === 'settings') checkForUpdates();
}

// ---- Country names ----
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
function countryName(code) {
  try { return countryNames.of(code) || code; } catch(e) { return code; }
}

// ---- API helper ----
async function api(path, opts = {}) {
  if (!opts.headers) opts.headers = {};
  if (opts.body && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, opts);
  if (res.status === 401) { window.location.reload(); return res; }
  return res;
}

// ---- Toast ----
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast toast-' + type;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

// ---- Modal ----
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}

// ---- Copy ----
function copyUrl(slug) {
  const url = location.origin + '/' + slug;
  navigator.clipboard.writeText(url);
  toast('Copied ' + url);
}

// ---- Escape ----
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ---- Dashboard ----
async function loadDashboard() {
  const res = await api('/dashboard');
  if (!res.ok) return;
  dashboardData = await res.json();
  renderDashboard();
}

function renderDashboard() {
  const d = dashboardData;
  const el = document.getElementById('dashboard-stats');

  let html = '<div class="bento">';

  // Stat cards
  html += '<div class="bento-card"><div class="bento-label">Total Links</div><div class="bento-value">' + d.total_links + '</div></div>';
  html += '<div class="bento-card"><div class="bento-label">Total Clicks</div><div class="bento-value">' + d.total_clicks + '</div></div>';
  html += '<div class="bento-card"><div class="bento-label">Top Countries</div><div class="bento-value small">' + (d.top_countries.length ? '' : '<span style="color:var(--on-bg-muted)">No data yet</span>') + '</div>';
  if (d.top_countries.length) {
    const maxC = d.top_countries[0].count;
    d.top_countries.forEach(c => {
      html += '<div class="stat-row"><span class="stat-name">' + esc(countryName(c.name)) + '</span><div class="stat-bar"><div class="stat-fill orange" style="width:' + (c.count / maxC * 100) + '%"></div></div><span class="stat-count">' + c.count + '</span></div>';
    });
  }
  html += '</div>';

  // Recent links
  html += '<div class="bento-card span-2"><div class="bento-label">Recent Links</div>';
  if (d.recent_links.length === 0) {
    html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No links yet</div>';
  } else {
    d.recent_links.forEach(link => {
      const primary = link.slugs.find(s => !s.is_vanity);
      const slug = primary ? primary.slug : (link.slugs[0]?.slug || '');
      html += '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;cursor:pointer" onclick="showDetail(' + link.id + ')">';
      html += '<span class="slug-chip" onclick="event.stopPropagation();copyUrl(\\'' + slug + '\\')" title="Click to copy">/' + esc(slug) + ' <span class="icon" style="font-size:14px">content_copy</span></span>';
      html += '<span style="flex:1;font-size:0.8rem;color:var(--on-bg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(link.url) + '</span>';
      html += '<span style="font-family:var(--font-display);font-weight:700;color:var(--primary)">' + link.total_clicks + '</span>';
      html += '</div>';
    });
  }
  html += '</div>';

  // Top referrers
  html += '<div class="bento-card"><div class="bento-label">Top Sources</div>';
  if (d.top_referrers.length === 0) {
    html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No data yet</div>';
  } else {
    const maxR = d.top_referrers[0].count;
    d.top_referrers.forEach(r => {
      html += '<div class="stat-row"><span class="stat-name">' + esc(r.name) + '</span><div class="stat-bar"><div class="stat-fill mint" style="width:' + (r.count / maxR * 100) + '%"></div></div><span class="stat-count">' + r.count + '</span></div>';
    });
  }
  html += '</div>';

  // Top links
  html += '<div class="bento-card span-3"><div class="bento-label">Most Clicked</div>';
  if (d.top_links.length === 0) {
    html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No data yet</div>';
  } else {
    const maxT = Math.max(1, d.top_links[0].total_clicks);
    d.top_links.forEach(link => {
      const primary = link.slugs.find(s => !s.is_vanity);
      const slug = primary ? primary.slug : (link.slugs[0]?.slug || '');
      html += '<div style="cursor:pointer" onclick="showDetail(' + link.id + ')">';
      html += '<div class="stat-row">';
      html += '<span class="stat-name" style="min-width:140px;font-family:var(--font-mono)">/' + esc(slug) + '</span>';
      html += '<div class="stat-bar"><div class="stat-fill orange" style="width:' + (link.total_clicks / maxT * 100) + '%"></div></div>';
      html += '<span class="stat-count">' + link.total_clicks + '</span>';
      html += '</div>';
      html += '<div style="font-size:0.75rem;color:var(--on-bg-muted);margin:-0.15rem 0 0.5rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(link.url) + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '</div>';
  el.innerHTML = html;
}

// ---- Quick shorten ----
async function quickShorten() {
  const url = document.getElementById('quick-url').value.trim();
  if (!url) { toast('Paste a URL first', 'error'); return; }
  const res = await api('/links', { method: 'POST', body: JSON.stringify({ url }) });
  if (res.ok) {
    const link = await res.json();
    const primary = link.slugs.find(s => !s.is_vanity);
    if (primary) {
      copyUrl(primary.slug);
      toast('Link created & copied!');
    } else {
      toast('Link created');
    }
    document.getElementById('quick-url').value = '';
    await loadLinks();
    showDetail(link.id);
  } else {
    const data = await res.json();
    toast(data.error || 'Failed to create link', 'error');
  }
}

document.getElementById('quick-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') quickShorten();
});

// ---- Links ----
async function loadLinks() {
  const res = await api('/links');
  if (!res.ok) return;
  links = await res.json();
  renderLinks();
}

function sortLinks(mode) {
  linkSort = mode;
  linkPage = 1;
  document.getElementById('sort-recent').classList.toggle('active', mode === 'recent');
  document.getElementById('sort-popular').classList.toggle('active', mode === 'popular');
  renderLinks();
}

function toggleShowDisabled() {
  showDisabled = !showDisabled;
  document.getElementById('toggle-disabled').classList.toggle('active', showDisabled);
  linkPage = 1;
  renderLinks();
}

function setPage(p) { linkPage = p; renderLinks(); }

function setPerPage(n) {
  linksPerPage = n;
  linkPage = 1;
  renderLinks();
}

function formatDate(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderLinks() {
  const el = document.getElementById('links-list');
  const now = Math.floor(Date.now() / 1000);
  const filtered = showDisabled ? links : links.filter(l => !l.expires_at || l.expires_at > now);
  document.getElementById('link-count').textContent = filtered.length + ' link' + (filtered.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><span class="icon">link_off</span><p>' + (links.length > 0 ? 'All links are disabled. Toggle "Show disabled" to see them.' : 'No links yet. Create one to get started.') + '</p>' + (links.length === 0 ? '<button class="btn btn-primary" onclick="showCreateModal()"><span class="icon">add</span> New Link</button>' : '') + '</div>';
    return;
  }

  const sorted = [...filtered].sort((a, b) =>
    linkSort === 'popular' ? b.total_clicks - a.total_clicks : b.created_at - a.created_at
  );

  const totalPages = Math.ceil(sorted.length / linksPerPage);
  if (linkPage > totalPages) linkPage = totalPages;
  const start = (linkPage - 1) * linksPerPage;
  const page = sorted.slice(start, start + linksPerPage);

  let html = '';
  for (const link of page) {
    const primary = link.slugs.find(s => !s.is_vanity);
    const vanity = link.slugs.filter(s => s.is_vanity);
    const disabled = link.expires_at && link.expires_at < now;
    html += '<div class="link-item' + (disabled ? ' link-disabled' : '') + '" onclick="showDetail(' + link.id + ')">';
    html += '<div class="link-info">';
    html += '<div class="link-slugs">';
    if (primary) html += '<span class="slug-chip" onclick="event.stopPropagation();copyUrl(\\'' + primary.slug + '\\')" title="Click to copy">/' + esc(primary.slug) + ' <span class="icon">content_copy</span></span>';
    vanity.forEach(v => {
      html += '<span class="slug-chip vanity" onclick="event.stopPropagation();copyUrl(\\'' + v.slug + '\\')" title="Click to copy">/' + esc(v.slug) + ' <span class="icon">content_copy</span></span>';
    });
    if (disabled) html += '<span class="disabled-badge"><span class="icon" style="font-size:14px">block</span> Disabled</span>';
    html += '</div>';
    if (link.label) html += '<div class="link-label">' + esc(link.label) + '</div>';
    html += '<div class="link-url">' + esc(link.url) + '</div>';
    html += '<div class="link-date">' + formatDate(link.created_at) + '</div>';
    html += '</div>';
    html += '<div class="link-meta">';
    html += '<div style="text-align:center"><div class="link-clicks">' + link.total_clicks + '</div><div class="link-clicks-label">clicks</div></div>';
    html += '</div></div>';
  }

  if (totalPages > 1 || links.length > 25) {
    html += '<div class="pagination">';
    html += '<div class="pagination-pages">';
    html += '<button class="page-btn" onclick="setPage(' + (linkPage - 1) + ')"' + (linkPage <= 1 ? ' disabled' : '') + '><span class="icon" style="font-size:16px">chevron_left</span></button>';
    for (let p = 1; p <= totalPages; p++) {
      html += '<button class="page-btn' + (p === linkPage ? ' active' : '') + '" onclick="setPage(' + p + ')">' + p + '</button>';
    }
    html += '<button class="page-btn" onclick="setPage(' + (linkPage + 1) + ')"' + (linkPage >= totalPages ? ' disabled' : '') + '><span class="icon" style="font-size:16px">chevron_right</span></button>';
    html += '</div>';
    html += '<div class="per-page">Show ';
    [25, 50, 100].forEach(n => {
      html += '<button class="per-page-btn' + (linksPerPage === n ? ' active' : '') + '" onclick="setPerPage(' + n + ')">' + n + '</button>';
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
}

// ---- Link Detail ----
async function showDetail(id, pushState) {
  if (typeof pushState === 'undefined') pushState = true;
  const link = links.find(l => l.id === id);
  if (!link) {
    await loadLinks();
    const found = links.find(l => l.id === id);
    if (!found) return;
  }
  currentView = 'detail';
  ['dashboard','links','settings'].forEach(v => document.getElementById('view-' + v).style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (pushState) {
    const l2 = links.find(x => x.id === id);
    const p = l2 && l2.slugs.find(s => !s.is_vanity);
    const detailSlug = p ? p.slug : (l2 && l2.slugs[0] ? l2.slugs[0].slug : id);
    history.pushState({ view: 'detail', slug: detailSlug }, '', '/_/admin/link/' + encodeURIComponent(detailSlug));
  }

  const view = document.getElementById('view-detail');
  view.style.display = '';
  view.innerHTML = '<div style="color:var(--on-bg-muted)">Loading analytics...</div>';

  const [analyticsRes] = await Promise.all([api('/links/' + id + '/analytics')]);
  const analytics = analyticsRes.ok ? await analyticsRes.json() : { total_clicks: 0, countries: [], referrers: [], devices: [], browsers: [], clicks_over_time: [] };

  const l = links.find(x => x.id === id) || link;
  const primary = l.slugs.find(s => !s.is_vanity);
  const slug = primary ? primary.slug : (l.slugs[0]?.slug || '');
  const shortUrl = location.origin + '/' + slug;

  let html = '';
  const isExpired = l.expires_at && l.expires_at < Math.floor(Date.now() / 1000);
  html += '<div class="detail-header"><button class="detail-back" onclick="switchView(\\'links\\')"><span class="icon" style="font-size:24px">arrow_back</span></button><div class="page-title">Link Details</div><div style="margin-left:auto">';
  if (!isExpired) {
    html += '<button class="btn btn-danger btn-sm" onclick="disableLink(' + id + ')"><span class="icon">block</span> Disable</button>';
  } else {
    html += '<button class="btn btn-secondary btn-sm" onclick="enableLink(' + id + ')"><span class="icon">check_circle</span> Enable</button>';
  }
  html += '</div></div>';

  // Hero
  const vanitySlug = l.slugs.find(s => s.is_vanity);
  const displaySlug = vanitySlug ? vanitySlug.slug : slug;
  const displayUrl = location.origin + '/' + displaySlug;
  html += '<div class="detail-hero">';
  if (isExpired) html += '<div style="display:inline-block;background:var(--danger);color:#fff;font-size:0.7rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:var(--radius);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">Disabled</div>';
  html += '<div class="detail-short-url"' + (isExpired ? ' style="opacity:0.4"' : '') + '>' + esc(displayUrl) + '</div>';
  html += '<div class="detail-dest">' + esc(l.url) + '</div>';
  if (l.label) html += '<div style="color:var(--secondary);font-size:0.85rem;margin-top:0.25rem">' + esc(l.label) + '</div>';
  html += '<div style="margin-top:0.75rem;display:flex;gap:0.5rem;align-items:center">';
  html += '<button class="btn btn-secondary btn-sm" onclick="copyUrl(\\'' + displaySlug + '\\')"><span class="icon">content_copy</span> Copy</button>';
  html += '<button class="btn btn-ghost btn-sm" onclick="showQRModal(' + id + ')"><span class="icon">qr_code_2</span> QR</button>';
  if (vanitySlug) {
    html += '<span style="color:var(--on-bg-muted);font-size:0.75rem;margin-left:0.5rem">or</span>';
    html += '<button class="btn btn-ghost btn-sm" style="font-size:0.75rem;opacity:0.7" onclick="copyUrl(\\'' + slug + '\\')"><span class="icon" style="font-size:14px">content_copy</span> /' + esc(slug) + '</button>';
  }
  html += '</div></div>';

  // Inline edit section
  const vanity = l.slugs.filter(s => s.is_vanity);
  const expVal = l.expires_at ? new Date(l.expires_at * 1000).toISOString().slice(0, 16) : '';
  html += '<div class="bento-card" style="margin-bottom:1.4rem">';
  html += '<div style="display:flex;gap:1.4rem;flex-wrap:wrap;align-items:flex-end">';
  // Vanity slug — show existing or add field
  html += '<div style="flex:1;min-width:200px"><label class="form-label">Vanity Slug</label>';
  if (vanity.length) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.4rem">';
    vanity.forEach(v => {
      html += '<span class="slug-chip vanity" style="cursor:default">/' + esc(v.slug) + '</span>';
    });
    html += '</div>';
  } else {
    html += '<div style="display:flex;gap:0.5rem"><input class="form-input" id="detail-vanity" placeholder="my-custom-slug"><button class="btn btn-secondary btn-sm" onclick="addVanityFromDetail(' + id + ')">Add</button></div>';
  }
  html += '</div>';
  // Expires at
  html += '<div style="flex:1;min-width:200px"><label class="form-label">Expires At</label>';
  html += '<div style="display:flex;gap:0.5rem;align-items:center"><input class="form-input" id="detail-expires" type="datetime-local" value="' + expVal + '" oninput="document.getElementById(\\'expiry-save-btn\\').disabled = !this.value">';
  html += '<button class="btn btn-ghost btn-sm" onclick="clearDetailExpiry(' + id + ')"' + (l.expires_at ? '' : ' disabled') + '>Clear</button>';
  html += '<button class="btn btn-secondary btn-sm" id="expiry-save-btn" onclick="saveDetailExpiry(' + id + ')"' + (expVal ? '' : ' disabled') + '>Save</button></div>';
  html += '</div>';
  html += '</div></div>';

  html += '<div class="detail-grid">';

  // Clicks over time chart
  html += '<div class="bento-card"><div class="bento-label">Clicks Over Time</div>';
  if (analytics.clicks_over_time.length > 0) {
    const maxVal = Math.max(1, ...analytics.clicks_over_time.map(d => d.count));
    html += '<div class="chart-container">';
    analytics.clicks_over_time.forEach(d => {
      const pct = (d.count / maxVal * 100).toFixed(0);
      html += '<div class="chart-bar" style="height:' + Math.max(2, pct) + '%" data-label="' + d.date + ': ' + d.count + '"></div>';
    });
    html += '</div>';
    html += '<div class="chart-dates"><span>' + analytics.clicks_over_time[0].date + '</span><span>' + analytics.clicks_over_time[analytics.clicks_over_time.length - 1].date + '</span></div>';
  } else {
    html += '<div style="color:var(--on-bg-muted);font-size:0.875rem;padding:2rem 0;text-align:center">No click data yet</div>';
  }
  html += '</div>';

  // Performance card
  html += '<div class="bento-card"><div class="bento-label">Performance</div>';
  html += '<div style="text-align:center;padding:1rem 0"><div style="font-family:var(--font-display);font-size:3rem;font-weight:700;color:var(--primary)">' + analytics.total_clicks + '</div><div style="color:var(--on-bg-muted);font-size:0.8rem">total clicks</div></div>';
  // Slugs breakdown
  const maxSC = Math.max(1, ...l.slugs.map(x => x.click_count));
  const maxSlugLen = Math.max(...l.slugs.map(x => x.slug.length + 1));
  const slugColWidth = Math.max(100, maxSlugLen * 9.6);
  l.slugs.forEach(s => {
    const pct = (s.click_count / maxSC * 100).toFixed(0);
    html += '<div class="stat-row"><span class="stat-name" style="font-family:var(--font-mono);min-width:' + slugColWidth + 'px;max-width:' + slugColWidth + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">/' + esc(s.slug) + '</span><div class="stat-bar"><div class="stat-fill ' + (s.is_vanity ? 'mint' : 'orange') + '" style="width:' + pct + '%"></div></div><span class="stat-count">' + s.click_count + '</span></div>';
  });
  html += '</div>';

  // Countries
  html += '<div class="bento-card"><div class="bento-label">Countries</div>';
  if (analytics.countries.length) {
    const maxCC = analytics.countries[0].count;
    analytics.countries.forEach(c => {
      html += '<div class="stat-row"><span class="stat-name">' + esc(countryName(c.name)) + '</span><div class="stat-bar"><div class="stat-fill orange" style="width:' + (c.count / maxCC * 100) + '%"></div></div><span class="stat-count">' + c.count + '</span></div>';
    });
  } else html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No data yet</div>';
  html += '</div>';

  // Referrers
  html += '<div class="bento-card"><div class="bento-label">Sources</div>';
  if (analytics.referrers.length) {
    const maxRR = analytics.referrers[0].count;
    analytics.referrers.forEach(r => {
      html += '<div class="stat-row"><span class="stat-name">' + esc(r.name) + '</span><div class="stat-bar"><div class="stat-fill mint" style="width:' + (r.count / maxRR * 100) + '%"></div></div><span class="stat-count">' + r.count + '</span></div>';
    });
  } else html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No data yet</div>';
  html += '</div>';

  // Devices
  html += '<div class="bento-card"><div class="bento-label">Devices</div>';
  if (analytics.devices.length) {
    const maxDD = analytics.devices[0].count;
    analytics.devices.forEach(d => {
      const icon = d.name === 'mobile' ? 'phone_android' : d.name === 'tablet' ? 'tablet' : 'computer';
      html += '<div class="stat-row"><span class="stat-name"><span class="icon" style="font-size:16px;vertical-align:text-bottom">' + icon + '</span> ' + esc(d.name) + '</span><div class="stat-bar"><div class="stat-fill orange" style="width:' + (d.count / maxDD * 100) + '%"></div></div><span class="stat-count">' + d.count + '</span></div>';
    });
  } else html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No data yet</div>';
  html += '</div>';

  // Browsers
  html += '<div class="bento-card"><div class="bento-label">Browsers</div>';
  if (analytics.browsers.length) {
    const maxBB = analytics.browsers[0].count;
    analytics.browsers.forEach(b => {
      html += '<div class="stat-row"><span class="stat-name">' + esc(b.name) + '</span><div class="stat-bar"><div class="stat-fill mint" style="width:' + (b.count / maxBB * 100) + '%"></div></div><span class="stat-count">' + b.count + '</span></div>';
    });
  } else html += '<div style="color:var(--on-bg-muted);font-size:0.875rem">No data yet</div>';
  html += '</div>';

  html += '</div>'; // detail-grid

  view.innerHTML = html;
}

// ---- Settings ----
async function loadSettings() {
  const res = await api('/settings');
  if (res.ok) {
    const data = await res.json();
    document.getElementById('slug-length-input').value = data.slug_default_length;
    updateComboHint();
  }
}

function updateComboHint() {
  const len = parseInt(document.getElementById('slug-length-input').value) || 3;
  const combos = Math.pow(56, Math.max(len, 3));
  document.getElementById('slug-combo-hint').textContent = len >= 3
    ? combos.toLocaleString() + ' possible combinations'
    : 'Minimum length is 3 characters';
}

document.getElementById('slug-length-input').addEventListener('input', updateComboHint);

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

async function checkForUpdates() {
  const el = document.getElementById('version-status');
  try {
    const res = await fetch('https://api.github.com/repos/oddbit/shrtnr/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) throw new Error('GitHub API error');
    const release = await res.json();
    const latest = (release.tag_name || '').replace(/^v/, '');
    if (!latest) throw new Error('No version tag');
    if (compareVersions(APP_VERSION, latest) < 0) {
      const releaseUrl = release.html_url || (REPO_URL + '/releases/tag/v' + latest);
      let html = '<div style="display:flex;flex-direction:column;gap:0.75rem">';
      html += '<div><span style="font-family:var(--font-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--on-bg-muted)">&rarr;</span> <span style="font-family:var(--font-mono);color:var(--secondary);font-weight:600">' + esc(latest) + '</span> available</div>';
      html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">';
      html += '<a href="' + esc(releaseUrl) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:0.4rem;text-decoration:none"><span class="icon" style="font-size:16px">open_in_new</span> Release notes</a>';
      html += '<a href="' + REPO_URL + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:0.4rem;text-decoration:none"><span class="icon" style="font-size:16px">code</span> View repo</a>';
      html += '</div>';
      html += '<div style="font-size:0.75rem;color:var(--on-bg-muted);line-height:1.5">To update: sync your fork on GitHub, then your deployment will redeploy automatically.</div>';
      html += '</div>';
      el.innerHTML = html;
    } else {
      el.innerHTML = '<span style="font-family:var(--font-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--secondary)"><span class="icon" style="font-size:16px;vertical-align:text-bottom">check_circle</span> Up to date</span>';
    }
  } catch (e) {
    el.innerHTML = '<span style="font-family:var(--font-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--on-bg-muted)">&middot; Could not check for updates</span>';
  }
}

async function saveSettings() {
  const val = parseInt(document.getElementById('slug-length-input').value);
  if (val < 3) { toast('Minimum slug length is 3', 'error'); return; }
  const res = await api('/settings', { method: 'PUT', body: JSON.stringify({ slug_default_length: val }) });
  if (res.ok) toast('Settings saved');
  else toast('Failed to save settings', 'error');
}

// ---- Theme ----
let currentTheme = 'oddbit';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}

async function setTheme(theme) {
  applyTheme(theme);
  const res = await api('/preferences', { method: 'PUT', body: JSON.stringify({ theme: theme }) });
  if (res.ok) toast('Theme updated');
  else toast('Failed to save theme', 'error');
}

async function loadPreferences() {
  const res = await api('/preferences');
  if (res.ok) {
    const prefs = await res.json();
    if (prefs.theme) applyTheme(prefs.theme);
  }
}

// ---- Create ----
function showCreateModal() {
  const len = document.getElementById('slug-length-input').value;
  openModal(
    '<div class="modal-title">New Link</div>' +
    '<div class="form-group"><label class="form-label">Destination URL *</label><input class="form-input" id="m-url" placeholder="https://example.com/long/path"></div>' +
    '<div class="form-group"><label class="form-label">Label (optional)</label><input class="form-input" id="m-label" placeholder="My Blog Post"></div>' +
    '<div class="form-row"><div class="form-group"><label class="form-label">Slug Length</label><input class="form-input" id="m-len" type="number" min="3" value="' + len + '"></div>' +
    '<div class="form-group"><label class="form-label">Vanity Slug (optional)</label><input class="form-input" id="m-vanity" placeholder="my-post"></div></div>' +
    '<div class="form-group"><label class="form-label">Expires At (optional)</label><input class="form-input" id="m-expires" type="datetime-local"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createLink()">Create</button></div>'
  );
}

async function createLink() {
  const url = document.getElementById('m-url').value.trim();
  if (!url) { toast('URL is required', 'error'); return; }
  const body = { url };
  const label = document.getElementById('m-label').value.trim();
  if (label) body.label = label;
  const len = parseInt(document.getElementById('m-len').value);
  if (len >= 3) body.slug_length = len;
  const vanity = document.getElementById('m-vanity').value.trim();
  if (vanity) body.vanity_slug = vanity;
  const exp = document.getElementById('m-expires').value;
  if (exp) body.expires_at = Math.floor(new Date(exp).getTime() / 1000);

  const res = await api('/links', { method: 'POST', body: JSON.stringify(body) });
  if (res.ok) {
    const link = await res.json();
    closeModal();
    toast('Link created');
    await loadLinks();
    showDetail(link.id);
  } else {
    const data = await res.json();
    toast(data.error || 'Failed to create link', 'error');
  }
}

// ---- Edit ----
function showEditModal(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;
  const exp = link.expires_at ? new Date(link.expires_at * 1000).toISOString().slice(0, 16) : '';
  const vanity = link.slugs.filter(s => s.is_vanity);
  let vanityHtml = vanity.length ? '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem">' + vanity.map(v =>
    '<span class="slug-chip vanity">/' + esc(v.slug) + ' <span style="cursor:pointer;color:var(--danger)" onclick="removeVanity(' + id + ',\\'' + v.slug + '\\')"><span class="icon" style="font-size:14px">close</span></span></span>'
  ).join('') + '</div>' : '';

  openModal(
    '<div class="modal-title">Edit Link</div>' +
    '<div class="form-group"><label class="form-label">Destination URL</label><input class="form-input" id="m-url" value="' + esc(link.url) + '"></div>' +
    '<div class="form-group"><label class="form-label">Label</label><input class="form-input" id="m-label" value="' + (link.label ? esc(link.label) : '') + '"></div>' +
    '<div class="form-group"><label class="form-label">Expires At</label><input class="form-input" id="m-expires" type="datetime-local" value="' + exp + '"></div>' +
    '<div class="form-group"><label class="form-label">Vanity Slugs</label>' + vanityHtml + '<div style="display:flex;gap:0.5rem"><input class="form-input" id="m-new-vanity" placeholder="new-vanity-slug"><button class="btn btn-secondary btn-sm" onclick="addVanity(' + id + ')">Add</button></div></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="updateLink(' + id + ')">Save</button></div>'
  );
}

async function updateLink(id) {
  const body = {};
  const url = document.getElementById('m-url').value.trim();
  if (url) body.url = url;
  body.label = document.getElementById('m-label').value.trim() || null;
  const exp = document.getElementById('m-expires').value;
  body.expires_at = exp ? Math.floor(new Date(exp).getTime() / 1000) : null;

  const res = await api('/links/' + id, { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) {
    closeModal();
    toast('Link updated');
    loadLinks();
  } else {
    const data = await res.json();
    toast(data.error || 'Failed to update', 'error');
  }
}

async function addVanity(linkId) {
  const slug = document.getElementById('m-new-vanity').value.trim();
  if (!slug) return;
  const res = await api('/links/' + linkId + '/slugs', { method: 'POST', body: JSON.stringify({ slug }) });
  if (res.ok) {
    toast('Vanity slug added');
    await loadLinks();
    showEditModal(linkId);
  } else {
    const data = await res.json();
    toast(data.error || 'Failed to add vanity slug', 'error');
  }
}

async function addVanityFromDetail(linkId) {
  const slug = document.getElementById('detail-vanity').value.trim();
  if (!slug) return;
  const res = await api('/links/' + linkId + '/slugs', { method: 'POST', body: JSON.stringify({ slug }) });
  if (res.ok) {
    toast('Vanity slug added');
    await loadLinks();
    showDetail(linkId);
  } else {
    const data = await res.json();
    toast(data.error || 'Failed to add vanity slug', 'error');
  }
}

async function saveDetailExpiry(linkId) {
  const exp = document.getElementById('detail-expires').value;
  const body = { expires_at: exp ? Math.floor(new Date(exp).getTime() / 1000) : null };
  const res = await api('/links/' + linkId, { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) {
    toast('Expiry updated');
    await loadLinks();
    showDetail(linkId);
  } else {
    const data = await res.json();
    toast(data.error || 'Failed to update', 'error');
  }
}

async function removeVanity(linkId, slug) {
  const res = await api('/links/' + linkId + '/slugs/' + encodeURIComponent(slug), { method: 'DELETE' });
  if (res.ok) {
    toast('Vanity slug removed');
    await loadLinks();
    showEditModal(linkId);
  } else {
    toast('Failed to remove vanity slug', 'error');
  }
}

// ---- Disable / Enable ----
async function disableLink(id) {
  if (!confirm('Disable this link? It will stop redirecting immediately.')) return;
  const res = await api('/links/' + id + '/disable', { method: 'POST' });
  if (res.ok) {
    toast('Link disabled');
    await loadLinks();
    showDetail(id);
  } else toast('Failed to disable', 'error');
}

async function enableLink(id) {
  const res = await api('/links/' + id, { method: 'PUT', body: JSON.stringify({ expires_at: null }) });
  if (res.ok) {
    toast('Link enabled');
    await loadLinks();
    showDetail(id);
  } else toast('Failed to enable', 'error');
}

async function clearDetailExpiry(linkId) {
  const res = await api('/links/' + linkId, { method: 'PUT', body: JSON.stringify({ expires_at: null }) });
  if (res.ok) {
    toast('Expiry cleared');
    await loadLinks();
    showDetail(linkId);
  } else toast('Failed to clear expiry', 'error');
}

// ---- QR Code ----
function showQRModal(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;
  const vanity = link.slugs.find(s => s.is_vanity);
  const primary = link.slugs.find(s => !s.is_vanity);
  const slug = vanity ? vanity.slug : (primary ? primary.slug : (link.slugs[0]?.slug || ''));
  const url = location.origin + '/' + slug;

  openModal(
    '<div class="modal-title">QR Code</div>' +
    '<p style="text-align:center;font-size:0.85rem;color:var(--on-bg-muted);margin-bottom:1rem">' + esc(url) + '</p>' +
    '<div class="qr-wrap" id="qr-target"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>'
  );
  generateQR(url, document.getElementById('qr-target'));
}

function generateQR(text, container) {
  const size = 220;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const qr = makeQR(text);
  if (!qr) { container.textContent = 'QR generation failed'; return; }
  const modules = qr.length;
  const cellSize = size / modules;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#001110';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr[r][c]) ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
    }
  }
  container.appendChild(canvas);
}

function makeQR(text) {
  const data = [];
  for (let i = 0; i < text.length; i++) data.push(text.charCodeAt(i));
  const caps = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  let ver = 1;
  while (ver <= 10 && caps[ver] < data.length) ver++;
  if (ver > 10) return null;
  const size = ver * 4 + 17;
  const grid = Array.from({length: size}, () => new Uint8Array(size));
  const reserved = Array.from({length: size}, () => new Uint8Array(size));
  function setFinder(r, c) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = 1;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          grid[rr][cc] = (edge || inner) ? 1 : 0;
        }
      }
    }
  }
  setFinder(0, 0); setFinder(0, size - 7); setFinder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = 1; grid[6][i] = (i % 2 === 0) ? 1 : 0;
    reserved[i][6] = 1; grid[i][6] = (i % 2 === 0) ? 1 : 0;
  }
  if (ver >= 2) {
    const aligns = [6, [0,0], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50]][ver];
    if (Array.isArray(aligns)) {
      for (const ar of aligns) {
        for (const ac of aligns) {
          if (reserved[ar]?.[ac]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const rr = ar + dr, cc = ac + dc;
              if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
                reserved[rr][cc] = 1;
                grid[rr][cc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
              }
            }
          }
        }
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = 1; reserved[8][size - 1 - i] = 1;
    reserved[i][8] = 1; reserved[size - 1 - i][8] = 1;
  }
  reserved[8][8] = 1;
  reserved[size - 8][8] = 1; grid[size - 8][8] = 1;
  const eccL = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  const totalCodewords = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const numEcc = eccL[ver];
  const numData = totalCodewords[ver] - numEcc;
  let bits = '';
  bits += '0100';
  bits += (ver <= 9 ? toBin(data.length, 8) : toBin(data.length, 16));
  for (const b of data) bits += toBin(b, 8);
  const maxBits = numData * 8;
  bits += '0000'.slice(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8) bits += '0';
  const pads = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < maxBits) { bits += toBin(pads[pi % 2], 8); pi++; }
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) dataBytes.push(parseInt(bits.slice(i, i + 8), 2));
  const eccBytes = rsEncode(dataBytes, numEcc);
  const allBytes = [...dataBytes, ...eccBytes];
  let bitStr = '';
  for (const b of allBytes) bitStr += toBin(b, 8);
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5;
    const rows = upward ? Array.from({length: size}, (_, i) => size - 1 - i) : Array.from({length: size}, (_, i) => i);
    for (const row of rows) {
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || reserved[row][c]) continue;
        grid[row][c] = bitIdx < bitStr.length ? parseInt(bitStr[bitIdx++]) : 0;
      }
    }
    upward = !upward;
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) grid[r][c] ^= 1;
    }
  }
  const fmtBits = [1,1,1,0,1,1,1,1,1,0,0,1,0,1,0];
  for (let i = 0; i < 6; i++) grid[8][i] = fmtBits[i];
  grid[8][7] = fmtBits[6]; grid[8][8] = fmtBits[7]; grid[7][8] = fmtBits[8];
  for (let i = 0; i < 6; i++) grid[5 - i][8] = fmtBits[9 + i];
  for (let i = 0; i < 7; i++) grid[size - 1 - i][8] = fmtBits[i];
  for (let i = 0; i < 8; i++) grid[8][size - 8 + i] = fmtBits[7 + i];
  return grid;
}
function toBin(n, len) { return n.toString(2).padStart(len, '0'); }
function rsEncode(data, numEcc) {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11D : 0); }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  function gfMul(a, b) { return a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]; }
  let gen = [1];
  for (let i = 0; i < numEcc; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) { newGen[j] ^= gen[j]; newGen[j + 1] ^= gfMul(gen[j], exp[i]); }
    gen = newGen;
  }
  const msg = new Uint8Array(data.length + numEcc);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
  }
  return Array.from(msg.slice(data.length));
}

// ---- Routing ----
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.view) {
    if (e.state.view === 'detail' && e.state.slug) {
      showDetailBySlug(e.state.slug, false);
    } else {
      switchView(e.state.view, false);
    }
  } else {
    routeFromPath();
  }
});

async function showDetailBySlug(slug, pushState) {
  if (!links.length) await loadLinks();
  const link = links.find(l => l.slugs.some(s => s.slug === slug));
  if (link) {
    showDetail(link.id, pushState);
  } else {
    switchView('links', pushState);
  }
}

function routeFromPath() {
  const path = location.pathname;
  if (path.startsWith('/_/admin/link/')) {
    const slug = decodeURIComponent(path.replace('/_/admin/link/', ''));
    showDetailBySlug(slug, false);
    history.replaceState({ view: 'detail', slug: slug }, '', path);
    return;
  }
  if (path === '/_/admin/links') {
    switchView('links', false);
    history.replaceState({ view: 'links' }, '', path);
    return;
  }
  if (path === '/_/admin/settings') {
    switchView('settings', false);
    history.replaceState({ view: 'settings' }, '', path);
    return;
  }
  // Default: dashboard. Rewrite URL if bare /_/admin
  switchView('dashboard', false);
  history.replaceState({ view: 'dashboard' }, '', '/_/admin/dashboard');
}

// ---- Init ----
loadSettings();
loadPreferences();
loadLinks().then(function() { routeFromPath(); });
</script>
</body>
</html>`;
