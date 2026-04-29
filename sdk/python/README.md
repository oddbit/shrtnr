# shrtnr: URL Shortener SDK for Python

Python client for creating short links, managing URLs, and reading click analytics from a [shrtnr](https://oddb.it/shrtnr-website-pypi) instance. Ships synchronous and asynchronous clients sharing the same method surface.

## Install

```bash
pip install shrtnr
```

Python 3.10 or newer. `httpx` is the only runtime dependency.

## Quick Start

```python
from shrtnr import Shrtnr, CreateLinkOptions

with Shrtnr("https://your-shrtnr.example.com", api_key="sk_your_api_key") as client:
    link = client.create_link(CreateLinkOptions(
        url="https://example.com/long-page",
        label="Campaign landing page",
    ))
    print(link)  # Link(id=1, slugs=[Slug(slug='a3x', ...)], ...)
```

Async usage is identical, with `await` and an `async with`:

```python
import asyncio
from shrtnr import AsyncShrtnr, CreateLinkOptions

async def main() -> None:
    async with AsyncShrtnr("https://your-shrtnr.example.com", api_key="sk_your_api_key") as client:
        link = await client.create_link(CreateLinkOptions(url="https://example.com"))
        print(link)

asyncio.run(main())
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

Every method below exists on both `Shrtnr` (sync) and `AsyncShrtnr` (async). Async examples are omitted for brevity but mirror the sync examples with `await`.

### `create_link`

Shorten a URL. Returns a `Link` with a random slug.

```python
import time

link = client.create_link(CreateLinkOptions(
    url="https://example.com",
    label="My link to the example page",
    expires_at=int(time.time()) + 86400,
))
```

To add a custom slug, call `add_custom_slug` after creation:

```python
link = client.create_link(CreateLinkOptions(url="https://example.com"))
slug = client.add_custom_slug(link.id, "my-campaign")
```

### `list_links`

List all short links.

```python
links = client.list_links()
```

### `get_link`

Get a single link by ID, including its slugs and click count.

```python
link = client.get_link(123)
```

### `get_link_by_slug`

Get a single link by its short URL slug (including custom slugs).

```python
link = client.get_link_by_slug("my-custom-slug")
```

### `update_link`

Update a link's URL, label, or expiry. Omit fields to leave them unchanged; pass `None` explicitly to clear them on the server.

```python
updated = client.update_link(123, UpdateLinkOptions(
    label="Updated label",
    expires_at=None,
))
```

### `disable_link`

Disable a link so it stops redirecting.

```python
disabled = client.disable_link(123)
```

### `enable_link`

Re-enable a previously disabled link.

```python
link = client.enable_link(123)
```

### `delete_link`

Permanently delete a link. Only succeeds if the link has zero clicks — disable it instead if it has traffic.

```python
client.delete_link(123)
```

### `list_links_by_owner`

List all links created by a specific identity (typically an email address).

```python
links = client.list_links_by_owner("user@example.com")
```

### `add_custom_slug`

Add a custom short URL slug to an existing link. Raises `ShrtnrError` with status 409 if the slug already exists, or 400 for invalid format.

```python
slug = client.add_custom_slug(123, "campaign")
```

### `disable_slug`

Disable a custom slug without affecting the parent link or its other slugs.

```python
client.disable_slug(123, "campaign")
```

### `enable_slug`

Re-enable a disabled custom slug.

```python
client.enable_slug(123, "campaign")
```

### `remove_slug`

Permanently remove a custom slug. Only succeeds if the slug has zero clicks.

```python
client.remove_slug(123, "campaign")
```

### `get_link_qr`

Fetch the QR code SVG for a link as a string. Optionally specify which slug to encode.

```python
svg = client.get_link_qr(123)
svg_for_slug = client.get_link_qr(123, slug="my-campaign")
```

### `get_link_analytics`

Read click analytics for a link: referrer, country, device type, and browser breakdown. Defaults to all-time. Pass an optional `range` keyword to scope results to a window.

```python
lifetime = client.get_link_analytics(123)
last_7d = client.get_link_analytics(123, range="7d")
```

### `health`

Check service health and version.

```python
health = client.health()
```

### `create_bundle`

Create a bundle to group related links. Returns the new `Bundle`.

```python
bundle = client.create_bundle(CreateBundleOptions(
    name="Spring campaign",
    description="Email, social, and paid drops",
    icon="sparkles",
    accent="purple",
))
```

### `list_bundles`

List bundles with summary stats: lifetime click total, 30-day sparkline, and top links. Archived bundles are hidden by default.

```python
bundles = client.list_bundles()
with_archived = client.list_bundles(archived=True)
```

### `get_bundle`

Fetch a single bundle's metadata by ID.

```python
bundle = client.get_bundle(42)
```

### `update_bundle`

Rename a bundle or change its description, icon, or accent.

```python
updated = client.update_bundle(42, UpdateBundleOptions(
    name="Spring 2026 campaign",
    accent="green",
))
```

### `delete_bundle`

Permanently delete a bundle. Member links are preserved, only the grouping is discarded.

```python
client.delete_bundle(42)
```

### `archive_bundle`

Archive a bundle so it drops out of the default `list_bundles` response. Member links keep working.

```python
client.archive_bundle(42)
```

### `unarchive_bundle`

Restore a previously archived bundle.

```python
client.unarchive_bundle(42)
```

### `get_bundle_analytics`

Read combined analytics across every link in the bundle: timeline, per-link breakdown, countries, devices, browsers. Defaults to all-time; pass a `TimelineRange` to scope to a window.

```python
lifetime = client.get_bundle_analytics(42)
last_7d = client.get_bundle_analytics(42, range="7d")
print(lifetime.total_clicks, lifetime.per_link)
```

### `list_bundle_links`

List every link currently in a bundle.

```python
links = client.list_bundle_links(42)
```

### `add_link_to_bundle`

Attach a link to a bundle. Idempotent: re-adding an existing member is a no-op.

```python
client.add_link_to_bundle(42, 123)
```

### `remove_link_from_bundle`

Detach a link from a bundle. The link itself stays, only the membership is removed.

```python
client.remove_link_from_bundle(42, 123)
```

### `list_bundles_for_link`

List every bundle a given link belongs to.

```python
bundles = client.list_bundles_for_link(123)
```

## Error Handling

Non-2xx responses raise `ShrtnrError` with the status code, message, and raw response body.

```python
from shrtnr import ShrtnrError

try:
    client.get_link(99999)
except ShrtnrError as error:
    print(error.status)   # 404
    print(str(error))     # "not found"
    print(error.body)
```

Custom slug collisions and format errors from `add_custom_slug` raise `ShrtnrError` (status 409 or 400). Handle them per-call.

## Differences from the TypeScript SDK

The Python SDK mirrors the TypeScript SDK method-for-method, with a few idiomatic adaptations:

- **Sync + async clients.** `Shrtnr` uses `httpx.Client`; `AsyncShrtnr` uses `httpx.AsyncClient`. Surface is identical.
- **Naming.** `snake_case` throughout (`create_link`, `get_link_analytics`), matching PEP 8.
- **Error class.** `ShrtnrError` subclasses `Exception`. Catch with `except ShrtnrError`.
- **Timestamps.** Unix seconds as `int`, matching the wire format. No `datetime` conversion.
- **Options.** `CreateLinkOptions` / `UpdateLinkOptions` / `CreateBundleOptions` / `UpdateBundleOptions` are dataclasses. `UpdateLinkOptions` treats omitted fields as "leave unchanged"; pass `None` to clear on the server.
- **Return types.** Frozen dataclasses for every response model. Full type hints; `mypy --strict` clean.

## License

Apache-2.0. See the root [LICENSE](../../LICENSE) file.
