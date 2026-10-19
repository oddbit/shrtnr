# Release checklist

Run before bumping `package.json` and tagging `ext-v*`.

## 1. Automated gates

```bash
cd browser-extensions
yarn install --frozen-lockfile
yarn test
yarn typecheck
yarn build
yarn lint:firefox
node scripts/verify-build.mjs
```

**Every command exits 0.** `web-ext lint` must report `errors=0`. Expect two `UNSAFE_VAR_ASSIGNMENT` warnings from Preact's runtime.

**`yarn.lock` resolves `@oddbit/shrtnr` to the newest published 1.x.** The lockfile pins the SDK, so a browser-affecting SDK fix reaches users only through a lockfile bump.

## 2. Smoke test: Chrome

Load `dist/chrome/` as an unpacked extension via `chrome://extensions/`.

- [ ] Fresh install opens `options.html` automatically. The deploy CTA banner shows.
- [ ] Save with a valid URL + key persists the config. The banner disappears.
- [ ] Click the toolbar on a normal page: the popup opens, shortens, and auto-copies. The "Copied" indicator fades after ~1.5s.
- [ ] Reopen the popup: the repeat shorten succeeds, or returns the same link if `allowDuplicate` is false on the server. The server decides.
- [ ] Click **QR**: the SVG appears. Click again: it hides without refetching.
- [ ] Type a custom slug and click **Add slug**: the short URL swaps to the slug and is copied. Add the same slug again: "already taken".
- [ ] Type `-bad-` as a slug: the slug rule appears and no request goes out.
- [ ] Open the popup on a second page: the first link appears under **Recent**.
- [ ] Press the shortcut the options page names on a normal page: the popup opens and shortens.
- [ ] Configure a key with scope `create` only: **Test connection** reports connected with the scope note. **Show QR** reports the missing read scope.
- [ ] Click **View in admin**: `${baseUrl}/_/admin/links/<id>` opens in a new tab.
- [ ] Open the popup on `chrome://newtab`: it shows "shrtnr can't shorten internal browser pages."
- [ ] Open the popup on `about:blank`: same internal-page error.
- [ ] Point options at a wrong host: the popup shows a network error with **Retry** + **Settings**.
- [ ] Enter a wrong API key: the popup shows "Your API key was rejected." with **Settings**.

## 3. Smoke test: Firefox

```bash
npx web-ext run --source-dir dist/firefox
```

**Firefox 140 or newer (`strict_min_version`).** That version honours the data-collection declaration AMO requires.

- [ ] Fresh install opens `options.html`. The banner shows.
- [ ] The Chrome flows above pass, including QR, retry, and settings recovery.
- [ ] The toolbar icon renders crisp at all sizes (16, 32, 48, 128).

## 4. Locale check

Switch the OS or browser locale to each non-English language in `SUPPORTED_LANGUAGES` (`src/i18n/index.ts`). Reload the popup and options page each time.

- [ ] Both surfaces render translated strings in every language.
- [ ] Placeholders (`{host}`, `{message}`) interpolate in error messages.
- [ ] An unsupported OS locale (e.g. German) falls back to English.

## 5. Bump and tag

1. Update `package.json` `version` and add a `CHANGELOG.md` entry.
2. Commit on `main`. Do not push the tag by hand.
3. On push, `.github/workflows/release-extension.yml` builds, uploads, and tags `ext-v$VERSION`.
4. Verify both store dashboards show the new version pending review. The workflow fails at the store upload until the repo has the store secrets listed in the README. Until then, upload the zips from `dist/` by hand.
