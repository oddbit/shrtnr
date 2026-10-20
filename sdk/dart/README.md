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

Pass any `http.Client` as `httpClient` for test mocks or custom TLS. Without one, the SDK creates its own `http.Client`, and `client.close()` closes it.

## Resources

### Links (`client.links`)

| Method | Description |
|---|---|
| `get(id, {range?})` | Get a link with click count |
| `list({owner?, range?})` | List all links |
| `create({url, label?, slugLength?, expiresAt?, allowDuplicate?})` | Create a short link |
| `update(link)` | Update URL, label, or expiry (pass a `Link` from `copyWith`) |
| `disable(id)` | Stop redirecting |
| `enable(id)` | Resume redirecting |
| `delete(id)` | Permanently delete |
| `analytics(id, {range?})` | Click breakdown by country, device, referrer, etc. |
| `breakdown(id, {dimension, range?, offset?, limit?})` | Page through the countries, sources (referrers) or domains (referrer_hosts) breakdown |
| `timeline(id, {range?})` | Click counts bucketed over time |
| `qr(id, {slug?, size?})` | QR code as SVG string |
| `bundles(id)` | Bundles this link belongs to |

```dart
// Shorten a URL
final link = await client.links.create(url: 'https://example.com', label: 'Landing page');

// Get a 7-day click count
final fresh = await client.links.get(link.id, range: TimelineRange.last7d);

// Full analytics for the last 30 days
final stats = await client.links.analytics(link.id, range: TimelineRange.last30d);
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
| `update(bundle)` | Update metadata (pass a `Bundle` from `copyWith`) |
| `delete(id)` | Permanently delete |
| `archive(id)` | Hide from default listing |
| `unarchive(id)` | Restore an archived bundle |
| `analytics(id, {range?})` | Combined click analytics |
| `breakdown(id, {dimension, range?, offset?, limit?})` | Page through the countries, sources (referrers) or domains (referrer_hosts) breakdown |
| `links(id)` | List links in the bundle |
| `addLink(id, linkId)` | Add a link |
| `removeLink(id, linkId)` | Remove a link |

```dart
// Create a bundle and add links to it
final bundle = await client.bundles.create(name: 'Spring 2026', accent: BundleAccent.green);
await client.bundles.addLink(bundle.id, linkA.id);
await client.bundles.addLink(bundle.id, linkB.id);

// Combined analytics for the last 7 days
final stats = await client.bundles.analytics(bundle.id, range: TimelineRange.last7d);
print(stats.totalClicks);
```

### Config (`client.config`)

Deployment settings a client needs to build short URLs.

| Method | Description |
|---|---|
| `get()` | Origin short URLs are handed out on |

```dart
// Build a short URL on the origin the deployment hands links out on, from the
// primary slug: the one the copy button and the QR code use
final config = await client.config.get();
final primary = link.slugs.firstWhere(
  (s) => s.isPrimary == 1,
  orElse: () => link.slugs.first,
);
print('${config.shortOrigin}/${primary.slug}');
```

## Models

Model fields use camelCase. Each `fromJson` factory maps the snake_case wire JSON.

Every `Link` carries `shortOrigin`: the origin this deployment hands short URLs out on. It is the deployment's `SHORT_ORIGIN` when set, otherwise the request origin. `client.config.get()` returns the same value in `Config.shortOrigin`. Build short URLs as `${shortOrigin}/${slug}` so they match the copy button, the QR code and the redirects. Deployments older than the field omit it, so the SDK fills in the origin of `baseUrl`.

Timestamp fields (`createdAt`, `expiresAt`, `disabledAt`, `archivedAt`, `updatedAt`) are plain `int` Unix seconds, matching the wire format.

Key types exported from `package:shrtnr/shrtnr.dart`:

- `Link`, `Slug`, `Bundle`, `BundleWithSummary`, `BundleTopLink`, `Config`
- `ClickStats`, `TimelineData`, `TimelineBucket`, `TimelineSummary`, `NameCount`
- `DateCount`, `SlugCount`, `BreakdownPage`
- `DeletedResult`, `AddedResult`, `RemovedResult`
- Enums: `TimelineRange`, `BundleAccent`, `BreakdownDimension`, `BundleArchivedFilter`

## Errors

Any 4xx/5xx response or network failure throws `ShrtnrError`. A network failure carries `status: 0`.

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

## Attribution

`shrtnr` is developed and maintained by **[Oddbit](https://oddb.it/website)**.

- Source repository: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution notices: [NOTICE](NOTICE)
- Name and logo usage: [Trademark Policy](TRADEMARK_POLICY.md)

If you publish a fork or derivative work, retain the license and notice files,
preserve applicable copyright and attribution notices, and clearly indicate
that your version has been modified.
