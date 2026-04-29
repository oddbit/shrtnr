# @oddbit/shrtnr

TypeScript SDK for [shrtnr](https://oddb.it/shrtnr-website-npm), a self-hosted URL shortener on Cloudflare Workers. Create short links, manage slugs, and read click analytics.

[![npm](https://img.shields.io/npm/v/@oddbit/shrtnr)](https://www.npmjs.com/package/@oddbit/shrtnr)
[![license](https://img.shields.io/npm/l/@oddbit/shrtnr)](https://www.apache.org/licenses/LICENSE-2.0)

## Install

```bash
npm install @oddbit/shrtnr
# or
yarn add @oddbit/shrtnr
```

## Quick start

```ts
import { ShrtnrClient } from "@oddbit/shrtnr";

const client = new ShrtnrClient({
  baseUrl: "https://your-shrtnr.example.com",
  apiKey: "sk_your_api_key",
});

const link = await client.links.create({ url: "https://example.com/very-long-path" });
console.log(link.slugs[0].slug); // "a3x9"
```

## Configuration

```ts
new ShrtnrClient({
  baseUrl: "https://your-shrtnr.example.com", // required
  apiKey: "sk_...",                            // required; from the admin dashboard
  fetch: customFetch,                          // optional; inject a custom HTTP client
})
```

The `fetch` option is useful for test mocking or custom TLS configurations.

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

```ts
// Shorten a URL
const link = await client.links.create({ url: "https://example.com", label: "Landing page" });

// Get a 7-day click count
const fresh = await client.links.get(link.id, { range: "7d" });

// Full analytics for the last 30 days
const stats = await client.links.analytics(link.id, { range: "30d" });
console.log(stats.totalClicks, stats.countries, stats.browsers);
```

### Slugs (`client.slugs`)

| Method | Description |
|---|---|
| `lookup(slug)` | Find a link by slug |
| `add(linkId, slug)` | Add a custom slug |
| `disable(linkId, slug)` | Disable a slug |
| `enable(linkId, slug)` | Re-enable a slug |
| `remove(linkId, slug)` | Remove a slug |

```ts
// Add a campaign slug then disable it when the campaign ends
await client.slugs.add(link.id, "spring-sale");
await client.slugs.disable(link.id, "spring-sale");

// Look up a link by its slug
const found = await client.slugs.lookup("spring-sale");
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

```ts
// Create a bundle and add links to it
const bundle = await client.bundles.create({ name: "Spring 2026", accent: "green" });
await client.bundles.addLink(bundle.id, linkA.id);
await client.bundles.addLink(bundle.id, linkB.id);

// Combined analytics for the last 7 days
const stats = await client.bundles.analytics(bundle.id, { range: "7d" });
console.log(stats.totalClicks);
```

## Models

All model fields use camelCase. The SDK converts snake_case JSON from the wire automatically.

Key types exported from `@oddbit/shrtnr`:

- `Link`, `Slug`, `Bundle`, `BundleWithSummary`
- `ClickStats`, `TimelineData`, `NameCount`, `TimelineBucket`
- `TimelineRange` (`"24h" | "7d" | "30d" | "90d" | "1y" | "all"`)
- `BundleAccent` (`"orange" | "red" | "green" | "blue" | "purple"`)
- Request body types: `CreateLinkBody`, `UpdateLinkBody`, `AddSlugBody`, `CreateBundleBody`, `UpdateBundleBody`

## Errors

Every 4xx/5xx response throws `ShrtnrError`. Network failures also throw `ShrtnrError` with `status: 0`.

```ts
import { ShrtnrError } from "@oddbit/shrtnr";

try {
  await client.links.get(99999);
} catch (err) {
  if (err instanceof ShrtnrError) {
    console.error(err.status);        // 404
    console.error(err.serverMessage); // "not found"
    console.error(err.message);       // "shrtnr API error (HTTP 404): not found"
  }
}
```

## Migrating from 0.x

1.0 is a clean break. Summary of changes:

**Resource-grouped client.** Methods moved to namespaces.

```ts
// 0.x
await client.createLink({ url: "..." });
await client.addCustomSlug(id, "promo");
await client.archiveBundle(id);

// 1.0
await client.links.create({ url: "..." });
await client.slugs.add(id, "promo");
await client.bundles.archive(id);
```

**Constructor shape changed.** No more nested `auth` object.

```ts
// 0.x
new ShrtnrClient({ baseUrl: "...", auth: { apiKey: "sk_..." } });

// 1.0
new ShrtnrClient({ baseUrl: "...", apiKey: "sk_..." });
```

**All fields are now camelCase.** The SDK converts snake_case JSON from the API automatically.

```ts
// 0.x (raw snake_case from server)
link.created_at; link.total_clicks; slug.is_custom;

// 1.0 (camelCase)
link.createdAt; link.totalClicks; slug.isCustom;
```

**`ShrtnrError` shape changed.** The `body` field is gone; use `serverMessage`.

```ts
// 0.x
err.body; // raw parsed body

// 1.0
err.serverMessage; // the "error" string from the response
```

**`ClickStats` expanded.** New fields: `referrerHosts`, `linkModes`, `channels`, `numCountries`, `numReferrers`, `numReferrerHosts`, `numOs`, `numBrowsers`.

**`TimelineData.summary` keys changed** from `last_24h`/`last_7d` to `last24h`/`last7d`.

**`BundleWithSummary.topLinks[].clickCount`** (was `click_count`).

**`links.list` and `bundles.list` now accept `range?`** for scoping click counts to a window.

**`BundlesResource.list` `archived` parameter** is now the raw enum string (`"all"`, `"only"`, `"1"`, `"true"`) rather than a boolean, matching the API spec exactly.

## See also

- API docs: `/_/api/docs` on your shrtnr deployment
- OpenAPI spec: `/_/api/openapi.json`
- Source: [github.com/oddbit/shrtnr](https://github.com/oddbit/shrtnr)

## License

Apache 2.0. Built and maintained by [Oddbit](https://oddbit.id).
