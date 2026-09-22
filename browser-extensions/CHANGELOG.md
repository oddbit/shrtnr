# Changelog

All notable changes to the shrtnr browser extensions are documented in this file.

## Unreleased

Repairs the extension in real browsers, adds the parity features a shortener extension is expected to have, and hardens permissions. No new permissions.

- **Every request works again.** The lockfile pinned `@oddbit/shrtnr` 1.1.0, which calls `fetch` with the client object as receiver. Browsers reject that with `Illegal invocation`, the SDK reported it as a network failure, and the popup and the connection test showed "Can't reach your shrtnr" for every deployment. Verified in Chromium: zero requests left the browser. The floor is now 1.2.1, which also restores the `X-Client` header so links show as created via the SDK.
- **Custom slug** field in the popup. Adds the slug to the link just created, swaps the short URL, copies it, and re-targets the QR code at the new slug. 409 shows "already taken" inline; a slug that breaks the rule is rejected before any request.
- **Recent** list of the last five links shortened from this browser, kept on the device in `chrome.storage.local`.
- **Keyboard shortcut** opens the popup and shortens the current tab. The options page names the combination the browser assigned, which is the manifest's suggested key unless another extension already held it or the user rebound it.
- **Scope-aware connection test.** A key scoped to `create` only used to fail the test with a message about creating links. The test now reports connected and says that QR codes need the `read` scope. The options page explains the scope choice.
- **QR failures are visible.** A forbidden or failed QR fetch used to reset the button silently. Both now show a message, naming the missing scope when that is the cause.
- **Host permission hygiene.** Saving drops every granted host permission except the saved origin, including one a connection test granted for a URL that was then edited before saving.
- **Firefox minimum is 140** (Android 142). The AMO data-collection declaration the manifest carries is only honoured from 140; declaring it with a lower floor drew two lint warnings and left older profiles without it.
- Options page shows the installed version. README pointed at `/_/admin/api-keys`; the page is `/_/admin/keys`.
- `yarn typecheck` runs `tsc`. esbuild strips types without checking them, which is how the 1.1.0 pin and a stale `qr()` argument type went unnoticed. Not yet wired into CI: see the QR size type note in the extension report.

## 0.1.1 (2026-08-27)

Defect-fix release. No new permissions and no manifest changes beyond the version.

- **"Test connection" works before the first save.** The test fetched with the URL as typed and without requesting host permission, so it ran under a normal page's same-origin rules and reported a reachable server as a network failure. It now normalizes the entered address to its origin and requests host permission for it, the same steps Save takes, and names the host in the message when the permission is declined.
- **Invalid-URL and save-failure messages are localized.** Both rendered English browser or hardcoded strings through the `{message}` placeholder. Each has its own translated key in English, Indonesian, and Swedish.

## 0.1.0 (2026-04-30)

Initial release. Chrome and Firefox extensions that shorten the active tab into a self-hosted shrtnr deployment, copy the short URL to the clipboard, and offer a server-side QR code. Single source tree under `browser-extensions/`, two store artifacts via the same MV3 build (`dist/chrome.zip`, `dist/firefox.zip`).

- Toolbar popup with four states: loading, not-configured (form + deploy CTA), success (short URL + copy + QR), error (category-specific message + recovery action). State machine driven by the shorten flow that re-runs on every popup open.
- Options page with the same connection form and a deploy CTA banner that hides as soon as a config exists. Save normalizes the entered host to its origin (`https://x.com/path` becomes `https://x.com`) and requests host permission for that exact origin via `chrome.permissions.request`. The install dialog lists no host permissions because `host_permissions` is empty and the actual host is granted at runtime.
- Tracking link: the deploy CTA points at `https://oddb.it/shrtnr-deploy-ext` (distinct from `shrtnr-deploy-top` and `shrtnr-deploy-howto`) so extension-driven deploys are attributable.
- Internationalization in English, Indonesian, and Swedish, mirroring the admin app's languages. All UI strings go through `t()`. Type-level guarantee that `id` and `sv` cover every key in `en`.
- Tests cover storage, api, i18n key parity, popup state machine, options form, and the build artifacts. 87 tests across five files.
- Build pipeline: esbuild bundles three entry points (`background`, `popup`, `options`), merges per-target manifest overlays, copies icons and html, and zips. `yarn lint:firefox` runs `web-ext lint`. `scripts/verify-build.mjs` asserts every file the manifest references is present and the zips stay below 1 MB.
- Permissions on install: `activeTab`, `storage`, `clipboardWrite`. No host permissions in the install dialog.
