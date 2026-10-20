# shrtnr browser extensions

Chrome and Firefox extensions for [shrtnr](https://oddb.it/shrtnr-info), a self-hosted URL shortener on Cloudflare Workers + D1.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

One source tree builds two store-ready artifacts. The popup shortens the active tab into your shrtnr deployment, copies the short URL to the clipboard, and renders a server-side QR code on demand.

## Features

| Feature | Behavior |
|---|---|
| Toolbar action | Shortens the active tab and copies the short URL. The server deduplicates by URL, so reopening the popup on the same page returns the same link. |
| Keyboard shortcut | Opens the popup, which runs the same shorten flow. |
| Custom slug | A field under the short URL. Adding one calls `POST /_/api/links/{id}/slugs`, swaps the displayed short URL, and copies it. A taken slug (409) reports "already taken" inline. |
| QR code | Your shrtnr server generates it: no client-side QR library, no third-party API. A key without the `read` scope gets a message naming the missing scope. |
| Recent | The links most recently shortened from this browser, stored on the device in `chrome.storage.local`. |
| Settings page | Holds `baseUrl + apiKey`. Its connection test calls `GET /_/api/links`. A `create`-only key reports connected, with a note that QR codes need `read`. |
| First run | On install, the options page opens and shows a one-click deploy CTA for prospects without a shrtnr. |

**The shortcut is a suggestion.** The combination is `commands._execute_action.suggested_key` in [`manifests/base.json`](manifests/base.json). The browser leaves it unassigned when another extension holds it, and the user can rebind it. The options page reads the live binding from `chrome.commands.getAll()` and names the keys that work.

**The extension talks only to your own deployment.** Oddbit hosts no shared backend. Nothing leaves the extension except the calls you configure.

## Install

| Browser | Store |
|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi | [Chrome Web Store](https://oddb.it/shrtnr-ext-chrome) (link active once approved) |
| Firefox | [Firefox Add-ons](https://oddb.it/shrtnr-ext-firefox) (link active once approved) |

Click the toolbar icon after install. On first run the popup shows the configure form: paste your shrtnr URL and an API key from `/_/admin/keys`. Scope `create` is enough to shorten; add `read` for QR codes. After that, the popup shortens the current tab and copies the short URL.

No shrtnr yet? Deploy free on Cloudflare in one click: <https://oddb.it/shrtnr-deploy-ext>.

## Architecture

```
browser-extensions/
  src/
    background.ts         MV3 service worker, opens options on first install
    popup/                toolbar popup (Preact)
    options/              full-page settings (Preact)
    components/           shared form + CTA banner
    i18n/                 one translation file per language
    styles/               design tokens, forms, CTA
    *.ts                  API, storage and helper modules
  manifests/              base + per-target overrides (chrome, firefox)
  assets/                 icon source SVG + rendered PNGs
  build.mjs               esbuild + manifest merge + zipper
  scripts/
    verify-build.mjs      manifest and zip sanity check
    generate-icons.mjs    regenerate PNG sizes from icon.svg
  tests/                  Vitest specs, one per module or UI flow
```

**The extension depends on the published `@oddbit/shrtnr` from npm, never on `sdk/typescript`.** It consumes the SDK like any external client. SDK changes ship to npm first; the extension picks them up when `package.json` and `yarn.lock` move.

**Keep the SDK floor current.** `yarn install --frozen-lockfile` never re-resolves, so an SDK fix reaches the extension only through a lockfile bump. Version 0.1.1 shipped against SDK 1.1.0, which calls `fetch` unbound. Browsers reject that with `Illegal invocation`, so every request failed as a network error until the floor moved to 1.2.1.

## Development

```bash
cd browser-extensions
yarn install
yarn test          # all unit + component tests
yarn typecheck     # tsc, no emit (esbuild strips types without checking them)
yarn build         # produces dist/{chrome,firefox}/ and dist/{chrome,firefox}.zip
```

### Watch mode

```bash
yarn dev:chrome    # esbuild watch mode, output dist/chrome/
yarn dev:firefox   # esbuild watch mode, output dist/firefox/
```

Load the build:

| Browser | Steps |
|---|---|
| Chrome | `chrome://extensions/`, enable Developer mode, Load unpacked, pick `dist/chrome` |
| Firefox 140 or newer | `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick `dist/firefox/manifest.json` |

### Tests

```bash
yarn test          # one-shot
yarn test:watch    # watch mode
```

`tests/` holds one Vitest spec per module and per popup or options flow. The file names say what each covers. `tests/setup.ts` mocks the chrome.* API with an in-memory storage backend that mirrors the `chrome.storage.sync.get/set/remove` shape.

### Lint the Firefox build for AMO

```bash
yarn lint:firefox
```

Runs `web-ext lint` against `dist/firefox/`. Expect two warnings: both report `innerHTML` usage inside Preact's runtime, which user input never reaches. AMO accepts them.

### Regenerate icons

```bash
node scripts/generate-icons.mjs
```

The script uses `sharp` when available and falls back to ImageMagick (`magick`). The four PNGs are checked in, so CI needs neither.

## Permissions

Declared in `manifests/base.json`:

| Permission | Why |
|---|---|
| `activeTab` | Read the active tab URL on toolbar click. Less invasive than the broader `tabs` permission and does not show "read your browsing history" in the install dialog. |
| `storage` | Persist the configured `baseUrl + apiKey` to `chrome.storage.sync`. |
| `clipboardWrite` | Copy the short URL to the clipboard via `navigator.clipboard.writeText`. |
| `optional_host_permissions: ["*://*/*"]` | Granted **at runtime** against the user's actual `baseUrl` after they save it in options. The install dialog therefore lists no host permissions. Saving drops every granted origin except the saved one. |

**No `host_permissions` at install time.** The `commands` key (keyboard shortcut) is a manifest declaration, not a permission.

## Storage

`chrome.storage.sync` holds one key:

```json
{
  "config": {
    "baseUrl": "https://your-shrtnr.example.com",
    "apiKey": "sk_..."
  }
}
```

**Treat the API key like a session token.** The browser encrypts `chrome.storage.sync` at rest, but extension code can read it, and the vendor's sync service carries it between profiles.

`chrome.storage.local` holds a second key, `recent`, which never syncs. It lists the links most recently shortened from this browser (`id`, `slug`, `shortUrl`, page `url`, timestamp), capped at `RECENT_LIMIT` in `src/constants.ts`.

## Release

A bump of `browser-extensions/package.json` on `main` triggers `.github/workflows/release-extension.yml`:

1. Read the new version and compute tag `ext-v$VERSION`. Exit early if the tag exists or the push did not touch the manifest.
2. `yarn install --frozen-lockfile && yarn test && yarn build && yarn lint:firefox`.
3. Upload `dist/chrome.zip` to the Chrome Web Store via `chrome-webstore-upload-cli`.
4. Upload `dist/firefox.zip` to AMO via `web-ext sign`.
5. Tag `ext-v$VERSION` and push the tag. No GitHub Release: the store listings and `CHANGELOG.md` carry the release notes.

**The store secrets are missing.** The repo lacks the secrets below, so every run so far has stopped at step 3 and no `ext-v` tag exists. Upload the zips through the store dashboards until the secrets are added.

Required repo secrets:
- `CHROME_WEBSTORE_CLIENT_ID`, `CHROME_WEBSTORE_CLIENT_SECRET`, `CHROME_WEBSTORE_REFRESH_TOKEN`, `CHROME_WEBSTORE_EXTENSION_ID`
- `FIREFOX_AMO_API_KEY`, `FIREFOX_AMO_API_SECRET`

**Create the first listing on each store by hand.** Both stores require human review for new listings. The workflow drives later updates.

Before tagging, run the checklist in [`RELEASE.md`](RELEASE.md).

## i18n

`SUPPORTED_LANGUAGES` in `src/i18n/index.ts` lists the languages. English is the source of truth and the fallback.

**Add a key to `src/i18n/en.ts` first.** The `Translations = typeof en` type is the contract, so TypeScript fails to compile until every other translation file adds the same key.

## Related

- [shrtnr server](https://github.com/oddbit/shrtnr): the Cloudflare Worker the extension talks to
- [`@oddbit/shrtnr` (npm)](https://oddb.it/shrtnr-npm-readme): TypeScript SDK the extension depends on
- [`shrtnr` (PyPI)](https://oddb.it/shrtnr-pypi-readme): Python SDK
- [`shrtnr` (pub.dev)](https://oddb.it/shrtnr-pub-readme): Dart SDK

## Attribution

Developed and maintained by **[Oddbit](https://oddb.it/website)**.

- Source: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution notices: [NOTICE](NOTICE)
- Name and logo usage: [Trademark Policy](TRADEMARK_POLICY.md)

If you fork or build on this project, retain the license and notice files, preserve applicable copyright and attribution notices, and clearly indicate that your version has been modified.
