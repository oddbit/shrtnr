// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap";

export const themes = {
  oddbit: {
    /* foundation */
    "--brand-base": "#09322f",
    "--brand-surface": "#001e1c",
    "--brand-surface-2": "#0f3b37",
    "--brand-accent": "#ff7637",
    "--brand-accent-soft": "#ff9061",
    "--brand-positive": "#a7e3a1",
    "--brand-info": "#a4e4ff",
    "--brand-neutral": "#ffffff",
    "--brand-danger": "#ef4444",

    /* semantic */
    "--color-canvas": "#001916",
    "--color-surface": "#062824",
    "--color-surface-raised": "#0b322e",
    "--color-surface-interactive": "#12403b",

    "--color-text": "#ecfff8",
    "--color-text-muted": "#9fc3bc",
    "--color-text-subtle": "#6f9790",
    "--color-text-inverse": "#09322f",

    "--color-border": "#1f4b46",
    "--color-border-strong": "#35665f",

    "--color-accent": "#ff7637",
    "--color-accent-hover": "#ff9061",
    "--color-accent-active": "#e76328",
    "--color-accent-foreground": "#ffffff",

    "--color-success": "#a7e3a1",
    "--color-success-foreground": "#09322f",

    "--color-danger": "#ef4444",
    "--color-danger-foreground": "#ffffff",

    "--color-info": "#a4e4ff",
    "--color-info-foreground": "#09322f",

    "--color-focus-ring": "#a4e4ff",
    "--color-selection": "rgba(255, 118, 55, 0.22)",

    "--color-disabled-bg": "#13312e",
    "--color-disabled-text": "#62847e",

    "--shadow-color": "rgba(0, 0, 0, 0.35)",
  },

  dark: {
    /* foundation */
    "--brand-base": "#0b0f14",
    "--brand-surface": "#151b23",
    "--brand-surface-2": "#1c2530",
    "--brand-accent": "#ff7637",
    "--brand-accent-soft": "#ff9061",
    "--brand-positive": "#79c98f",
    "--brand-info": "#7dcfff",
    "--brand-neutral": "#ffffff",
    "--brand-danger": "#ef4444",

    /* semantic */
    "--color-canvas": "#0b0f14",
    "--color-surface": "#151b23",
    "--color-surface-raised": "#1b2430",
    "--color-surface-interactive": "#243142",

    "--color-text": "#f3f7fb",
    "--color-text-muted": "#a3b1c2",
    "--color-text-subtle": "#7b8a9c",
    "--color-text-inverse": "#0b0f14",

    "--color-border": "#293241",
    "--color-border-strong": "#3a4658",

    "--color-accent": "#ff7637",
    "--color-accent-hover": "#ff9061",
    "--color-accent-active": "#e76328",
    "--color-accent-foreground": "#ffffff",

    "--color-success": "#79c98f",
    "--color-success-foreground": "#08110c",

    "--color-danger": "#ef4444",
    "--color-danger-foreground": "#ffffff",

    "--color-info": "#7dcfff",
    "--color-info-foreground": "#081018",

    "--color-focus-ring": "#7dcfff",
    "--color-selection": "rgba(255, 118, 55, 0.2)",

    "--color-disabled-bg": "#1b2430",
    "--color-disabled-text": "#647487",

    "--shadow-color": "rgba(0, 0, 0, 0.4)",
  },

  light: {
    /* foundation */
    "--brand-base": "#fcfdfc",
    "--brand-surface": "#f3f7f5",
    "--brand-surface-2": "#e7efeb",
    "--brand-accent": "#f9733d",
    "--brand-accent-soft": "#ff9a6f",
    "--brand-positive": "#8fd39a",
    "--brand-info": "#8ed4f2",
    "--brand-neutral": "#12322f",
    "--brand-danger": "#bf3a32",

    /* semantic */
    "--color-canvas": "#eef4f1",
    "--color-surface": "#f8fbf9",
    "--color-surface-raised": "#ffffff",
    "--color-surface-interactive": "#e4eeea",

    "--color-text": "#173632",
    "--color-text-muted": "#4d6864",
    "--color-text-subtle": "#718783",
    "--color-text-inverse": "#ffffff",

    "--color-section-label": "#12322f",
    "--color-text-accent": "#2f5a52",

    "--color-border": "#cddbd6",
    "--color-border-strong": "#b3c6bf",

    "--color-accent": "#f9733d",
    "--color-accent-hover": "#ff8657",
    "--color-accent-active": "#e36531",
    "--color-accent-foreground": "#ffffff",

    "--color-success": "#8fd39a",
    "--color-success-foreground": "#173632",

    "--color-danger": "#bf3a32",
    "--color-danger-foreground": "#ffffff",

    "--color-info": "#8ed4f2",
    "--color-info-foreground": "#173632",

    "--color-focus-ring": "#59b8df",
    "--color-selection": "rgba(249, 115, 61, 0.14)",

    "--color-disabled-bg": "#e8efec",
    "--color-disabled-text": "#8a9d98",

    "--shadow-color": "rgba(18, 50, 47, 0.10)"
  },
} as const;

const themeEntries = (theme: keyof typeof themes) =>
  Object.entries(themes[theme])
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");

// Design tokens and box-model reset shared by all standalone pages.
export const standaloneBaseStyles = `
  :root {
    ${themeEntries("oddbit")}
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --font-family-display: 'Space Grotesk', system-ui, sans-serif;
    --font-family-body: 'Manrope', system-ui, sans-serif;
    --font-family-mono: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--color-canvas);
    color: var(--color-text);
    font-family: var(--font-family-body);
    line-height: 1.6;
  }
`;

