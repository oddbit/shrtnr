# Changelog

All notable changes to the SDK are documented in this file.

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
