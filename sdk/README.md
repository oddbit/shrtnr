# @oddbit/shrtnr SDK

TypeScript client for shrtnr link management APIs.

## Install

```bash
npm install @oddbit/shrtnr
```

## What This SDK Covers

This package only includes link-management operations.

- Create links
- List links
- Get link details
- Update links
- Disable links
- Add vanity slugs
- Read link analytics
- Read health status

Administrative operations such as API key management, settings, and dashboard stats are not part of this public package.

## Authentication

You can authenticate with either:

- API key using Authorization: Bearer
- Cloudflare Access token using Cf-Access-Jwt-Assertion

## Quick Start

```ts
import { ShrtnrClient } from "@oddbit/shrtnr";

const client = new ShrtnrClient({
  baseUrl: "https://your-shrtnr.example.com",
  auth: { apiKey: "your_api_key" },
});

const link = await client.createLink({
  url: "https://example.com",
  label: "Example",
});

console.log(link);
```

Cloudflare Access authentication example:

```ts
const client = new ShrtnrClient({
  baseUrl: "https://your-shrtnr.example.com",
  auth: { accessToken: "your_cf_access_token" },
});
```

## API Reference

### ShrtnrClient

#### health

Checks service health.

```ts
const health = await client.health();
```

#### createLink

Creates a new short link.

```ts
const link = await client.createLink({
  url: "https://example.com",
  label: "Example",
  vanity_slug: "example",
  expires_at: Math.floor(Date.now() / 1000) + 86400,
});
```

#### listLinks

Lists links visible to the authenticated identity.

```ts
const links = await client.listLinks();
```

#### getLink

Gets one link by ID.

```ts
const link = await client.getLink(123);
```

#### updateLink

Updates mutable fields for a link.

```ts
const updated = await client.updateLink(123, {
  label: "Updated label",
  expires_at: null,
});
```

#### disableLink

Disables a link by setting expiry to now.

```ts
const disabled = await client.disableLink(123);
```

#### addVanitySlug

Adds a vanity slug to an existing link.

```ts
const slug = await client.addVanitySlug(123, "campaign");
```

#### getLinkAnalytics

Returns click analytics for a link.

```ts
const analytics = await client.getLinkAnalytics(123);
```

## Error Handling

Non-2xx responses throw ShrtnrError.

```ts
import { ShrtnrError } from "@oddbit/shrtnr";

try {
  await client.getLink(99999);
} catch (error) {
  if (error instanceof ShrtnrError) {
    console.error(error.status);
    console.error(error.message);
    console.error(error.body);
  }
}
```
