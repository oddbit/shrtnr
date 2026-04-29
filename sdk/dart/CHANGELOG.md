# Changelog

## 1.0.0 (2026-04-29)

Ground-up rewrite derived from the OpenAPI spec. This is a deliberate breaking release.

### Breaking changes

**Resource-grouped client.** All methods now live under `client.links`, `client.slugs`, or
`client.bundles`. Flat methods on the top-level client are gone.

```dart
// 0.x
await client.createLink(CreateLinkOptions(url: '...'));
await client.archiveBundle(42);

// 1.0
await client.links.create(url: '...');
await client.bundles.archive(42);
```

**Constructor shape.** The nested `auth: ApiKeyAuth(apiKey: ...)` parameter is replaced by a
flat `apiKey` string.

```dart
// 0.x
ShrtnrClient(baseUrl: '...', auth: ApiKeyAuth(apiKey: 'sk_...'))

// 1.0
ShrtnrClient(baseUrl: '...', apiKey: 'sk_...')
```

**`ShrtnrError` replaces `ShrtnrException`.** The old `body` and `statusCode` fields are gone.
Use `status` and `serverMessage`.

```dart
// 0.x
e.statusCode; e.body;

// 1.0
e.status; e.serverMessage;
```

**Result types.** `delete`, `addLink`, and `removeLink` return typed objects instead of `bool`.

```dart
// 0.x
if (await client.deleteLink(id)) { ... }

// 1.0
final result = await client.links.delete(id);
if (result.deleted) { ... }
```

**Timestamp fields changed.** `createdAt`, `expiresAt`, `disabledAt`, `archivedAt`,
`createdAt`, `updatedAt` are now plain `int` Unix seconds rather than `DateTime`. This matches
the wire format exactly and removes the timezone handling from the SDK.

**`ClickStats` expanded.** New fields from the spec: `referrerHosts`, `linkModes`, `channels`,
`numCountries`, `numReferrers`, `numReferrerHosts`, `numOs`, `numBrowsers`.

**`Link` gains `deltaPct?`:** click count change percentage versus the previous period.

**`BundleWithSummary` is flat.** Fields are directly on the object (it extends `Bundle`) instead
of nested under a `bundle` attribute.

**`bundles.list` `archived` parameter** is now the raw spec enum string (`"all"`, `"only"`,
`"1"`, `"true"`) instead of a `bool`.

**`TimelineData.summary` field names changed.** `last_24h` / `last_7d` style map keys now
surface as camelCase fields (`last24h`, `last7d`, `last30d`, `last90d`, `last1y`) on a typed
`TimelineSummary` object.

**`health()` removed.** The `/_/health` endpoint is outside the public API spec.

**`X-Client: sdk` header removed.** The 1.0 HTTP layer sends only `Authorization: Bearer ...`.

**`ApiKeyAuth`, `ShrtnrAuth`, and `ShrtnrBaseClient` are no longer exported.** They are internal
implementation details.

### New surface

- `client.links`: `get`, `list`, `create`, `update`, `disable`, `enable`, `delete`,
  `analytics`, `timeline`, `qr`, `bundles`
- `client.slugs`: `lookup`, `add`, `disable`, `enable`, `remove`
- `client.bundles`: `get`, `list`, `create`, `update`, `delete`, `archive`, `unarchive`,
  `analytics`, `links`, `addLink`, `removeLink`

See the README for the full method table and migration guide.

### 1.0 post-release fixes (SDK review)

**`BundleAccent` is now a real enum** (was `String`). `Bundle.accent` and
`BundleWithSummary.accent` are typed `BundleAccent`. Pass `BundleAccent.orange` (etc.)
instead of a raw string. The enum carries a `wireValue` getter for the string form.

**`TimelineRange` is now a real enum** (was `String?`). All `range` parameters across
`links`, `bundles`, and the returned `TimelineData.range` field use `TimelineRange`.
Wire values map via `wireValue`: `TimelineRange.last7d.wireValue == "7d"`.

**`BundleArchivedFilter` is now a real enum** (was `String?`). Pass
`BundleArchivedFilter.all`, `.trueValue`, or `.activeOnly` to `bundles.list`.
The wire value `"1"` (numeric alias for `"true"`) is not exposed as a separate member;
use `trueValue` for both.

**`Bundle.accent` is now required at parse time.** A server response that omits `accent`
throws immediately rather than silently defaulting to `"orange"`.

**`DateClickCount` renamed to `DateCount`, `SlugClickCount` renamed to `SlugCount`**
to match the canonical names used by the Python and TypeScript SDKs.

---

## 0.3.0

- `getLinkAnalytics(linkId, {range})` accepts an optional `TimelineRange` keyword. Defaults to all-time when omitted. Use the parameter to scope a query to `'7d'`, `'30d'`, or any other supported window in the same call.
- `getBundleAnalytics(id, {range})` default changed from `'30d'` to `'all'` so it matches `getLinkAnalytics` and returns lifetime stats out of the box. Pass `range: '30d'` if you depended on the previous default.
- Both methods continue to return raw click counts. The server-side public API does not apply per-identity bot or self-referrer filters, regardless of the API key owner's admin settings, so SDK consumers always get unfiltered data.

## 0.2.2

- `disableSlug`, `enableSlug`, and `removeSlug` now work against bearer-token API keys. Previously these methods called URLs that only existed under `/_/admin/api/*`, so every call returned 404. The server now exposes the matching routes under `/_/api/*` with ownership enforcement (the API key owner acts-as the identity that minted it). No SDK code change was needed.

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
