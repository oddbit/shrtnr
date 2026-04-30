# Changelog

All notable changes to the shrtnr browser extensions are documented in this file.

## 0.1.0 (2026-04-30)

Initial release. Chrome and Firefox extensions that shorten the active tab into a self-hosted shrtnr deployment, copy the short URL to the clipboard, and offer a server-side QR code. Single source tree under `browser-extensions/`, two store artifacts via the same MV3 build (`dist/chrome.zip`, `dist/firefox.zip`).

- Toolbar popup with four states: loading, not-configured (form + deploy CTA), success (short URL + copy + QR), error (category-specific message + recovery action). State machine driven by the shorten flow that re-runs on every popup open.
- Options page with the same connection form and a deploy CTA banner that hides as soon as a config exists. Save normalizes the entered host to its origin (`https://x.com/path` becomes `https://x.com`) and requests host permission for that exact origin via `chrome.permissions.request`. The install dialog lists no host permissions because `host_permissions` is empty and the actual host is granted at runtime.
- Tracking link: the deploy CTA points at `https://oddb.it/shrtnr-deploy-ext` (distinct from `shrtnr-deploy-top` and `shrtnr-deploy-howto`) so extension-driven deploys are attributable.
- Internationalization in English, Indonesian, and Swedish, mirroring the admin app's languages. All UI strings go through `t()`. Type-level guarantee that `id` and `sv` cover every key in `en`.
- Tests cover storage, api, i18n key parity, popup state machine, options form, and the build artifacts. 87 tests across five files.
- Build pipeline: esbuild bundles three entry points (`background`, `popup`, `options`), merges per-target manifest overlays, copies icons and html, and zips. `yarn lint:firefox` runs `web-ext lint`. `scripts/verify-build.mjs` asserts every file the manifest references is present and the zips stay below 1 MB.
- Permissions on install: `activeTab`, `storage`, `clipboardWrite`. No host permissions in the install dialog.
