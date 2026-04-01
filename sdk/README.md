# @oddbit/shrtnr: URL Shortener SDK for TypeScript

TypeScript client for creating short links, managing URLs, and reading click analytics from a [shrtnr](https://github.com/oddbit/shrtnr) instance. Works in Node.js, Deno, Bun, and the browser.

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

- Shorten URLs (create short links with optional vanity slugs)
- List, read, update, and disable links
- Add vanity slugs to existing links
- Read click analytics (referrer, country, device, browser)
- Check service health

Administrative operations (API key management, settings, dashboard stats) are not part of this package. Those are accessible through the admin UI.

## API Reference

### `createLink`

Shorten a URL. Optionally provide a label, vanity slug, or expiry timestamp.

```ts
const link = await client.createLink({
  url: "https://example.com",
  label: "Example",
  vanity_slug: "example",
  expires_at: Math.floor(Date.now() / 1000) + 86400,
});
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

### `addVanitySlug`

Add a custom short URL slug to an existing link.

```ts
const slug = await client.addVanitySlug(123, "campaign");
```

### `getLinkAnalytics`

Read click analytics for a link: referrer, country, device type, and browser breakdown.

```ts
const analytics = await client.getLinkAnalytics(123);
```

### `health`

Check service health and version.

```ts
const health = await client.health();
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

## License

Apache-2.0. See the root [LICENSE](../LICENSE) file.
