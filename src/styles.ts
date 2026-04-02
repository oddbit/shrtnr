// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap";

// Design tokens and box-model reset shared by all standalone pages.
export const standaloneBaseStyles = `
  :root {
    --bg: #001110;
    --on-bg: #d3fcf6;
    --on-bg-muted: #8cb3ae;
    --primary: #ff9061;
    --card-bg: #001e1c;
    --border: #294e4b;
    --radius: 8px;
    --font-display: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Manrope', system-ui, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--on-bg);
    font-family: var(--font-body);
    line-height: 1.6;
  }
`;

// Full-screen centered layout for pages like 404. Extends standaloneBaseStyles.
export const standaloneCenteredStyles = `${standaloneBaseStyles}
  body {
    font-family: var(--font-display);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
`;

/** @deprecated Use standaloneBaseStyles or standaloneCenteredStyles */
export const standalonePageStyles = standaloneCenteredStyles;

export const adminStyles = `
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
  --on-primary: #1a0800;
  --on-secondary: #0a1a09;
  --on-danger: #fff;
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
  --on-primary: #1a0800;
  --on-secondary: #0a1a09;
  --on-danger: #fff;
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
  --on-primary: #fff;
  --on-secondary: #fff;
  --on-danger: #fff;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-body); background: var(--bg); color: var(--on-bg); min-height: 100vh; display: flex; }
.icon { font-family: 'Material Symbols Outlined'; font-size: 20px; vertical-align: middle; font-variation-settings: 'FILL' 0, 'wght' 400; }
.icon-fill { font-variation-settings: 'FILL' 1, 'wght' 400; }

/* Sidebar */
.sidebar { width: 240px; background: var(--surface-low); padding: 1.5rem 1rem; display: flex; flex-direction: column; min-height: 100vh; position: fixed; left: 0; top: 0; }
.sidebar-brand { color: var(--on-bg); margin-bottom: 2rem; padding: 0 0.5rem; }
.sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: var(--radius); color: var(--on-bg-muted); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); text-decoration: none; }
.nav-item:hover { color: var(--on-bg); background: var(--surface); }
.nav-item.active { color: var(--secondary); background: var(--secondary-container); }
.sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 0.75rem; }
.sidebar-user { border-top: 1px solid var(--border); padding: 0.75rem 0.5rem 0; }
.sidebar-user-email { font-size: 0.75rem; color: var(--on-bg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-logout { display: inline-flex; align-items: center; font-size: 0.7rem; color: var(--on-bg-muted); text-decoration: none; margin-top: 0.4rem; opacity: 0.7; transition: opacity 0.2s, color 0.2s; }
.sidebar-logout:hover { opacity: 1; color: var(--on-bg); }
.sidebar-oddbit { text-align: center; padding: 0.75rem 0 0.25rem; }
.sidebar-oddbit a { display: inline-block; opacity: 0.5; transition: opacity 0.2s; color: var(--on-bg-muted); }
.sidebar-oddbit a:hover { opacity: 0.8; }
[data-theme="light"] .sidebar-oddbit a { color: #09322f; opacity: 1; }
[data-theme="light"] .sidebar { background: #dce3dd; border-right: 1px solid #c4cdc7; }
[data-theme="light"] .bento-card { box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #dfe3e0; }
[data-theme="light"] .bento-card:hover { background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
[data-theme="light"] .hero-input { background: #ffffff; border-color: #c4cdc7; }
[data-theme="light"] .modal-inner { box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
[data-theme="light"] .slug-chip { border-color: #c4cdc7; }
[data-theme="light"] .stat-bar { background: #dfe3e0; }
[data-theme="light"] .nav-item.active { color: #1b5e20; }
[data-theme="oddbit"] .sidebar-oddbit a, :root .sidebar-oddbit a { color: #a7e3a1; }
.sidebar-oddbit img { width: 80px; height: auto; }
.sidebar-oddbit .copyright { font-size: 0.65rem; color: var(--on-bg-muted); margin-top: 0.25rem; opacity: 0.5; }
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
.link-item { background: var(--surface); border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1rem; transition: background 0.2s; display: flex; align-items: center; gap: 1rem; cursor: pointer; text-decoration: none; color: inherit; }
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
.btn-primary { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: var(--on-primary); }
.btn-primary:hover { filter: brightness(1.1); }
.btn-secondary { background: var(--secondary); color: var(--on-secondary); }
.btn-secondary:hover { filter: brightness(1.1); }
.btn-ghost { background: transparent; color: var(--on-bg-muted); border: 2px solid var(--outline); }
.btn-ghost:hover { border-color: var(--on-bg-muted); color: var(--on-bg); }
.btn-danger { background: var(--danger); color: var(--on-danger); }
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
.toast-success { background: var(--secondary); color: var(--on-secondary); }
.toast-error { background: var(--danger); color: var(--on-danger); }
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
.detail-back { background: none; border: none; color: var(--on-bg-muted); cursor: pointer; padding: 0.4rem; border-radius: var(--radius); text-decoration: none; display: inline-flex; }
.detail-back:hover { color: var(--on-bg); background: var(--surface); }
.detail-hero { background: var(--surface); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.4rem; }
.detail-hero-grid { display: grid; grid-template-columns: 1fr auto; gap: 0; align-items: stretch; }
.detail-hero-main { min-width: 0; padding-right: 2rem; display: flex; flex-direction: column; justify-content: center; grid-row: span 2; }
.detail-hero-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 2rem; padding: 0 0 0.75rem 2rem; border-left: 1px solid var(--border); align-content: end; min-width: 340px; }
.detail-hero-config { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 2rem; padding: 0.75rem 0 0 2rem; border-left: 1px solid var(--border); border-top: 1px solid var(--border); align-content: start; min-width: 340px; }
.detail-short-url { font-family: var(--font-display); font-size: 1.75rem; font-weight: 700; color: var(--primary); word-break: break-all; }
.detail-dest { font-size: 0.85rem; color: var(--on-bg-muted); margin-top: 0.25rem; word-break: break-all; }
.detail-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.4rem; }
.detail-grid .bento-card { margin-bottom: 0; }

/* Inline edit */
.inline-edit { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; border-radius: var(--radius); padding: 0.2rem 0.4rem; margin: -0.2rem -0.4rem; transition: background 0.15s; }
.inline-edit:hover { background: var(--surface-low); }
.inline-edit-value { font-size: 0.9rem; color: var(--on-bg); }
.inline-edit-placeholder { font-size: 0.85rem; color: var(--on-bg-muted); font-style: italic; }
.inline-edit-icon { font-size: 14px; color: var(--on-bg-muted); opacity: 0; transition: opacity 0.15s; }
.inline-edit:hover .inline-edit-icon { opacity: 0.7; }
.inline-edit-form { display: flex; align-items: center; gap: 0.35rem; }
.inline-edit-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius); cursor: pointer; padding: 0; transition: background 0.15s; }
.inline-edit-btn .icon { font-size: 16px; }
.inline-edit-btn.confirm { background: rgba(181,242,175,0.15); color: var(--secondary); }
.inline-edit-btn.confirm:hover { background: rgba(181,242,175,0.3); }
.inline-edit-btn.cancel { background: transparent; color: var(--on-bg-muted); }
.inline-edit-btn.cancel:hover { background: var(--surface-low); color: var(--on-bg); }
.form-input-sm { padding: 0.4rem 0.65rem; font-size: 0.85rem; }

/* Settings bar */
.settings-inline { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; background: var(--surface); border-radius: var(--radius-lg); margin-bottom: 1.4rem; }
.settings-inline .form-label { margin: 0; }
.settings-inline .form-input { width: 70px; }

/* Toolbar */
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.4rem; }
.toolbar-count { color: var(--on-bg-muted); font-size: 0.875rem; }
.toolbar-sort { display: flex; gap: 0.25rem; }
.sort-btn { background: transparent; border: 2px solid var(--outline); border-radius: var(--radius); color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.75rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.3rem; text-decoration: none; }
.sort-btn:hover { border-color: var(--on-bg-muted); color: var(--on-bg); }
.sort-btn.active { border-color: var(--secondary); color: var(--secondary); }
.link-disabled { opacity: 0.5; }
.disabled-badge { display: inline-flex; align-items: center; gap: 0.2rem; background: var(--danger); color: var(--on-danger); font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: var(--radius); text-transform: uppercase; letter-spacing: 0.05em; }
.link-date { font-size: 0.7rem; color: var(--on-bg-muted); margin-top: 0.2rem; }
.pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 1.4rem; padding: 0.75rem 0; }
.pagination-pages { display: flex; gap: 0.25rem; }
.page-btn { background: transparent; border: 2px solid var(--outline); border-radius: var(--radius); color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; min-width: 2rem; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.page-btn:hover { border-color: var(--on-bg-muted); color: var(--on-bg); }
.page-btn.active { border-color: var(--primary); color: var(--primary); }
.page-btn:disabled, .page-btn.disabled { opacity: 0.3; cursor: default; pointer-events: none; }
.per-page { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--on-bg-muted); }
.per-page-btn { background: transparent; border: none; color: var(--on-bg-muted); font-family: var(--font-body); font-size: 0.75rem; font-weight: 600; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: var(--radius); text-decoration: none; }
.per-page-btn:hover { color: var(--on-bg); }
.per-page-btn.active { color: var(--secondary); }

/* Keys table */
.keys-table { width: 100%; border-collapse: collapse; }
.keys-table th { text-align: left; font-size: 0.7rem; color: var(--secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.6rem 1rem; border-bottom: 2px solid var(--outline); }
.keys-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--outline); font-size: 0.875rem; vertical-align: middle; }
.keys-table tr:last-child td { border-bottom: none; }
.keys-table tr:hover td { background: var(--surface-high); }
.scope-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: var(--radius); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.scope-badge.create { background: var(--primary-glow); color: var(--primary); border: 1px solid var(--primary); }
.scope-badge.read { background: rgba(181,242,175,0.1); color: var(--secondary); border: 1px solid var(--secondary); }
.key-revealed { font-family: var(--font-mono); font-size: 0.8rem; background: var(--surface-low); border: 2px solid var(--secondary); border-radius: var(--radius); padding: 0.75rem 1rem; word-break: break-all; line-height: 1.6; }
.key-warning { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; color: var(--primary); margin-top: 0.75rem; }

/* Empty state */
.empty-state { text-align: center; padding: 4rem 2rem; color: var(--on-bg-muted); }
.empty-state .icon { font-size: 48px; margin-bottom: 1rem; display: block; }
.empty-state p { margin-bottom: 1rem; }

/* Mobile navigation */
.mobile-header { display: none; align-items: center; gap: 0.75rem; background: var(--surface-low); position: sticky; top: 0; z-index: 50; border-bottom: 1px solid var(--outline); }
.mobile-brand { color: var(--on-bg); }
.mobile-menu-btn { background: none; border: none; color: var(--on-bg); cursor: pointer; padding: 0.4rem; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; }
.mobile-menu-btn:hover { background: var(--surface-high); }
.sidebar-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 55; }
.sidebar-backdrop.open { display: block; }

/* Responsive */
@media (max-width: 768px) {
  body { overflow-x: hidden; }
  .mobile-header { display: flex; padding: 0.75rem 1rem; margin: -1rem -1rem 1rem; }
  .sidebar { transform: translateX(-100%); transition: transform 0.25s ease; z-index: 60; }
  .sidebar.open { transform: translateX(0); }
  .sidebar-backdrop.open { display: block; }
  .main { margin-left: 0; padding: 1rem; max-width: 100vw; overflow-x: hidden; }
  .page-title { font-size: 1.5rem; }
  .bento { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .bento-card { padding: 1rem 1.1rem; grid-column: span 1; }
  .bento-card.span-2, .bento-card.span-3 { grid-column: 1 / -1; }
  .bento-value { font-size: 1.5rem; }
  .detail-grid { grid-template-columns: 1fr; }
  .detail-hero-grid { grid-template-columns: 1fr; }
  .detail-hero-main { grid-row: span 1; padding-right: 0; }
  .detail-hero-meta { border-left: none; border-top: 1px solid var(--border); padding: 1.25rem 0 0; min-width: 0; }
  .detail-hero-config { border-left: none; border-top: 1px solid var(--border); padding: 1.25rem 0 0; min-width: 0; }
  .detail-hero-meta, .detail-hero-config { grid-template-columns: 1fr; }
  .hero-input-wrap { flex-direction: column; }
  .form-row { flex-direction: column; }
  .toolbar { flex-wrap: wrap; gap: 0.5rem; }
  .toolbar > .btn { width: 100%; justify-content: center; }
  .link-item { gap: 0.75rem; }
  .link-url { white-space: normal; word-break: break-all; }
  .link-clicks { font-size: 1rem; }
  .stat-name { flex: 1; min-width: 0; max-width: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stat-bar { display: none; }
  .stat-count { min-width: 28px; }
  .keys-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .keys-table thead { display: none; }
  .keys-table, .keys-table tbody, .keys-table tr, .keys-table td { display: block; width: 100%; }
  .keys-table tr { padding: 0.75rem 1rem; border-bottom: 1px solid var(--outline); }
  .keys-table tr:last-child { border-bottom: none; }
  .keys-table td { padding: 0.2rem 0; border-bottom: none; background: transparent !important; }
  .keys-table td:before { content: attr(data-label); display: block; font-size: 0.65rem; color: var(--secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem; }
  .keys-table td:last-child { margin-top: 0.5rem; }
  .keys-table td:last-child:before { display: none; }
  .settings-layout { flex-direction: column !important; }
  .settings-layout > div:last-child { max-width: 100% !important; }
  .pagination { flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
}
`;
