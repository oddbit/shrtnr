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
[data-theme="light"] .stat-bar { background: var(--color-surface-interactive); }
[data-theme="light"] .nav-item.active { color: #1b5e20; }
[data-theme="oddbit"] .sidebar-oddbit a, :root .sidebar-oddbit a { color: var(--color-success); }
.sidebar-oddbit img { width: 80px; height: auto; }
.sidebar-oddbit .copyright { font-size: 0.65rem; color: var(--color-text-muted); margin-top: 0.25rem; opacity: 0.5; }
/* Main */
.main { margin-left: 240px; flex: 1; padding: 2rem 2.5rem; min-height: 100vh; }

/* Page header */
.page-header { margin-bottom: 2rem; }
.page-title { font-family: var(--font-family-display); font-size: 2rem; font-weight: 700; }
.page-subtitle { color: var(--color-text-muted); font-size: 0.875rem; margin-top: 0.25rem; }

/* Bento grid */
.bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; margin-bottom: 2rem; }
.bento-card { background: var(--color-surface-raised); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; transition: background 0.2s; }
.bento-card:hover { background: var(--color-surface-interactive); }
.bento-card.span-2 { grid-column: span 2; }
.bento-card.span-3 { grid-column: span 3; }
.bento-label { font-size: 0.75rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
.bento-value { font-family: var(--font-family-display); font-size: 2rem; font-weight: 700; }
.bento-value.small { font-size: 1rem; font-weight: 500; }

/* Stat bars */
.stat-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; }
.stat-name { font-size: 0.8rem; width: 160px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); }
.stat-bar { flex: 1; height: 8px; background: var(--color-surface); border-radius: 4px; overflow: hidden; }
.stat-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease-out; }
.stat-fill.orange { background: linear-gradient(135deg, var(--color-accent), var(--color-accent-active)); }
.stat-fill.mint { background: var(--color-success); }
.stat-count { font-family: var(--font-family-mono); font-size: 0.8rem; color: var(--color-text-muted); min-width: 40px; text-align: right; }

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
.timeline-chart { position: relative; display: flex; height: 180px; }
.tl-y-axis { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding-right: 0.5rem; padding-bottom: 1.2rem; min-width: 2rem; }
.tl-y-label { font-size: 0.6rem; color: var(--color-text-muted); font-family: var(--font-family-mono); line-height: 1; }
.tl-plot { position: relative; flex: 1; overflow: hidden; }
.tl-grid-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--color-border); opacity: 0.3; }
.tl-bars { display: flex; align-items: flex-end; height: 100%; gap: 1px; padding-bottom: 1.2rem; position: relative; z-index: 1; box-sizing: border-box; }
.tl-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; min-width: 0; }
.tl-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.tl-bar { width: 100%; max-width: 12px; background: var(--color-accent); border-radius: 2px 2px 0 0; min-height: 0; transition: height 0.3s ease-out; position: relative; cursor: default; }
.tl-bar:hover { filter: brightness(1.3); }
.tl-bar:hover::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: var(--color-surface-interactive); color: var(--color-text); font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: var(--radius-md); white-space: nowrap; margin-bottom: 4px; z-index: 10; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.tl-x-label { font-size: 0.55rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; text-align: center; position: absolute; bottom: 0; }
.tl-x-hidden { visibility: hidden; }

/* Link detail view */
.detail-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
.detail-back { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0.4rem; border-radius: var(--radius-md); text-decoration: none; display: inline-flex; }
.detail-back:hover { color: var(--color-text); background: var(--color-surface-raised); }
.detail-hero { background: var(--color-surface-raised); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.4rem; }
.detail-hero-label { font-size: 1.4rem; font-weight: 700; color: var(--color-text); margin-bottom: 0.75rem; cursor: pointer; display: flex; align-items: baseline; gap: 0.5rem; line-height: 1.2; min-width: 0; max-width: 100%; }
.detail-hero-label .inline-edit-value { font-size: inherit; color: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.detail-hero-label .inline-edit-placeholder { font-style: italic; color: var(--color-text-muted); font-size: 1.25rem; }
.detail-hero-label .inline-edit-icon { font-size: 16px; color: var(--color-text-muted); opacity: 0; transition: opacity 0.15s; }
.detail-hero-label:hover .inline-edit-icon { opacity: 1; }
.detail-hero-grid { display: grid; grid-template-columns: 1fr auto; gap: 0; align-items: stretch; }
.detail-hero-main { min-width: 0; padding-right: 2rem; display: flex; flex-direction: column; justify-content: center; }
.detail-hero-side { display: flex; align-items: stretch; padding: 0; border-left: 1px solid var(--color-border); min-width: 380px; }
.detail-stats { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0 2rem; border-right: 1px solid var(--color-border); min-width: 160px; }
.detail-stat-value { font-family: var(--font-family-display); font-size: 3.5rem; font-weight: 700; color: var(--color-accent); line-height: 1; }
.detail-stat-label { font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.5rem; white-space: nowrap; }
.detail-info-grid { flex: 1; display: grid; grid-template-columns: 1fr; gap: 1rem; padding: 1rem 2rem; align-content: center; }

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
.detail-short-url { font-family: var(--font-family-display); font-size: 1.25rem; font-weight: 700; color: var(--color-accent); word-break: break-all; }
.detail-dest { font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.25rem; word-break: break-all; }
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
.pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 1.4rem; padding: 0.75rem 0; }
.pagination-pages { display: flex; gap: 0.25rem; }
.page-btn { background: transparent; border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font-family: var(--font-family-body); font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s; min-width: 2rem; text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.page-btn:hover { border-color: var(--color-text-muted); color: var(--color-text); }
.page-btn.active { border-color: var(--color-accent); color: var(--color-accent); }
.page-btn:disabled, .page-btn.disabled { opacity: 0.3; cursor: default; pointer-events: none; }
.per-page { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--color-text-muted); }
.per-page-btn { background: transparent; border: none; color: var(--color-text-muted); font-family: var(--font-family-body); font-size: 0.75rem; font-weight: 600; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: var(--radius-md); text-decoration: none; }
.per-page-btn:hover { color: var(--color-text); }
.per-page-btn.active { color: var(--color-success); }

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
  .detail-analytics { grid-template-columns: 1fr; }
  .analytics-range-bar { flex-direction: column; align-items: flex-start; }
  .timeline-chart { height: 140px; }
  .detail-hero-label { font-size: 1.5rem; }
  .detail-hero-grid { grid-template-columns: 1fr; }
  .detail-hero-main { grid-row: span 1; padding-right: 0; }
  .detail-hero-side { border-left: none; border-top: 1px solid var(--color-border); min-width: 0; margin-top: 1rem; padding-top: 1rem; flex-direction: column; gap: 1rem; }
  .detail-stats { padding: 0 0 1rem; border-right: none; border-bottom: 1px solid var(--color-border); }
  .detail-info-grid { padding: 0; }
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
  .keys-table tr { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); }
  .keys-table tr:last-child { border-bottom: none; }
  .keys-table td { padding: 0.2rem 0; border-bottom: none; background: transparent !important; }
  .keys-table td:before { content: attr(data-label); display: block; font-size: 0.65rem; color: var(--color-success); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem; }
  .keys-table td:last-child { margin-top: 0.5rem; }
  .keys-table td:last-child:before { display: none; }
  .settings-layout { flex-direction: column !important; }
  .settings-layout > div:last-child { max-width: 100% !important; }
  .pagination { flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
}
`;