// Full-screen centered layout for pages like 404. Extends standaloneBaseStyles.
export const standaloneCenteredStyles = `${standaloneBaseStyles}
  body {
    font-family: var(--font-family-display);
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
  ${themeEntries("oddbit")}
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --font-family-display: 'Space Grotesk', system-ui, sans-serif;
  --font-family-body: 'Manrope', system-ui, sans-serif;
  --font-family-mono: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
}
[data-theme="dark"] {
  ${themeEntries("dark")}
}
[data-theme="light"] {
  ${themeEntries("light")}
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-family-body); background: var(--color-canvas); color: var(--color-text); min-height: 100vh; display: flex; }
.icon { font-family: 'Material Symbols Outlined'; font-size: 20px; vertical-align: middle; font-variation-settings: 'FILL' 0, 'wght' 400; }
.icon-fill { font-variation-settings: 'FILL' 1, 'wght' 400; }

/* Sidebar */
.sidebar { width: 240px; background: var(--color-surface); padding: 1.5rem 1rem; display: flex; flex-direction: column; min-height: 100vh; position: fixed; left: 0; top: 0; }
.sidebar-brand { color: var(--color-text); margin-bottom: 2rem; padding: 0 0.5rem; }
.sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: var(--radius-md); color: var(--color-text-muted); font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); text-decoration: none; }
.nav-item:hover { color: var(--color-text); background: var(--color-surface-raised); }
.nav-item.active { color: var(--color-success); background: var(--color-disabled-bg); }
.sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 0.75rem; }
.sidebar-user { border-top: 1px solid var(--color-border); padding: 0.75rem 0.5rem 0; }
.sidebar-user-email { font-size: 0.75rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-logout { display: inline-flex; align-items: center; font-size: 0.7rem; color: var(--color-text-muted); text-decoration: none; margin-top: 0.4rem; opacity: 0.7; transition: opacity 0.2s, color 0.2s; }
.sidebar-logout:hover { opacity: 1; color: var(--color-text); }
.sidebar-oddbit { text-align: center; padding: 0.75rem 0 0.25rem; }
.sidebar-oddbit a { display: inline-block; opacity: 0.5; transition: opacity 0.2s; color: var(--color-text-muted); }
.sidebar-oddbit a:hover { opacity: 0.8; }
[data-theme="light"] .sidebar-oddbit a { color: #09322f; opacity: 1; }
[data-theme="light"] .sidebar { background: #dce3dd; border-right: 1px solid var(--color-border); }
[data-theme="light"] .bento-card { box-shadow: 0 1px 3px var(--shadow-color); border: 1px solid var(--color-border); }
[data-theme="light"] .bento-card:hover { background: var(--color-surface); box-shadow: 0 2px 8px var(--shadow-color); }
[data-theme="light"] .hero-input { background: var(--color-surface); border-color: var(--color-border); }
[data-theme="light"] .modal-inner { box-shadow: 0 8px 32px var(--shadow-color); }
[data-theme="light"] .slug-chip { border-color: var(--color-border); }
[data-theme="light"] .stat-row .bar { background: var(--color-surface-interactive); }
[data-theme="light"] .nav-item.active { color: #1b5e20; }
[data-theme="oddbit"] .sidebar-oddbit a, :root .sidebar-oddbit a { color: var(--color-success); }
.sidebar-oddbit img { width: 80px; height: auto; }
.sidebar-brand img { height: 2rem; }
.sidebar-oddbit a img { height: 1.25rem; width: auto; }
.mobile-brand img { height: 1.5rem; }
.sidebar-oddbit .copyright { font-size: 0.65rem; color: var(--color-text-muted); margin-top: 0.25rem; opacity: 0.5; }
/* Main */
.main { margin-left: 240px; flex: 1; padding: 2rem 2.5rem; min-height: 100vh; }

/* Page header */
.page-header { margin-bottom: 2rem; }
.page-title { font-family: var(--font-family-display); font-size: 2rem; font-weight: 700; }
.page-subtitle { color: var(--color-text-muted); font-size: 0.875rem; margin-top: 0.25rem; }

/* KPI strip — top-row metrics at four equal columns. */
.kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.4rem; margin-bottom: 1.4rem; }
.kpi-strip .bento-card { min-width: 0; }

/* Bento grid */
.bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; margin-bottom: 2rem; }
.bento-card { background: var(--color-surface-raised); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; transition: background 0.2s; }
.bento-card:hover { background: var(--color-surface-interactive); }
.bento-card.span-2 { grid-column: span 2; }
.bento-card.span-3 { grid-column: span 3; }
.bento-label { font-size: 0.75rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
.bento-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.bento-head .bento-label { margin-bottom: 0; }
.bento-count { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); background: var(--color-surface); padding: 0.2rem 0.6rem; border-radius: 999px; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; line-height: 1.4; }
.bento-value { font-family: var(--font-family-display); font-size: 2rem; font-weight: 700; }
.bento-value.small { font-size: 1rem; font-weight: 500; }

/* Stat bar rows: name + count + pct on row 1, full-width bar on row 2 */
.stat-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 0.75rem; row-gap: 0.35rem; padding: 0.4rem 0; }
.stat-row .name { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; min-width: 0; color: var(--color-text); }
.stat-row .name .flag { min-width: 22px; height: 16px; padding: 0 0.25rem; border-radius: 2px; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-active)); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; color: #fff; letter-spacing: 0.02em; text-transform: uppercase; }
.stat-row .name .icon { font-size: 16px; color: var(--color-text-subtle); flex-shrink: 0; }
.stat-row .name .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.stat-row .name.mono .label { font-family: var(--font-family-mono); font-size: 0.82rem; }
.stat-row .right { display: flex; align-items: baseline; gap: 0.6rem; justify-content: flex-end; font-variant-numeric: tabular-nums; }
.stat-row .count { font-size: 0.95rem; color: var(--color-text); font-weight: 700; }
.stat-row .pct { font-size: 0.75rem; color: var(--color-text-subtle); min-width: 34px; text-align: right; }
.stat-row .bar { grid-column: 1 / -1; height: 4px; background: var(--color-surface); border-radius: 2px; overflow: hidden; }
.stat-row .bar .fill { height: 100%; border-radius: 2px; transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
.stat-row .bar .fill.orange { background: linear-gradient(135deg, var(--color-accent), var(--color-accent-active)); }
.stat-row .bar .fill.mint { background: var(--color-success); }

/* Links list */
.link-item { background: var(--color-surface-raised); border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1rem; transition: background 0.2s; display: flex; align-items: center; gap: 1rem; cursor: pointer; text-decoration: none; color: inherit; }
.link-item:hover { background: var(--color-surface-interactive); }
.link-info { flex: 1; min-width: 0; }
.link-slugs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.3rem; }
.slug-chip { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--color-surface-interactive); border: 2px solid var(--color-border); border-radius: var(--radius-md); padding: 0.15rem 0.5rem; font-family: var(--font-family-mono); font-size: 0.72rem; cursor: pointer; transition: border-color 0.2s; }
.slug-chip:hover { border-color: var(--color-success); }
.slug-chip.custom { border-color: var(--color-accent); }
.slug-chip .icon { font-size: 14px; }
.link-url { font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-label { font-size: 1.0rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-meta { display: flex; align-items: center; gap: 1.5rem; }
.link-clicks { font-family: var(--font-family-display); font-size: 1.25rem; font-weight: 700; color: var(--color-accent); min-width: 60px; text-align: center; }
.link-clicks-label { font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; }
.link-actions { display: flex; gap: 0.25rem; }
.link-actions button { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0.4rem; border-radius: var(--radius-md); transition: all 0.2s; }
.link-actions button:hover { color: var(--color-text); background: var(--color-surface-interactive); }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border: none; border-radius: var(--radius-md); font-family: var(--font-family-body); font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: linear-gradient(135deg, var(--color-accent), var(--color-accent-active)); color: var(--color-accent-foreground); }
.btn-primary:hover { filter: brightness(1.1); }
.btn-secondary { background: var(--color-success); color: var(--color-success-foreground); }
.btn-secondary:hover { filter: brightness(1.1); }
.btn-ghost { background: transparent; color: var(--color-text-muted); border: 2px solid var(--color-border); }
.btn-ghost:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.btn-danger { background: var(--color-danger); color: var(--color-danger-foreground); }
.btn-danger:hover { filter: brightness(1.1); }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
.btn:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
.btn-lg { padding: 0.75rem 1.5rem; font-size: 1rem; }

/* Hero input */
.hero-input-wrap { display: flex; gap: 0.75rem; margin-bottom: 2rem; }
.hero-input { flex: 1; padding: 0.75rem 1rem; background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); font-family: var(--font-family-body); font-size: 1rem; }
.hero-input:focus { outline: none; border-color: var(--color-success); box-shadow: 0 0 0 3px var(--color-selection); }
.hero-input::placeholder { color: var(--color-text-muted); }

/* Forms */
.theme-toggle { display: inline-flex; background: var(--color-surface); border-radius: var(--radius-lg); padding: 3px; gap: 2px; border: 1px solid var(--color-border); }
.theme-toggle .theme-btn { padding: 0.5rem 1rem; background: transparent; border: none; border-radius: calc(var(--radius-lg) - 2px); color: var(--color-text-muted); font-family: var(--font-family-body); font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; }
.theme-toggle .theme-btn:hover { color: var(--color-text); }
.theme-toggle .theme-btn.active { background: var(--color-surface-raised); color: var(--color-text); box-shadow: 0 1px 3px var(--shadow-color); }
.theme-toggle .theme-btn .icon { font-size: 16px; }
.form-group { margin-bottom: 1rem; }
.form-label { display: block; font-size: 0.75rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
.form-input { width: 100%; padding: 0.6rem 0.85rem; background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); font-family: var(--font-family-body); font-size: 0.875rem; }
.form-input:focus { outline: none; border-color: var(--color-success); box-shadow: 0 0 0 3px var(--color-selection); }
select.form-input { appearance: none; -webkit-appearance: none; padding-right: 2rem; cursor: pointer; }
.form-select { position: relative; }
.form-select::after { content: ""; position: absolute; right: 0.85rem; top: 50%; width: 0; height: 0; margin-top: -2px; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid var(--color-text); pointer-events: none; }
.form-row { display: flex; gap: 1rem; }
.form-row > * { flex: 1; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,17,16,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
.modal { background: var(--color-surface-interactive); border-radius: var(--radius-lg); padding: 1.75rem; width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
.modal-title { font-family: var(--font-family-display); font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem; }

/* Toast */
.toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.75rem 1.25rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 600; z-index: 200; animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-success { background: var(--color-success); color: var(--color-success-foreground); }
.toast-error { background: var(--color-danger); color: var(--color-danger-foreground); }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Analytics range bar */
.analytics-range-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; flex-wrap: wrap; }
.analytics-range-clicks { display: flex; align-items: baseline; gap: 0.5rem; }
.analytics-range-count { font-size: 1.75rem; font-weight: 700; color: var(--color-text); font-family: var(--font-family-mono); }
.analytics-range-label { font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

/* Timeline chart */
.timeline-card { overflow: hidden; }
.timeline-range-selector { display: flex; gap: 2px; background: var(--color-surface-interactive); border-radius: var(--radius-md); padding: 2px; }
.timeline-range-btn { background: none; border: none; color: var(--color-text-muted); font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.5rem; border-radius: calc(var(--radius-md) - 2px); cursor: pointer; transition: all 0.15s; letter-spacing: 0.02em; }
.timeline-range-btn:hover { color: var(--color-text); }
.timeline-range-btn.active { background: var(--color-surface-raised); color: var(--color-accent); }
.timeline-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.9rem; gap: 0.75rem; }
.timeline-range-pill { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted); background: var(--color-surface); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); letter-spacing: 0.02em; }
.timeline-head-main { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.timeline-total-row { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.timeline-total { font-family: var(--font-family-display); font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); font-variant-numeric: tabular-nums; line-height: 1; }
.timeline-total-label { font-size: 0.75rem; color: var(--color-text-muted); }
.timeline-chart { position: relative; height: 220px; }
.timeline-chart svg { width: 100%; height: 100%; display: block; overflow: visible; }
.timeline-chart .empty-card-hint { text-align: center; padding: 2rem 0; color: var(--color-text-muted); font-size: 0.875rem; }

/* Link detail view */
.detail-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
.detail-header .timeline-range-selector { margin-left: auto; }
.detail-back { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0.4rem; border-radius: var(--radius-md); text-decoration: none; display: inline-flex; }
.detail-back:hover { color: var(--color-text); background: var(--color-surface-raised); }
.detail-hero { background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 1.25rem 1.4rem; display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.5rem; align-items: center; margin-bottom: 1.2rem; }
.detail-hero .left { min-width: 0; }
.detail-hero .label { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.01em; display: flex; align-items: center; gap: 0.5rem; color: var(--color-text); line-height: 1.2; min-width: 0; cursor: pointer; }
.detail-hero .label .inline-edit-value { font-size: inherit; color: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.detail-hero .label .inline-edit-placeholder { font-style: italic; color: var(--color-text-muted); font-size: 1.25rem; }
.detail-hero .label .inline-edit-icon { font-size: 16px; color: var(--color-text-muted); opacity: 0; transition: opacity 0.15s; }
.detail-hero .label:hover .inline-edit-icon { opacity: 1; }
.detail-hero .short-url-row { display: flex; align-items: center; gap: 0.3rem; margin-top: 0.55rem; }
.detail-hero .short-url { font-family: var(--font-family-display); font-size: 1.05rem; font-weight: 600; color: var(--color-accent); display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem; background: var(--color-selection); border-radius: var(--radius-md); cursor: pointer; }
.detail-hero .short-url:hover { background: color-mix(in oklab, var(--color-accent) 18%, transparent); }
.detail-hero .short-url.dimmed { opacity: 0.5; }
.detail-hero .short-url-row .btn-icon { width: 30px; height: 30px; border-radius: var(--radius-md); color: var(--color-text-muted); }
.detail-hero .short-url-row .btn-icon:hover { background: var(--color-surface-interactive); color: var(--color-text); }
.detail-hero .dest { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 0.65rem; display: flex; align-items: center; gap: 0.4rem; word-break: break-all; text-decoration: none; }
.detail-hero .dest:hover { color: var(--color-text); }
.detail-hero .dest .icon { color: var(--color-text-subtle); font-size: 14px; flex-shrink: 0; }
.detail-hero .meta-row { margin-top: 0.85rem; display: flex; flex-wrap: wrap; gap: 0.4rem 1.25rem; font-size: 0.76rem; color: var(--color-text-subtle); }
.detail-hero .meta-row .m { display: inline-flex; align-items: center; gap: 0.3rem; }
.detail-hero .meta-row .m .icon { font-size: 14px; }
.detail-hero .meta-row .m strong { color: var(--color-text-muted); font-weight: 600; }
.detail-hero .meta-row .m.inline-edit { padding: 0.1rem 0.3rem; margin: -0.1rem -0.3rem; border-radius: var(--radius-md); }
.detail-hero .right { border-left: 1px solid var(--color-border); padding-left: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.hero-metric .n { font-family: var(--font-family-display); font-weight: 700; font-size: 2.2rem; line-height: 1; color: var(--color-text); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.hero-metric .l { font-size: 0.72rem; color: var(--color-text-subtle); margin-top: 0.35rem; text-transform: uppercase; letter-spacing: 0.04em; }
.hero-metric.accent .n { color: var(--color-accent); }
.hero-metric .delta { font-size: 0.7rem; color: var(--color-text-subtle); margin-top: 0.35rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.2rem; }

/* Triple-dot menu */
.detail-menu { position: absolute; right: 0; top: 100%; z-index: 20; background: var(--color-surface-interactive); border: 1px solid var(--color-border); border-radius: var(--radius-md); min-width: 220px; padding: 0.35rem 0; box-shadow: 0 8px 24px var(--shadow-color); }
.detail-menu-item { display: flex; align-items: center; gap: 0.5rem; width: 100%; background: none; border: none; color: var(--color-text); font-family: var(--font-family-body); font-size: 0.85rem; padding: 0.5rem 1rem; cursor: pointer; text-align: left; }
.detail-menu-item:hover { background: var(--color-surface-interactive); }
.detail-menu-item .icon { font-size: 18px; }
.detail-menu-danger { color: var(--color-danger); }
.detail-menu-divider { height: 1px; background: var(--color-border); margin: 0.35rem 0; }

/* Slugs management table */
.slugs-table { display: flex; flex-direction: column; gap: 0; }
.slugs-row { display: flex; align-items: center; gap: 1rem; padding: 0.6rem 0.5rem; border-radius: var(--radius-md); }
.slugs-row:hover { background: var(--color-surface-interactive); }
.slugs-row-disabled { opacity: 0.45; }
.slugs-row-actions-left { display: flex; gap: 0.25rem; align-items: center; min-width: 68px; flex-shrink: 0; }
.slugs-row-slug { display: flex; align-items: center; gap: 0.5rem; width: 200px; flex-shrink: 0; }
.slugs-row-bar-container { flex: 1; padding: 0 1rem; }
.slugs-row-bar { height: 8px; background: var(--color-surface); border-radius: 4px; overflow: hidden; width: 100%; }
.slugs-row-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease-out; }
.slugs-row-fill.orange { background: linear-gradient(135deg, var(--color-accent), var(--color-accent-active)); }
.slugs-row-fill.mint { background: var(--color-success); }
.slugs-row-count { font-family: var(--font-family-mono); font-size: 0.9rem; color: var(--color-text); min-width: 40px; text-align: right; flex-shrink: 0; }
.slugs-row-actions-right { display: flex; gap: 0.25rem; align-items: center; min-width: 34px; justify-content: flex-end; flex-shrink: 0; }
.slug-badge-primary { display: inline-flex; align-items: center; background: var(--color-selection); color: var(--color-accent); padding: 0.1rem 0.3rem; border-radius: var(--radius-md); font-size: 0.65rem; font-weight: 700; }
.slug-badge-auto { font-size: 0.6rem; font-weight: 600; color: var(--color-text-muted); background: var(--color-surface-interactive); padding: 0.1rem 0.35rem; border-radius: var(--radius-md); text-transform: uppercase; letter-spacing: 0.04em; }
.btn-icon { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0.3rem; border-radius: var(--radius-md); display: inline-flex; align-items: center; }
.btn-icon:hover { color: var(--color-text); background: var(--color-surface-raised); }
.btn-icon .icon { font-size: 18px; }
.btn-icon-danger:hover { color: var(--color-danger); }
.detail-analytics { display: grid; grid-template-columns: 2fr 1fr; gap: 1.4rem; }
.detail-analytics-left, .detail-analytics-right { display: flex; flex-direction: column; gap: 1.4rem; }
.detail-analytics .bento-card { margin-bottom: 0; }

/* Inline edit */
.inline-edit { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; border-radius: var(--radius-md); padding: 0.2rem 0.4rem; margin: -0.2rem -0.4rem; transition: background 0.15s; }
.inline-edit:hover { background: var(--color-surface); }
.inline-edit-value { font-size: 0.9rem; color: var(--color-text); }
.inline-edit-placeholder { font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; }
.inline-edit-icon { font-size: 14px; color: var(--color-text-muted); opacity: 0; transition: opacity 0.15s; }
.inline-edit:hover .inline-edit-icon { opacity: 0.7; }
.inline-edit-form { display: flex; align-items: center; gap: 0.35rem; }
.inline-edit-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius-md); cursor: pointer; padding: 0; transition: background 0.15s; }
.inline-edit-btn .icon { font-size: 16px; }
.inline-edit-btn.confirm { background: var(--color-selection); color: var(--color-success); }
.inline-edit-btn.confirm:hover { background: var(--color-selection); filter: brightness(1.2); }
.inline-edit-btn.cancel { background: transparent; color: var(--color-text-muted); }
.inline-edit-btn.cancel:hover { background: var(--color-surface); color: var(--color-text); }
.form-input-sm { padding: 0.4rem 0.65rem; font-size: 0.85rem; }

/* Settings bar */
.settings-inline { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; background: var(--color-surface-raised); border-radius: var(--radius-lg); margin-bottom: 1.4rem; }
.settings-inline .form-label { margin: 0; }
.settings-inline .form-input { width: 70px; }

/* Toolbar */
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.4rem; }
.toolbar-count { color: var(--color-text-muted); font-size: 0.875rem; }
.toolbar-sort { display: flex; gap: 0.25rem; }
.sort-btn { background: transparent; border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font-family: var(--font-family-body); font-size: 0.75rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 0.3rem; text-decoration: none; }
.sort-btn:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.sort-btn.active { border-color: var(--color-success); color: var(--color-success); }
.link-disabled { opacity: 0.5; }
.disabled-badge { display: inline-flex; align-items: center; gap: 0.2rem; background: var(--color-danger); color: var(--color-danger-foreground); font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: var(--radius-md); text-transform: uppercase; letter-spacing: 0.05em; }
.link-date { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.2rem; }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1.4rem; padding: 0.75rem 0; }
.pagination-summary { font-size: 0.78rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.pagination-pages { display: flex; gap: 0.25rem; }
.page-btn { background: transparent; border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font-family: var(--font-family-body); font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; min-width: 2rem; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.page-btn:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.page-btn.active { border-color: var(--color-accent); color: var(--color-accent); }
.page-btn:disabled, .page-btn.disabled { opacity: 0.3; cursor: default; pointer-events: none; }
.per-page { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: var(--color-text-muted); }
.per-page-label { font-size: 0.78rem; color: var(--color-text-muted); }
.per-page-select { min-width: 4rem; }
.per-page-select select.form-input { padding: 0.35rem 1.6rem 0.35rem 0.65rem; font-size: 0.8rem; }
.per-page-select.form-select::after { right: 0.55rem; border-top-width: 5px; border-left-width: 4px; border-right-width: 4px; }

/* Section label (subtle header above cards/sections) */
.section-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 0.6rem; }
.section-label .icon { font-size: 14px; color: var(--color-text-muted); }

/* Delta pill: rounded badge showing percent change */
.delta { display: inline-flex; align-items: center; gap: 0.15rem; font-size: 0.72rem; font-weight: 600; font-variant-numeric: tabular-nums; padding: 0.1rem 0.45rem; border-radius: 999px; line-height: 1; }
.delta .icon { font-size: 14px; }
.delta.up { color: var(--color-success); background: color-mix(in oklab, var(--color-success) 14%, transparent); }
.delta.down { color: var(--color-danger); background: color-mix(in oklab, var(--color-danger) 14%, transparent); }
.delta.flat { color: var(--color-text-muted); background: var(--color-surface-interactive); }

/* KPI card: compact card showing label + delta + value + sparkline */
.kpi { display: flex; flex-direction: column; gap: 0.45rem; min-height: 104px; }
.kpi-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.kpi-label { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: var(--color-text-muted); font-weight: 500; }
.kpi-label .icon { font-size: 16px; color: var(--color-text-muted); }
.kpi-value { font-family: var(--font-family-display); font-size: 2rem; font-weight: 700; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.kpi-hint { font-size: 0.72rem; color: var(--color-text-muted); }
.kpi-spark { margin-top: auto; height: 32px; }
.kpi-spark svg { width: 100%; height: 100%; display: block; }

/* Range picker (time range selector) */
.range-picker { display: inline-flex; gap: 2px; background: var(--color-surface-interactive); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 2px; }
.range-picker a, .range-picker button { border: none; background: transparent; cursor: pointer; padding: 0.3rem 0.65rem; border-radius: calc(var(--radius-md) - 2px); color: var(--color-text-muted); font-family: var(--font-family-body); font-size: 0.72rem; font-weight: 600; text-decoration: none; letter-spacing: 0.02em; transition: color 0.15s, background 0.15s; }
.range-picker a:hover, .range-picker button:hover { color: var(--color-text); }
.range-picker a.active, .range-picker button.active { background: var(--color-surface-raised); color: var(--color-accent); box-shadow: 0 1px 2px var(--shadow-color); }

/* Hero metric (used inside detail-hero / bento) */
.hero-metric { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.hero-metric-value { font-family: var(--font-family-display); font-size: 1.8rem; font-weight: 700; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--color-text); }
.hero-metric.accent .hero-metric-value { color: var(--color-accent); }
.hero-metric-label { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.3rem; }
.hero-metric .delta { margin-top: 0.3rem; align-self: flex-start; }

/* Topbar (page header strip with breadcrumb and user chip) */
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; }
.topbar-crumbs { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--color-text-muted); }
.topbar-crumbs .sep { opacity: 0.5; }
.topbar-crumbs a { color: var(--color-text-muted); text-decoration: none; transition: color 0.15s; }
.topbar-crumbs a:hover { color: var(--color-text); }
.topbar-crumbs .current { color: var(--color-text); font-weight: 500; }
.topbar-actions { display: inline-flex; align-items: center; gap: 0.5rem; }

/* User chip (email + avatar bubble) */
.user-chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem 0.25rem 0.35rem; border-radius: 999px; background: var(--color-surface-raised); border: 1px solid var(--color-border); font-size: 0.78rem; color: var(--color-text); }
.user-chip .avatar { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-active)); color: var(--color-accent-foreground); display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.user-chip .email { font-weight: 500; letter-spacing: -0.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }

/* Theme picker cards (settings page) */
.theme-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.theme-card { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.8rem; border-radius: var(--radius-md); border: 2px solid var(--color-border); background: var(--color-surface-raised); cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: left; color: var(--color-text); font: inherit; }
.theme-card:hover { border-color: var(--color-border-strong); }
.theme-card.active { border-color: var(--color-accent); background: var(--color-surface-interactive); }
.theme-card .theme-preview { height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); padding: 0.5rem; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.theme-card .theme-bar { height: 3px; border-radius: 2px; }
.theme-card .theme-bar.one { width: 80%; }
.theme-card .theme-bar.two { width: 55%; }
.theme-card .theme-bar.three { width: 40%; }
.theme-card[data-theme-preview="oddbit"] .theme-preview { background: #0b1a1e; border-color: #1a2f33; }
.theme-card[data-theme-preview="oddbit"] .theme-bar.one { background: #ff7637; }
.theme-card[data-theme-preview="oddbit"] .theme-bar.two { background: #3b5a58; }
.theme-card[data-theme-preview="oddbit"] .theme-bar.three { background: #2a403e; }
.theme-card[data-theme-preview="dark"] .theme-preview { background: #151b23; border-color: #293241; }
.theme-card[data-theme-preview="dark"] .theme-bar.one { background: #ff7637; }
.theme-card[data-theme-preview="dark"] .theme-bar.two { background: #3a4658; }
.theme-card[data-theme-preview="dark"] .theme-bar.three { background: #293241; }
.theme-card[data-theme-preview="light"] .theme-preview { background: #ffffff; border-color: #dce5e1; }
.theme-card[data-theme-preview="light"] .theme-bar.one { background: #f9733d; }
.theme-card[data-theme-preview="light"] .theme-bar.two { background: #b3c6bf; }
.theme-card[data-theme-preview="light"] .theme-bar.three { background: #dce5e1; }
.theme-card-name { font-size: 0.82rem; font-weight: 600; letter-spacing: -0.01em; }
.theme-card-sub { font-size: 0.68rem; color: var(--color-text-muted); margin-top: 1px; }

/* Recent-list row on dashboard (replaces inline-styled rows) */
.recent-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; min-width: 0; text-decoration: none; color: inherit; }
.recent-row-url { flex: 1; min-width: 0; font-size: 0.8rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-row-clicks { font-family: var(--font-family-display); font-weight: 700; color: var(--color-accent); flex-shrink: 0; font-variant-numeric: tabular-nums; }

/* Muted hint inside a card */
.muted-hint { color: var(--color-text-muted); font-size: 0.875rem; }

/* Icon size utilities (replace inline style="font-size:..." on .icon spans) */
.icon-xxs { font-size: 12px !important; vertical-align: -1px; }
.icon-xs { font-size: 14px !important; }
.icon-sm { font-size: 16px !important; }
.icon-md { font-size: 18px !important; }
.icon-lg { font-size: 24px !important; }
.icon-baseline { vertical-align: text-bottom; }

/* Spacing utilities */
.mb-lg { margin-bottom: 1.4rem; }
.mt-sm { margin-top: 0.75rem; }

/* Dimmed (for expired/disabled entries) */
.dimmed { opacity: 0.4; }

/* Empty hint centered inside a card */
.empty-card-hint { color: var(--color-text-muted); font-size: 0.875rem; padding: 2rem 0; text-align: center; }

/* Stat-row subtitle (used by link-detail referrers) */
.stat-row-subtitle { font-size: 0.75rem; color: var(--color-text-muted); margin: -0.15rem 0 0.5rem 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-family-mono); }

/* Detail actions row */
.detail-actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

/* Meta row (inline created_by + badges) */
.meta-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.meta-value { font-size: 0.85rem; color: var(--color-text); }
.meta-value.muted { color: var(--color-text-muted); }
.meta-value.mono { font-family: var(--font-family-mono); }

/* Detail expiry form tweaks */
.expiry-form input[type="datetime-local"] { width: auto; }
.expiry-form .btn-ghost { font-size: 0.75rem; }

/* Slug row text */
.slug-row-text { font-family: var(--font-family-mono); font-size: 0.875rem; }

/* Disabled badge inline in hero (already have .disabled-badge; add positioning modifier) */
.disabled-badge.mb-sm { margin-bottom: 0.5rem; }

/* Detail-menu anchor positioning wrapper */
.detail-menu-anchor { position: relative; }

/* Keys page tweaks */
.page-note { font-size: 0.813rem; color: var(--color-text-muted); margin-top: 0.4rem; }
.page-note a { color: var(--color-success); }
.bento-card-flush { padding: 0; }
.keys-table td.col-title { font-weight: 600; }
.keys-table td.col-date { color: var(--color-text-muted); font-size: 0.8rem; }
.keys-table td.col-last-used { font-size: 0.8rem; }
.keys-table .col-key-prefix { font-family: var(--font-family-mono); font-size: 0.8rem; color: var(--color-text-muted); }
.keys-table .col-never { color: var(--color-text-muted); }

/* Links page: search-results bar + inline toolbar group */
.search-results-bar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.search-results-bar .count { font-size: 0.85rem; color: var(--color-text-muted); }
.search-results-bar .btn { font-size: 0.8rem; }
.toolbar-group { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

/* Slug chip disabled modifier */
.slug-chip.slug-chip-disabled { opacity: 0.4; }

/* Link clicks cell centered */
.link-clicks-cell { text-align: center; }

/* Filter chips (Active / Disabled / All) */
.filter-chips { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem; background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: 999px; }
.filter-chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.75rem; border-radius: 999px; background: transparent; color: var(--color-text-muted); font-size: 0.78rem; font-weight: 500; text-decoration: none; border: none; cursor: pointer; transition: background 0.15s, color 0.15s; font-family: inherit; }
.filter-chip:hover { color: var(--color-text); }
.filter-chip .icon { font-size: 14px; }
.filter-chip .count { font-size: 0.7rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.filter-chip.active { background: var(--color-surface-interactive); color: var(--color-text); box-shadow: inset 0 0 0 1px var(--color-border); }
.filter-chip.active .count { color: var(--color-text); }

/* Links table */
.links-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.links-table { width: 100%; border-collapse: collapse; }
.links-table th { text-align: left; font-size: 0.7rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.6rem 1rem; border-bottom: 2px solid var(--color-border); white-space: nowrap; }
.links-table th.num { text-align: right; }
.links-table td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.875rem; vertical-align: middle; }
.links-table tr:last-child td { border-bottom: none; }
.links-table tbody tr { transition: background 0.15s; cursor: pointer; }
.links-table tbody tr:hover td { background: var(--color-surface-interactive); }
.links-table tbody tr.disabled td { opacity: 0.55; }
.links-table .col-link-label { font-weight: 700; font-size: 0.95rem; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
.links-table .col-link-url { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.25rem; max-width: 320px; }
.links-table .col-link-url .icon { font-size: 13px; color: var(--color-text-subtle); flex-shrink: 0; }
.links-table .col-link-url > span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.links-table .col-short { font-family: var(--font-family-mono); font-size: 0.82rem; }
.links-table .col-short-chip { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--color-surface-interactive); border: 1px solid var(--color-border); border-radius: 999px; padding: 0.2rem 0.6rem; color: var(--color-text); }
.links-table .col-short-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); flex-shrink: 0; }
.links-table .col-short-chip-slug { letter-spacing: 0.01em; }
.links-table .col-short-chip .icon { font-size: 13px; color: var(--color-text-muted); }
.links-table .col-clicks { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.links-table .col-clicks-cell { display: inline-flex; align-items: center; gap: 0.5rem; justify-content: flex-end; }
.links-table .col-clicks-value { font-size: 1.125rem; font-weight: 700; color: var(--color-text); font-family: var(--font-family-body); }
.links-table .col-date { color: var(--color-text-muted); font-size: 0.8rem; white-space: nowrap; }
.links-table .col-date-cell { display: inline-flex; align-items: center; gap: 0.5rem; }
.links-table .col-disabled-badge { margin-left: 0.4rem; }
.links-table a { color: inherit; text-decoration: none; }

/* Settings page layout */
.settings-layout { display: flex; gap: 2.5rem; align-items: flex-start; flex-wrap: wrap; }
.settings-main { flex: 1; min-width: 280px; max-width: 480px; display: flex; flex-direction: column; gap: 1.4rem; }
.settings-side { min-width: 240px; max-width: 300px; display: flex; flex-direction: column; gap: 1rem; }
.settings-side-label { font-size: 0.75rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

/* Slug length row (number input + save) */
.slug-length-row { display: flex; gap: 0.75rem; align-items: center; }
.slug-length-row .form-input { width: 80px; }
.form-hint { font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.4rem; }
.form-group-flush { margin-bottom: 0; }

/* Version row spinner */
.version-status { font-size: 0.875rem; margin-top: 0.5rem; color: var(--color-text-muted); display: inline-flex; align-items: center; gap: 0.35rem; }
.icon-spin { font-size: 16px; vertical-align: text-bottom; animation: spin 1s linear infinite; }

/* Account row (identity + logout) */
.account-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 0.5rem; }
.account-identity { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.account-identity .icon { font-size: 18px; color: var(--color-text-muted); flex-shrink: 0; }
.account-identity .email { font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-logout { font-size: 0.813rem; color: var(--color-text-muted); text-decoration: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.3rem; }
.account-logout:hover { color: var(--color-text); }
.account-logout .icon { font-size: 15px; }

/* Integration cards (link-as-card) */
.integration-card { text-decoration: none; color: inherit; display: block; }
.integration-card-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.integration-card-head .icon { color: var(--color-accent); }
.integration-card-title { font-weight: 600; }
.integration-card-desc { font-size: 0.813rem; color: var(--color-text-muted); line-height: 1.45; }
.integration-card-link { font-size: 0.7rem; color: var(--color-success); margin-top: 0.6rem; display: inline-flex; align-items: center; gap: 0.25rem; }
.integration-card-link .icon { font-size: 14px; }

/* Top-link row: label+slug stat bar with url caption under it */
.top-link-row { display: block; text-decoration: none; color: inherit; overflow: hidden; }
.top-link-row-url { font-size: 0.75rem; color: var(--color-text-muted); margin: -0.15rem 0 0.5rem 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Keys table */
.keys-table { width: 100%; border-collapse: collapse; }
.keys-table th { text-align: left; font-size: 0.7rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.6rem 1rem; border-bottom: 2px solid var(--color-border); }
.keys-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.875rem; vertical-align: middle; }
.keys-table tr:last-child td { border-bottom: none; }
.keys-table tr:hover td { background: var(--color-surface-interactive); }
.scope-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.scope-badge.create { background: var(--color-selection); color: var(--color-accent); border: 1px solid var(--color-accent); }
.scope-badge.read { background: rgba(181,242,175,0.1); color: var(--color-success); border: 1px solid var(--color-success); }
.key-revealed { font-family: var(--font-family-mono); font-size: 0.8rem; background: var(--color-surface); border: 2px solid var(--color-success); border-radius: var(--radius-md); padding: 0.75rem 1rem; word-break: break-all; line-height: 1.6; }
.key-warning { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; color: var(--color-accent); margin-top: 0.75rem; }

/* Empty state */
.empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-state .icon { font-size: 48px; margin-bottom: 1rem; display: block; }
.empty-state p { margin-bottom: 1rem; }

/* Mobile navigation */
.mobile-header { display: none; align-items: center; gap: 0.75rem; background: var(--color-surface); position: sticky; top: 0; z-index: 50; border-bottom: 1px solid var(--color-border); }
.mobile-brand { color: var(--color-text); }
.mobile-menu-btn { background: none; border: none; color: var(--color-text); cursor: pointer; padding: 0.4rem; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; }
.mobile-menu-btn:hover { background: var(--color-surface-interactive); }
.sidebar-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 55; }
.sidebar-backdrop.open { display: block; }

/* Responsive */
@media (max-width: 768px) {
  html, body { overflow-x: hidden; max-width: 100vw; }
  .mobile-header { display: flex; padding: 0.75rem 1rem; margin: -1rem -1rem 1rem; }
  .sidebar { transform: translateX(-100%); transition: transform 0.25s ease; z-index: 60; }
  .sidebar.open { transform: translateX(0); }
  .sidebar-backdrop.open { display: block; }
  .main { margin-left: 0; padding: 1rem; min-width: 0; max-width: 100vw; }
  .page-title { font-size: 1.5rem; }
  .bento { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .bento-card { padding: 1rem 1.1rem; grid-column: 1 / -1; min-width: 0; }
  .bento-card.bento-card-compact { grid-column: span 1; }
  .kpi-strip { grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; }
  .bento-value { font-size: 1.5rem; }
  .detail-analytics { grid-template-columns: 1fr; }
  .detail-analytics-left, .detail-analytics-right { min-width: 0; }
  .analytics-range-bar { flex-direction: column; align-items: flex-start; }
  .timeline-chart { height: 160px; }
  .timeline-total { font-size: 1.5rem; }
  .detail-header { flex-wrap: wrap; gap: 0.5rem; }
  .detail-header .page-title { flex: 1; min-width: 0; }
  .detail-header .timeline-range-selector { order: 10; width: 100%; margin-left: 0; justify-content: space-between; }
  .detail-header .timeline-range-btn { flex: 1; text-align: center; }
  .detail-hero { grid-template-columns: 1fr; min-width: 0; }
  .detail-hero .label { font-size: 1.5rem; }
  .detail-hero .right { border-left: none; border-top: 1px solid var(--color-border); padding-left: 0; padding-top: 1rem; }
  .hero-input-wrap { flex-direction: column; }
  .form-row { flex-direction: column; }
  .toolbar { flex-wrap: wrap; gap: 0.5rem; }
  .toolbar > .btn { width: 100%; justify-content: center; }
  .link-item { gap: 0.75rem; }
  .link-url { white-space: normal; word-break: break-all; }
  .link-clicks { font-size: 1rem; }
  .slugs-row { gap: 0.5rem; flex-wrap: nowrap; }
  .slugs-row-actions-left { min-width: 0; }
  .slugs-row-slug { width: auto; flex: 1; min-width: 0; }
  .slugs-row-bar-container { display: none; }
  .keys-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .keys-table thead { display: none; }
  .keys-table, .keys-table tbody, .keys-table tr, .keys-table td { display: block; width: 100%; }
  .keys-table tr { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); }
  .keys-table tr:last-child { border-bottom: none; }
  .keys-table td { padding: 0.2rem 0; border-bottom: none; background: transparent !important; }
  .keys-table td:before { content: attr(data-label); display: block; font-size: 0.65rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem; }
  .keys-table td:last-child { margin-top: 0.5rem; }
  .keys-table td:last-child:before { display: none; }
  .links-table thead { display: none; }
  .links-table, .links-table tbody, .links-table tr, .links-table td { display: block; width: 100%; }
  .links-table tr { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); }
  .links-table tr:last-child { border-bottom: none; }
  .links-table td { padding: 0.2rem 0; border-bottom: none; background: transparent !important; text-align: left !important; }
  .links-table td:before { content: attr(data-label); display: block; font-size: 0.65rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem; }
  .links-table .col-link-label, .links-table .col-link-url { max-width: none; white-space: normal; word-break: break-word; }
  .links-table .col-clicks-cell { justify-content: flex-start; }
  .filter-chips { width: 100%; justify-content: space-between; border-radius: var(--radius-md); }
  .filter-chip { flex: 1; justify-content: center; }
  .settings-layout { flex-direction: column !important; }
  .settings-layout > div:last-child { max-width: 100% !important; }
  .pagination { flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
  .bundle-grid { grid-template-columns: 1fr; }
  .detail-analytics { grid-template-columns: 1fr; }
  .bundle-link-row { grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 0.5rem; }
  .bundle-link-row .bundle-link-bar { display: none; }
  .bundle-hero-headline { font-size: 1.5rem; }
}

/* ============================================================
 * Bundles
 * ============================================================ */

/* Accent palette — each class maps --bundle-accent to a brand-safe hue. */
.accent-orange { --bundle-accent: #f97d3b; --bundle-accent-tint: rgba(249,125,59,0.16); }
.accent-red    { --bundle-accent: #e04b5f; --bundle-accent-tint: rgba(224,75,95,0.16); }
.accent-green  { --bundle-accent: #3eb489; --bundle-accent-tint: rgba(62,180,137,0.16); }
.accent-blue   { --bundle-accent: #4a90e2; --bundle-accent-tint: rgba(74,144,226,0.16); }
.accent-purple { --bundle-accent: #9b6bd6; --bundle-accent-tint: rgba(155,107,214,0.16); }

/* Intro card on the bundles list page. */
.bundles-intro {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}
.bundles-intro-icon {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 0.6rem;
  color: var(--color-accent);
}
.bundles-intro-title { font-weight: 600; margin-bottom: 0.25rem; }
.bundles-intro-body { color: var(--color-text-subtle); font-size: 0.9rem; line-height: 1.5; }

/* Filter chips row on the bundles list page. */
.bundle-filter-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.bundle-filter-chip {
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-lg, 999px);
  background: var(--color-surface);
  color: var(--color-text-subtle);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid var(--color-border);
}
.bundle-filter-chip.active {
  background: var(--color-accent);
  color: var(--color-on-accent, #0b1815);
  border-color: var(--color-accent);
}

/* Bundle card grid on the list page. */
.bundle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.bundle-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem 1.5rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text);
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
}
.bundle-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--bundle-accent, var(--color-accent));
}
.bundle-card:hover { border-color: var(--bundle-accent, var(--color-accent)); transform: translateY(-1px); }

.bundle-card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.bundle-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  background: var(--bundle-accent-tint, rgba(255,255,255,0.08));
  color: var(--bundle-accent, var(--color-accent));
}
.bundle-card-title {
  font-family: var(--font-family-display);
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--color-text);
}
.bundle-archived-badge {
  margin-left: auto;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bundle-card-desc {
  color: var(--color-text-subtle);
  font-size: 0.875rem;
  line-height: 1.45;
}

.bundle-card-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem 0;
}
.bundle-card-stat { display: flex; flex-direction: column; gap: 0.15rem; }
.bundle-card-stat-value {
  font-family: var(--font-family-display);
  font-weight: 700;
  font-size: 1.35rem;
  color: var(--color-text);
}
.bundle-card-stat-value.muted { color: var(--color-text-subtle); }
.bundle-card-stat-placeholder {
  color: var(--color-text-subtle);
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.35rem;
  align-self: start;
}
.bundle-card-stat-label {
  font-size: 0.7rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bundle-card-spark { height: 34px; }

.bundle-card-toplinks {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-top: 1px dashed var(--color-border);
  padding-top: 0.6rem;
}
.bundle-card-toplink {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-family-mono);
  font-size: 0.85rem;
}
.bundle-card-toplink-count { color: var(--color-text-subtle); }
.bundle-card-toplink-more {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  font-style: italic;
}

/* "+ New bundle" tile at the end of the grid. */
.bundle-card-new {
  background: transparent;
  border: 2px dashed var(--color-border);
  color: var(--color-text-subtle);
  text-align: center;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  cursor: pointer;
  font-family: var(--font-family-body);
}
.bundle-card-new::before { display: none; }
.bundle-card-new:hover { border-color: var(--color-accent); color: var(--color-accent); }
.bundle-card-new-title { font-weight: 600; margin-top: 0.5rem; }
.bundle-card-new-body { font-size: 0.85rem; max-width: 22ch; }

/* Empty state on the bundles list page. */
.bundle-empty {
  text-align: center;
  padding: 3rem 1.5rem;
}
.bundle-empty-title { font-weight: 600; font-size: 1.1rem; margin: 0.75rem 0 0.25rem; }
.bundle-empty-body { color: var(--color-text-subtle); margin-bottom: 1rem; }

/* Bundle header row on the detail page. */
.bundle-header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}
.bundle-header-title .page-title { margin: 0; }

/* Bundle hero headline — mirrors .detail-hero .label on link-detail so both
 * pages share the same primary-title font, size, and placement. */
.bundle-hero-headline {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  line-height: 1.2;
  min-width: 0;
}
.bundle-hero-name {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.bundle-hero-description {
  color: var(--color-text-subtle);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Range picker in the detail header should hug the right edge, matching the
 * behavior of the link detail's .timeline-range-selector. */
.detail-header .range-picker { margin-left: auto; }

/* Combined pill shown on each breakdown card in the bundle detail page. */
.bundle-combined-pill {
  font-size: 0.7rem;
  padding: 0.1rem 0.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Links-in-bundle table on the bundle detail page. */
.bundle-links-card { margin-bottom: 1.25rem; }
.bundle-links-card-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.bundle-links-card-hint {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.bundle-links-table {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.bundle-link-row {
  display: grid;
  grid-template-columns: auto minmax(160px, 1.2fr) minmax(120px, 1.4fr) auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.bundle-link-row:hover { background: var(--color-surface); }

.bundle-link-meta { min-width: 0; }
.bundle-link-label {
  font-weight: 500;
  color: var(--color-text);
  text-decoration: none;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bundle-link-label .muted { color: var(--color-text-subtle); font-style: italic; font-weight: 400; }
.bundle-link-url {
  color: var(--color-text-subtle);
  font-size: 0.8rem;
  font-family: var(--font-family-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bundle-link-bar {
  height: 4px;
  background: var(--color-surface);
  border-radius: 2px;
  overflow: hidden;
}
.bundle-link-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
}

.bundle-link-count {
  font-family: var(--font-family-display);
  font-weight: 600;
  text-align: right;
  min-width: 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}
.bundle-link-count .count { font-size: 0.95rem; }

.bundle-link-actions { display: flex; gap: 0.25rem; }

.bundle-add-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  font-family: var(--font-family-body);
  font-size: 0.875rem;
  cursor: pointer;
  margin-top: 0.75rem;
}
.bundle-add-link-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Bundle chips shown on the link detail page when a link belongs to bundles. */
.bundle-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}
.bundle-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius-lg, 999px);
  background: var(--bundle-accent-tint, var(--color-surface));
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid var(--bundle-accent, var(--color-border));
}
.bundle-chip:hover { background: var(--bundle-accent); color: var(--color-on-accent, #0b1815); }
.bundle-chip .icon { font-size: 16px; }

/* Tip card at bottom-right of bundle detail page. */
.bundle-tip {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}
.bundle-tip-icon { color: var(--color-accent); }
.bundle-tip-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--color-text-subtle);
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}
.bundle-tip-body { font-size: 0.875rem; color: var(--color-text-subtle); line-height: 1.5; }

/* Add-to-bundle modal. */
.add-to-bundle-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
}
.add-to-bundle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-family-body);
  text-align: left;
  width: 100%;
  transition: background 0.12s, border-color 0.12s;
}
.add-to-bundle-row:hover { background: var(--color-surface); }
.add-to-bundle-row.selected {
  background: var(--bundle-accent-tint, var(--color-surface));
  border-color: var(--bundle-accent, var(--color-accent));
}
.add-to-bundle-row .icon {
  color: var(--bundle-accent, var(--color-text-subtle));
  font-size: 20px;
}
.add-to-bundle-row-name { font-weight: 500; }
.add-to-bundle-row-desc { font-size: 0.8rem; color: var(--color-text-subtle); }
.add-to-bundle-create {
  margin-top: 0.5rem;
  border-top: 1px dashed var(--color-border);
  padding-top: 0.75rem;
}
.add-to-bundle-empty {
  padding: 1rem 0.5rem;
  color: var(--color-text-subtle);
  text-align: center;
  font-size: 0.875rem;
}

/* Accent color picker in the bundle create/edit form. */
.accent-picker {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.accent-swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--bundle-accent);
  transition: transform 0.15s;
}
.accent-swatch:hover { transform: scale(1.08); }
.accent-swatch.selected { border-color: var(--color-text); }

/* Icon picker — emoji-picker style grid for choosing a bundle icon. */
.bundle-icon-picker {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.3rem;
  padding: 0.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 280px;
  overflow-y: auto;
}
.bundle-icon-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-subtle);
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.bundle-icon-option:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}
.bundle-icon-option.selected {
  background: var(--color-accent);
  color: var(--color-on-accent, #0b1815);
  border-color: var(--color-accent);
}
.bundle-icon-option .icon {
  font-size: 20px;
  line-height: 1;
}

@media (max-width: 540px) {
  .bundle-icon-picker { grid-template-columns: repeat(6, 1fr); }
}
`;
