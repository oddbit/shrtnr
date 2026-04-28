# shrtnr: URL Shortener SDK for Dart and Flutter

Dart client for creating short links, managing URLs, and reading click analytics from a [shrtnr](https://oddb.it/shrtnr-website-pub) instance. Works on the Dart VM, Flutter (mobile, desktop, web), and anywhere `package:http` runs.

## Install

```bash
dart pub add shrtnr
```

or for Flutter:

```bash
flutter pub add shrtnr
```

## Quick Start

```dart
import 'package:shrtnr/shrtnr.dart';

final client = ShrtnrClient(
  baseUrl: 'https://your-shrtnr.example.com',
  auth: const ApiKeyAuth(apiKey: 'sk_your_api_key'),
);

// Shorten a URL
final link = await client.createLink(
  const CreateLinkOptions(
    url: 'https://example.com/long-page',
    label: 'Campaign landing page',
  ),
);

print(link.id);           // 1
print(link.slugs.first);  // primary slug
```

## What This SDK Covers

This package wraps the public link-management API:

- Shorten URLs (create short links)
- Add, disable, enable, and remove custom slugs
- List, read, update, disable, enable, and delete links
- List links by owner identity
- Read click analytics (referrer, country, device, browser)
- Group links into bundles and read combined engagement stats
- Check service health

Administrative operations (API key management, settings, dashboard stats) are not part of this package. Those are accessible through the admin UI.

## API Reference

### `createLink`

Shorten a URL. Returns a `Link` with a random slug.

```dart
final link = await client.createLink(
  CreateLinkOptions(
    url: 'https://example.com',
    label: 'My link to the example page',
    expiresAt: DateTime.now().toUtc().add(const Duration(days: 1)),
  ),
);
```

To add a custom slug, call `addCustomSlug` after creation:

```dart
final link = await client.createLink(
  const CreateLinkOptions(url: 'https://example.com'),
);
final slug = await client.addCustomSlug(link.id, 'my-campaign');
```

### `listLinks`

List all short links.

```dart
final links = await client.listLinks();
```

### `getLink`

Get a single link by ID, including its slugs and click count.

```dart
final link = await client.getLink(123);
```

### `getLinkBySlug`

Get a single link by its short URL slug (including custom slugs).

```dart
final link = await client.getLinkBySlug('my-custom-slug');
```

### `updateLink`

Update a link's URL, label, or expiry. Pass `clearLabel: true` or `clearExpiresAt: true` to explicitly null a field on the server.

```dart
final updated = await client.updateLink(
  123,
  const UpdateLinkOptions(
    label: 'Updated label',
    clearExpiresAt: true,
  ),
);
```

### `disableLink`

Disable a link so it stops redirecting.

```dart
final disabled = await client.disableLink(123);
```

### `enableLink`

Re-enable a previously disabled link.

```dart
final link = await client.enableLink(123);
```

### `deleteLink`

Permanently delete a link. Only succeeds if the link has zero clicks: disable it instead if it has traffic.

```dart
await client.deleteLink(123);
```

### `listLinksByOwner`

List all links created by a specific identity (typically an email address).

```dart
final links = await client.listLinksByOwner('user@example.com');
```

### `addCustomSlug`

Add a custom short URL slug to an existing link. Throws `ShrtnrException` with status 409 if the slug already exists, or 400 for invalid format.

```dart
final slug = await client.addCustomSlug(123, 'campaign');
```

### `disableSlug`

Disable a custom slug without affecting the parent link or its other slugs.

```dart
await client.disableSlug(123, 'campaign');
```

### `enableSlug`

Re-enable a disabled custom slug.

```dart
await client.enableSlug(123, 'campaign');
```

### `removeSlug`

Permanently remove a custom slug. Only succeeds if the slug has zero clicks.

```dart
await client.removeSlug(123, 'campaign');
```

### `getLinkQR`

Fetch the QR code SVG for a link as a string. Optionally specify which slug to encode.

```dart
final svg = await client.getLinkQR(123);
final svgForSlug = await client.getLinkQR(123, slug: 'my-campaign');
```

### `getLinkAnalytics`

Read click analytics for a link: referrer, country, device type, and browser breakdown. Defaults to all-time. Pass an optional `range` to scope results to a window.

```dart
final lifetime = await client.getLinkAnalytics(123);
final last7d = await client.getLinkAnalytics(123, range: '7d');
print(lifetime.totalClicks);
print(lifetime.countries);
```

### `health`

Check service health and version.

```dart
final health = await client.health();
print(health.version);
```

### `createBundle`

Create a bundle to group related links. Returns the new `Bundle`.

```dart
final bundle = await client.createBundle(
  const CreateBundleOptions(
    name: 'Spring campaign',
    description: 'Email, social, and paid drops',
    icon: 'sparkles',
    accent: BundleAccent.purple,
  ),
);
```

### `listBundles`

List bundles with summary stats: lifetime click total, 30-day sparkline, and top links. Archived bundles are hidden by default.

```dart
final bundles = await client.listBundles();
final withArchived = await client.listBundles(archived: true);
```

### `getBundle`

Fetch a single bundle's metadata by ID.

```dart
final bundle = await client.getBundle(42);
```

### `updateBundle`

Rename a bundle or change its description, icon, or accent. Pass `clearDescription: true` or `clearIcon: true` to explicitly null a field on the server.

```dart
final updated = await client.updateBundle(
  42,
  const UpdateBundleOptions(
    name: 'Spring 2026 campaign',
    accent: BundleAccent.green,
  ),
);
```

### `deleteBundle`

Permanently delete a bundle. Member links are preserved, only the grouping is discarded.

```dart
await client.deleteBundle(42);
```

### `archiveBundle`

Archive a bundle so it drops out of the default `listBundles` response. Member links keep working.

```dart
await client.archiveBundle(42);
```

### `unarchiveBundle`

Restore a previously archived bundle.

```dart
await client.unarchiveBundle(42);
```

### `getBundleAnalytics`

Read combined analytics across every link in the bundle: per-link breakdown, countries, devices, browsers. Defaults to all-time; pass `range` to scope to a window.

```dart
final lifetime = await client.getBundleAnalytics(42);
final last7d = await client.getBundleAnalytics(42, range: '7d');
print(lifetime.totalClicks);
print(lifetime.perLink);
```

### `listBundleLinks`

List every link currently in a bundle.

```dart
final links = await client.listBundleLinks(42);
```

### `addLinkToBundle`

Attach a link to a bundle. Idempotent: re-adding an existing member is a no-op.

```dart
await client.addLinkToBundle(42, 123);
```

### `removeLinkFromBundle`

Detach a link from a bundle. The link itself stays, only the membership is removed.

```dart
await client.removeLinkFromBundle(42, 123);
```

### `listBundlesForLink`

List every bundle a given link belongs to.

```dart
final bundles = await client.listBundlesForLink(123);
```

## Error Handling

Non-2xx responses throw `ShrtnrException` with the status code, message, and raw response body.

```dart
import 'package:shrtnr/shrtnr.dart';

try {
  await client.getLink(99999);
} on ShrtnrException catch (e) {
  print(e.statusCode); // 404
  print(e.message);    // "Link not found"
  print(e.body);
}
```

Custom slug collisions and format errors from `addCustomSlug` throw `ShrtnrException` (status 409 or 400). Handle them per-call.

## Differences from the TypeScript SDK

The Dart SDK mirrors the TypeScript SDK method-for-method. A few surfaces differ where Dart idioms diverge:

- Constructor takes named parameters (`baseUrl:`, `auth:`) instead of a single config object.
- Error type is named `ShrtnrException` (Dart reserves `Error` for programmer errors).
- Timestamp fields (`createdAt`, `expiresAt`, `disabledAt`, health `timestamp`) are `DateTime` in UTC rather than raw Unix seconds.
- `isCustom` and `isPrimary` are `bool` rather than `0 | 1`.
- `UpdateLinkOptions` uses `clearLabel` / `clearExpiresAt` flags to distinguish "leave unchanged" from "clear on server", since Dart's null-default pattern collapses them otherwise.

## License

Apache-2.0. See the [root LICENSE](https://github.com/oddbit/shrtnr/blob/main/LICENSE) file.
