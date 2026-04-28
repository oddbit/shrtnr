# @oddbit/shrtnr: URL Shortener SDK for TypeScript

TypeScript client for creating short links, managing URLs, and reading click analytics from a [shrtnr](https://oddb.it/shrtnr-website-npm) instance. Works in Node.js, Deno, Bun, and the browser.

## Install

```bash
npm install @oddbit/shrtnr
```

## Quick Start

```ts
import { ShrtnrClient } from "@oddbit/shrtnr";

const client = new ShrtnrClient({
  baseUrl: "https://your-shrtnr.example.com",
  auth: { apiKey: "sk_your_api_key" },
});

// Shorten a URL
const link = await client.createLink({
  url: "https://example.com/long-page",
  label: "Campaign landing page",
});

console.log(link); // { id: 1, slugs: [{ slug: "a3x", ... }], ... }
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

```ts
const link = await client.createLink({
  url: "https://example.com",
  label: "My link to the example page",
  expires_at: Math.floor(Date.now() / 1000) + 86400,
});
```

To add a custom slug, call `addCustomSlug` after creation:

```ts
const link = await client.createLink({ url: "https://example.com" });
const slug = await client.addCustomSlug(link.id, "my-campaign");
```

### `listLinks`

List all short links.

```ts
const links = await client.listLinks();
```

### `getLink`

Get a single link by ID, including its slugs and click count.

```ts
const link = await client.getLink(123);
```

### `getLinkBySlug`

Get a single link by its short URL slug (including custom slugs).

```ts
const link = await client.getLinkBySlug("my-custom-slug");
```

### `updateLink`

Update a link's URL, label, or expiry.

```ts
const updated = await client.updateLink(123, {
  label: "Updated label",
  expires_at: null,
});
```

### `disableLink`

Disable a link so it stops redirecting.

```ts
const disabled = await client.disableLink(123);
```

### `enableLink`

Re-enable a previously disabled link.

```ts
const link = await client.enableLink(123);
```

### `deleteLink`

Permanently delete a link. Only succeeds if the link has zero clicks — disable it instead if it has traffic.

```ts
await client.deleteLink(123);
```

### `listLinksByOwner`

List all links created by a specific identity (typically an email address).

```ts
const links = await client.listLinksByOwner("user@example.com");
```

### `addCustomSlug`

Add a custom short URL slug to an existing link. Throws `ShrtnrError` with
status 409 if the slug already exists, or 400 for invalid format.

```ts
const slug = await client.addCustomSlug(123, "campaign");
```

### `disableSlug`

Disable a custom slug without affecting the parent link or its other slugs.

```ts
await client.disableSlug(123, "campaign");
```

### `enableSlug`

Re-enable a disabled custom slug.

```ts
await client.enableSlug(123, "campaign");
```

### `removeSlug`

Permanently remove a custom slug. Only succeeds if the slug has zero clicks.

```ts
await client.removeSlug(123, "campaign");
```

### `getLinkQR`

Fetch the QR code SVG for a link as a string. Optionally specify which slug to encode.

```ts
const svg = await client.getLinkQR(123);
const svgForSlug = await client.getLinkQR(123, "my-campaign");
```

### `getLinkAnalytics`

Read click analytics for a link: referrer, country, device type, and browser breakdown. Defaults to all-time. Pass an optional `TimelineRange` to scope results to a window.

```ts
const lifetime = await client.getLinkAnalytics(123);
const last7d = await client.getLinkAnalytics(123, "7d");
```

### `health`

Check service health and version.

```ts
const health = await client.health();
```

### `createBundle`

Create a bundle to group related links. Returns the new `Bundle`.

```ts
const bundle = await client.createBundle({
  name: "Spring campaign",
  description: "Email, social, and paid drops",
  icon: "sparkles",
  accent: "purple",
});
```

### `listBundles`

List bundles with summary stats: lifetime click total, 30-day sparkline, and top links. Archived bundles are hidden by default.

```ts
const bundles = await client.listBundles();
const withArchived = await client.listBundles({ archived: true });
```

### `getBundle`

Fetch a single bundle's metadata by ID.

```ts
const bundle = await client.getBundle(42);
```

### `updateBundle`

Rename a bundle or change its description, icon, or accent.

```ts
const updated = await client.updateBundle(42, {
  name: "Spring 2026 campaign",
  accent: "green",
});
```

### `deleteBundle`

Permanently delete a bundle. Member links are preserved, only the grouping is discarded.

```ts
await client.deleteBundle(42);
```

### `archiveBundle`

Archive a bundle so it drops out of the default `listBundles` response. Member links keep working.

```ts
await client.archiveBundle(42);
```

### `unarchiveBundle`

Restore a previously archived bundle.

```ts
await client.unarchiveBundle(42);
```

### `getBundleAnalytics`

Read combined analytics across every link in the bundle: timeline, per-link breakdown, countries, devices, browsers. Defaults to all-time; pass a `TimelineRange` to scope to a window.

```ts
const lifetime = await client.getBundleAnalytics(42);
const last7d = await client.getBundleAnalytics(42, "7d");
console.log(lifetime.total_clicks, lifetime.per_link);
```

### `listBundleLinks`

List every link currently in a bundle.

```ts
const links = await client.listBundleLinks(42);
```

### `addLinkToBundle`

Attach a link to a bundle. Idempotent: re-adding an existing member is a no-op.

```ts
await client.addLinkToBundle(42, 123);
```

### `removeLinkFromBundle`

Detach a link from a bundle. The link itself stays, only the membership is removed.

```ts
await client.removeLinkFromBundle(42, 123);
```

### `listBundlesForLink`

List every bundle a given link belongs to.

```ts
const bundles = await client.listBundlesForLink(123);
```

## Error Handling

Non-2xx responses throw `ShrtnrError` with the status code, message, and raw response body.

```ts
import { ShrtnrError } from "@oddbit/shrtnr";

try {
  await client.getLink(99999);
} catch (error) {
  if (error instanceof ShrtnrError) {
    console.error(error.status);  // 404
    console.error(error.message); // "not found"
    console.error(error.body);
  }
}
```

Custom slug collisions and format errors from `addCustomSlug` throw
`ShrtnrError` (status 409 or 400). Handle them per-call.

## License

Apache-2.0. See the root [LICENSE](../LICENSE) file.
