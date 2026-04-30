# shrtnr

Dart SDK for [shrtnr](https://oddb.it/shrtnr-website-pub), a self-hosted URL shortener on Cloudflare Workers. Create short links, manage slugs, and read click analytics.

[![pub.dev](https://img.shields.io/pub/v/shrtnr)](https://pub.dev/packages/shrtnr)
[![license](https://img.shields.io/pub/l/shrtnr)](https://www.apache.org/licenses/LICENSE-2.0)

## Install

```bash
dart pub add shrtnr
```

## Quick start

```dart
import 'package:shrtnr/shrtnr.dart';

final client = ShrtnrClient(
  baseUrl: 'https://your-shrtnr.example.com',
  apiKey: 'sk_your_api_key',
);

final link = await client.links.create(url: 'https://example.com/very-long-path');
print(link.slugs.first.slug); // 'a3x9'

client.close();
```

## Configuration

```dart
ShrtnrClient(
  baseUrl: 'https://your-shrtnr.example.com', // required
  apiKey: 'sk_...',                            // required; from the admin dashboard
  httpClient: customHttpClient,                // optional; inject a custom http.Client
)
```

The `httpClient` parameter accepts any `http.Client`. Pass a custom implementation for test
mocking or custom TLS configuration. When omitted, a new `http.Client` is created and
closed by `client.close()`.

## Resources

### Links (`client.links`)

| Method | Description |
|---|---|
| `get(id, {range?})` | Get a link with click count |
| `list({owner?, range?})` | List all links |
| `create({url, label?, slugLength?, expiresAt?, allowDuplicate?})` | Create a short link |
| `update(id, {url?, label?, expiresAt?})` | Update URL, label, or expiry |
| `disable(id)` | Stop redirecting |
| `enable(id)` | Resume redirecting |
| `delete(id)` | Permanently delete |
| `analytics(id, {range?})` | Click breakdown by country, device, referrer, etc. |
| `timeline(id, {range?})` | Click counts bucketed over time |
| `qr(id, {slug?, size?})` | QR code as SVG string |
| `bundles(id)` | Bundles this link belongs to |

```dart
// Shorten a URL
final link = await client.links.create(url: 'https://example.com', label: 'Landing page');

// Get a 7-day click count
final fresh = await client.links.get(link.id, range: '7d');

// Full analytics for the last 30 days
final stats = await client.links.analytics(link.id, range: '30d');
print('${stats.totalClicks} clicks, ${stats.numCountries} countries');
```

### Slugs (`client.slugs`)

| Method | Description |
|---|---|
| `lookup(slug)` | Find a link by slug |
| `add(linkId, slug)` | Add a custom slug |
| `disable(linkId, slug)` | Disable a slug |
| `enable(linkId, slug)` | Re-enable a slug |
| `remove(linkId, slug)` | Remove a slug |

```dart
// Add a campaign slug then disable it when the campaign ends
await client.slugs.add(link.id, 'spring-sale');
await client.slugs.disable(link.id, 'spring-sale');

// Look up a link by its slug
final found = await client.slugs.lookup('spring-sale');
```

### Bundles (`client.bundles`)

Groups of related links with combined analytics.

| Method | Description |
|---|---|
| `get(id, {range?})` | Get a bundle with click summary |
| `list({archived?, range?})` | List bundles |
| `create({name, description?, icon?, accent?})` | Create a bundle |
| `update(id, {name?, description?, icon?, accent?})` | Update metadata |
| `delete(id)` | Permanently delete |
| `archive(id)` | Hide from default listing |
| `unarchive(id)` | Restore an archived bundle |
| `analytics(id, {range?})` | Combined click analytics |
| `links(id)` | List links in the bundle |
| `addLink(id, linkId)` | Add a link |
| `removeLink(id, linkId)` | Remove a link |

```dart
// Create a bundle and add links to it
final bundle = await client.bundles.create(name: 'Spring 2026', accent: 'green');
await client.bundles.addLink(bundle.id, linkA.id);
await client.bundles.addLink(bundle.id, linkB.id);

// Combined analytics for the last 7 days
final stats = await client.bundles.analytics(bundle.id, range: '7d');
print(stats.totalClicks);
```

## Models

All model fields use camelCase. The SDK maps snake_case JSON from the wire automatically
inside each `fromJson` factory.

Key types exported from `package:shrtnr/shrtnr.dart`:

- `Link`, `Slug`, `Bundle`, `BundleWithSummary`, `BundleTopLink`
- `ClickStats`, `TimelineData`, `TimelineBucket`, `TimelineSummary`, `NameCount`
- `DateClickCount`, `SlugClickCount`
- `DeletedResult`, `AddedResult`, `RemovedResult`

Timestamp fields (`createdAt`, `expiresAt`, `disabledAt`, `archivedAt`, `updatedAt`) are
plain `int` Unix seconds, matching the wire format exactly.

## Errors

Every 4xx/5xx response throws `ShrtnrError`. Network failures also throw `ShrtnrError` with
`status: 0`.

```dart
import 'package:shrtnr/shrtnr.dart';

try {
  await client.links.get(99999);
} on ShrtnrError catch (err) {
  print(err.status);         // 404
  print(err.serverMessage);  // 'not found'
  print(err);                // 'ShrtnrError(HTTP 404): not found'
}
```

## See also

- API docs: `/_/api/docs` on your shrtnr deployment
- OpenAPI spec: `/_/api/openapi.json`
- Source: [github.com/oddbit/shrtnr](https://github.com/oddbit/shrtnr)

## License

Apache 2.0. Built and maintained by [Oddbit](https://oddbit.id).
