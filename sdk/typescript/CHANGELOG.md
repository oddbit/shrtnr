# Changelog

All notable changes to the SDK are documented in this file.

## 0.7.2

- `disableSlug`, `enableSlug`, and `removeSlug` now work against bearer-token API keys. Previously these methods called URLs that only existed under `/_/admin/api/*`, so every call returned 404. The server now exposes the matching routes under `/_/api/*` with ownership enforcement (the API key owner acts-as the identity that minted it). No SDK code change was needed — the methods always pointed at the correct URL, the server just had not yet implemented it.

## 0.7.1

- Document every bundle method in the README with a short description and usage snippet. The methods shipped in 0.7.0 but were only mentioned in the feature list, so consumers had to read the source to discover them.

## 0.7.0

### New feature: Bundles

Bundles group related links so you can read combined engagement across the whole group. A link can belong to zero or many bundles.

### New methods

- `createBundle(options)`: create a new bundle (name, description, icon, accent).
- `listBundles(options?)`: list bundles with summary stats (total clicks, sparkline, top links).
- `getBundle(id)`: fetch a bundle's metadata.
- `updateBundle(id, patch)`: rename, re-style, or edit a bundle.
- `deleteBundle(id)`: delete a bundle (member links are preserved).
- `archiveBundle(id)`: archive a bundle so it hides from the default list.
- `unarchiveBundle(id)`: restore a previously archived bundle.
- `getBundleAnalytics(id, range?)`: combined analytics across all links in the bundle.
- `listBundleLinks(id)`: list every link in a bundle.
- `addLinkToBundle(bundleId, linkId)`: attach a link. Idempotent.
- `removeLinkFromBundle(bundleId, linkId)`: detach a link from a bundle.
- `listBundlesForLink(linkId)`: list every bundle a link belongs to.

### Type additions

- `Bundle`, `BundleAccent`, `BundleWithSummary`, `BundleStats`, `BundleStatsPerLink`.
- `CreateBundleOptions`, `UpdateBundleOptions`, `ListBundlesOptions`.
- `TimelineRange`, `TimelineBucket`, `TimelineData` now exported.

## 0.6.2

- Updating documentation.

## 0.6.1

- `ClickStats` now includes `slug_clicks`, providing a breakdown of clicks for each individual slug associated with a link.

## 0.6.0

### Breaking

- `disableSlug(linkId, slug)`, `enableSlug(linkId, slug)`, and `removeSlug(linkId, slug)` now identify slugs by their text value instead of a numeric id. Update any call sites that passed a numeric `slugId`.
- `Slug.id` field removed. The `slug` string is the identifier.

### Other

- `disableSlug`, `enableSlug`, and `removeSlug` URL-encode the slug text, so slugs with special characters are handled correctly.

## 0.5.0

### New methods

- `enableLink(id)` — re-enable a previously disabled link.
- `deleteLink(id)` — delete a zero-click link permanently.
- `listLinksByOwner(owner)` — list all links created by a specific identity (email).
- `disableSlug(linkId, slug)` — disable a custom slug without touching the parent link.
- `enableSlug(linkId, slug)` — re-enable a disabled custom slug.
- `removeSlug(linkId, slug)` — permanently remove a zero-click custom slug.

### Type additions

- `Link.created_by` — identity (email or "anonymous") that created the link.
- `Slug.is_primary` — whether the slug is the primary redirect target.
- `Slug.disabled_at` — Unix timestamp when the slug was disabled, or null if active.

## 0.3.0

### Breaking

- `addVanitySlug` renamed to `addCustomSlug`. Update any call sites.
- `Slug.is_vanity` renamed to `Slug.is_custom`.
- `CreateLinkOptions.vanity_slug` renamed to `CreateLinkOptions.custom_slug`.

### New methods

- `getLinkBySlug(slug)` — fetch a link by its short URL slug.
- `getLinkQR(linkId, slug?)` — fetch the QR code SVG for a link as a string.

### Type additions

- `Link.created_via` field added.
- `ClickStats.channels` breakdown added.

### Other

- `X-Client: sdk` request header sent on every request.

## 0.2.5

- Rewrote README with clearer quick start, concrete method descriptions, and runtime compatibility note (Node.js, Deno, Bun, browser)
- Expanded npm keywords for better discoverability: `link-shortener`, `short-url`, `shorten-url`, `click-analytics`, `custom-slug`

## 0.2.4

- Config fix

## 0.2.2

- Removed unreachable admin client and internal entry point (dead code)
- Removed unused admin types: `DashboardStats`, `ApiKey`, `CreatedApiKey`, `Settings`, `CreateApiKeyOptions`

## 0.2.1

- Updating documentation.

## 0.2.0

- Added API key management methods to the SDK client.
- Added strict typed request and response models for settings, health, links, slugs, and analytics.
- Improved error handling with structured API error parsing.
