# Changelog

All notable changes to the SDK are documented in this file.

## 1.0.1 (2026-04-30)

Packaging and documentation only. No public surface changes.

- Ship `LICENSE`, `NOTICE`, and `TRADEMARK_POLICY.md` in the published tarball alongside `dist`. Consumers running license scanners now see Apache-2.0 attribution and Oddbit's trademark policy without having to clone the repo.
- README polish: dropped the "Migrating from 0.x" section (the 0.x line is past its rewrite window) and replaced "License" with an "Attribution" section that points at the same files.

## 1.0.0 (2026-04-29)

Ground-up rewrite. This is a deliberate breaking release derived from the OpenAPI spec.

### Breaking changes

**Resource-grouped client.** All methods now live under `client.links`, `client.slugs`, or `client.bundles`. Flat methods on the top-level client are gone.

```ts
// 0.x
client.createLink(...)
client.archiveBundle(...)

// 1.0
client.links.create(...)
client.bundles.archive(...)
```

**Constructor shape.** The nested `auth: { apiKey }` object is replaced by a flat `apiKey` field.

```ts
// 0.x
new ShrtnrClient({ baseUrl: "...", auth: { apiKey: "sk_..." } })

// 1.0
new ShrtnrClient({ baseUrl: "...", apiKey: "sk_..." })
```

**All model fields are camelCase.** The HTTP layer converts snake_case wire format on parse and serialize. Fields like `created_at`, `total_clicks`, `is_custom`, `link_id` are now `createdAt`, `totalClicks`, `isCustom`, `linkId`.

**`ShrtnrError` shape.** The `body` field is removed. Use `serverMessage` (the `error` string from the JSON response). The `message` property formats as `"shrtnr API error (HTTP {status}): {serverMessage}"`.

**`ClickStats` expanded.** New fields from the spec: `referrerHosts`, `linkModes`, `channels`, `numCountries`, `numReferrers`, `numReferrerHosts`, `numOs`, `numBrowsers`.

**`TimelineData.summary` keys renamed.** `last_24h` → `last24h`, `last_7d` → `last7d`, etc.

**`Link` gains `deltaPct?`:** click count change percentage versus the previous period.

**`BundleWithSummary.topLinks[].clickCount`** (was `click_count`).

**`links.list` and `bundles.list` accept `range?`** to scope click counts to a time window.

**`bundles.list` `archived` parameter** is now the raw spec enum (`"all"`, `"only"`, `"1"`, `"true"`) instead of a boolean.

**`health()` removed.** The `/_/health` endpoint is outside the public API spec.

### New surface

- `client.links`: `get`, `list`, `create`, `update`, `disable`, `enable`, `delete`, `analytics`, `timeline`, `qr`, `bundles`
- `client.slugs`: `lookup`, `add`, `disable`, `enable`, `remove`
- `client.bundles`: `get`, `list`, `create`, `update`, `delete`, `archive`, `unarchive`, `analytics`, `links`, `addLink`, `removeLink`

See the README for the full method table and migration guide.

### 1.0 post-release fixes (SDK review)

**Named result types.** `links.delete`, `bundles.delete`, `bundles.addLink`,
`bundles.removeLink`, and `slugs.remove` previously returned anonymous inline object
types (`Promise<{ deleted: boolean }>` etc.). They now return the named interfaces
`DeletedResult`, `AddedResult`, and `RemovedResult` exported from the package.
Existing code that destructures or reads `.deleted`, `.added`, `.removed` continues
to work without change.

**Named analytics sub-types.** `ClickStats.clicksOverTime` is now `DateCount[]`
(was `{ date: string; count: number }[]`). `ClickStats.slugClicks` is now
`SlugCount[]`. `BundleWithSummary.topLinks` is now `BundleTopLink[]`.
All three interfaces are exported from the package.

---

## 0.8.0

- `getLinkAnalytics(linkId, range?)` accepts an optional `TimelineRange`. Defaults to all-time when omitted. Use the parameter to scope a query to `"7d"`, `"30d"`, or any other supported window in the same call.
- `getBundleAnalytics(id, range?)` default changed from `"30d"` to `"all"` so it matches `getLinkAnalytics` and returns lifetime stats out of the box. Pass an explicit `"30d"` if you depended on the previous default.
- Both methods continue to return raw click counts. The server-side public API does not apply per-identity bot or self-referrer filters, regardless of the API key owner's admin settings, so SDK consumers always get unfiltered data.

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
