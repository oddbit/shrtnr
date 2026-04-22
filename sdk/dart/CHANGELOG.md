# Changelog

## 0.2.1

- Document every bundle method in the README with a short description and usage snippet.
- Extend `example/shrtnr_example.dart` to create a bundle, attach the example link, read bundle analytics, and clean up.

## 0.2.0

### New feature: Bundles

Bundles group related links so you can read combined engagement across the whole group. A link can belong to zero or many bundles.

### New methods

- `createBundle(options)`: create a new bundle.
- `listBundles({archived})`: list bundles with summary stats (total clicks, sparkline, top links).
- `getBundle(id)`: fetch a bundle's metadata.
- `updateBundle(id, options)`: rename, re-style, or edit a bundle.
- `deleteBundle(id)`: delete a bundle (member links are preserved).
- `archiveBundle(id)`: archive a bundle so it hides from the default list.
- `unarchiveBundle(id)`: restore a previously archived bundle.
- `getBundleAnalytics(id, {range})`: combined analytics across all links in the bundle.
- `listBundleLinks(id)`: list every link in a bundle.
- `addLinkToBundle(bundleId, linkId)`: attach a link. Idempotent.
- `removeLinkFromBundle(bundleId, linkId)`: detach a link from a bundle.
- `listBundlesForLink(linkId)`: list every bundle a link belongs to.

### Type additions

- `Bundle`, `BundleAccent`, `BundleWithSummary`, `BundleTopLink`, `BundleStats`, `BundleLinkStats`.
- `CreateBundleOptions`, `UpdateBundleOptions` (with `clearDescription` / `clearIcon` flags to match existing Dart nullability conventions).

## 0.1.2

- Add `example/shrtnr_example.dart` demonstrating the SDK end to end, so pub.dev recognizes the package has an example.
- Reformat `LICENSE` using the canonical Apache 2.0 template so pub.dev's license detector identifies it as OSI-approved.

## 0.1.1

- Updating documentation.

## 0.1.0

Initial Dart SDK release. Mirrors the TypeScript SDK's public surface:

- `ShrtnrClient` with link CRUD, custom slug management, click analytics, QR
  code retrieval, and a health endpoint.
- `ShrtnrException` for non-2xx responses, carrying status code, message, and
  raw body.
- `ApiKeyAuth` for Bearer-token authentication.
- Timestamp fields (`createdAt`, `expiresAt`, `disabledAt`, health
  `timestamp`) exposed as `DateTime` in UTC; JSON flag fields (`is_custom`,
  `is_primary`) exposed as `bool`.
