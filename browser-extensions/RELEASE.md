# Release checklist

Run before bumping `package.json` and tagging `ext-v*`.

## 1. Automated gates

```bash
cd browser-extensions
yarn install --frozen-lockfile
yarn test
yarn build
yarn lint:firefox
node scripts/verify-build.mjs
```

All must exit 0. Two `UNSAFE_VAR_ASSIGNMENT` warnings from `web-ext lint` are expected (Preact's runtime). `errors=0` is required.

## 2. Smoke test — Chrome

Load `dist/chrome/` as an unpacked extension via `chrome://extensions/`.

- [ ] Fresh install opens `options.html` automatically. Deploy CTA banner is visible.
- [ ] Save with valid URL + key persists the config. Banner disappears.
- [ ] Click toolbar on a normal page → popup opens, shortens, auto-copies, "Copied" indicator fades after ~1.5s.
- [ ] Re-open popup → repeat shorten succeeds (or returns the same link if `allowDuplicate` is false on the server — server's call).
- [ ] Click **QR** → SVG appears, click again hides without refetching.
- [ ] Click **View in admin** → opens `${baseUrl}/_/admin/links/<id>` in a new tab.
- [ ] Open popup on `chrome://newtab` → shows "shrtnr can't shorten internal browser pages."
- [ ] Open popup on `about:blank` → same internal-page error.
- [ ] Edit options to a wrong host → popup shows network error → **Retry** + **Settings**.
- [ ] Enter a wrong API key → popup shows "Your API key was rejected." → **Settings**.

## 3. Smoke test — Firefox

```bash
npx web-ext run --source-dir dist/firefox
```

- [ ] Fresh install opens `options.html`. Banner visible.
- [ ] Same flows as Chrome above, including QR, retry, and settings recovery.
- [ ] Verify the toolbar icon renders crisp at all sizes (16, 32, 48, 128).

## 4. Locale check

Switch the OS or browser locale to Indonesian, then to Swedish. Reload the popup and options page.

- [ ] Both surfaces render translated strings.
- [ ] Placeholders (`{host}`, `{message}`) interpolate correctly in error messages.
- [ ] Fall back to English when the OS locale is something else (e.g. German).

## 5. Bump and tag

1. Update `package.json` `version` and add a `CHANGELOG.md` entry.
2. Commit on `main`. Do not push the tag manually.
3. Workflow `.github/workflows/release-extension.yml` runs on push, builds, uploads, and tags `ext-v$VERSION`.
4. Verify the GitHub release was created and both store dashboards show the new version pending review.
