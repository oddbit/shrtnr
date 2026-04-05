# Changelog

All notable changes to the SDK are documented in this file.

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
