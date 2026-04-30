# shrtnr

Python SDK for [shrtnr](https://oddb.it/shrtnr-website-pypi), a self-hosted URL shortener on Cloudflare Workers. Create short links, manage slugs, and read click analytics.

[![PyPI](https://img.shields.io/pypi/v/shrtnr)](https://pypi.org/project/shrtnr/)
[![license](https://img.shields.io/pypi/l/shrtnr)](https://www.apache.org/licenses/LICENSE-2.0)

## Install

```bash
pip install shrtnr
```

## Quick start

```python
from shrtnr import Shrtnr

client = Shrtnr(base_url="https://your-shrtnr.example.com", api_key="sk_your_api_key")

link = client.links.create(url="https://example.com/very-long-path")
print(link.slugs[0].slug)  # "a3x9"
```

Async usage:

```python
import asyncio
from shrtnr import AsyncShrtnr

async def main():
    async with AsyncShrtnr(base_url="https://your-shrtnr.example.com", api_key="sk_...") as client:
        link = await client.links.create(url="https://example.com")
        print(link.id)

asyncio.run(main())
```

## Configuration

```python
Shrtnr(
    base_url="https://your-shrtnr.example.com",  # required
    api_key="sk_...",                             # required; from the admin dashboard
    timeout=30.0,                                 # optional; seconds (default: 30)
    http_client=custom_httpx_client,              # optional; inject a custom httpx.Client
)
```

`AsyncShrtnr` accepts the same parameters, but takes an `httpx.AsyncClient` for `http_client`.

Both classes work as context managers:

```python
with Shrtnr(base_url="...", api_key="sk_...") as client:
    links = client.links.list()
```

## Resources

### Links (`client.links`)

| Method | Description |
|---|---|
| `get(id, *, range=None)` | Get a link with click count |
| `list(*, owner=None, range=None)` | List all links |
| `create(*, url, label=None, slug_length=None, expires_at=None, allow_duplicate=None)` | Create a short link |
| `update(id, *, url=None, label=None, expires_at=None)` | Update URL, label, or expiry |
| `disable(id)` | Stop redirecting |
| `enable(id)` | Resume redirecting |
| `delete(id)` | Permanently delete |
| `analytics(id, *, range=None)` | Click breakdown by country, device, referrer, etc. |
| `timeline(id, *, range=None)` | Click counts bucketed over time |
| `qr(id, *, slug=None, size=None)` | QR code as SVG string |
| `bundles(id)` | Bundles this link belongs to |

```python
# Shorten a URL
link = client.links.create(url="https://example.com", label="Landing page")

# Get a 7-day click count
fresh = client.links.get(link.id, range="7d")

# Full analytics for the last 30 days
stats = client.links.analytics(link.id, range="30d")
print(stats.total_clicks, stats.countries, stats.browsers)
```

### Slugs (`client.slugs`)

| Method | Description |
|---|---|
| `lookup(slug)` | Find a link by slug |
| `add(link_id, slug)` | Add a custom slug |
| `disable(link_id, slug)` | Disable a slug |
| `enable(link_id, slug)` | Re-enable a slug |
| `remove(link_id, slug)` | Remove a slug |

```python
# Add a campaign slug then disable it when the campaign ends
client.slugs.add(link.id, "spring-sale")
client.slugs.disable(link.id, "spring-sale")

# Look up a link by its slug
found = client.slugs.lookup("spring-sale")
```

### Bundles (`client.bundles`)

Groups of related links with combined analytics.

| Method | Description |
|---|---|
| `get(id, *, range=None)` | Get a bundle with click summary |
| `list(*, archived=None, range=None)` | List bundles |
| `create(*, name, description=None, icon=None, accent=None)` | Create a bundle |
| `update(id, *, name=None, description=None, icon=None, accent=None)` | Update metadata |
| `delete(id)` | Permanently delete |
| `archive(id)` | Hide from default listing |
| `unarchive(id)` | Restore an archived bundle |
| `analytics(id, *, range=None)` | Combined click analytics |
| `links(id)` | List links in the bundle |
| `add_link(id, link_id)` | Add a link |
| `remove_link(id, link_id)` | Remove a link |

```python
# Create a bundle and add links to it
bundle = client.bundles.create(name="Spring 2026", accent="green")
client.bundles.add_link(bundle.id, link_a.id)
client.bundles.add_link(bundle.id, link_b.id)

# Combined analytics for the last 7 days
stats = client.bundles.analytics(bundle.id, range="7d")
print(stats.total_clicks)
```

## Models

All model fields use snake_case, matching the wire format. Types are frozen dataclasses.

Key types exported from `shrtnr`:

- `Link`, `Slug`, `Bundle`, `BundleWithSummary`
- `ClickStats`, `TimelineData`, `NameCount`, `TimelineBucket`, `TimelineSummary`
- `DeletedResult`, `AddedResult`, `RemovedResult`
- `TimelineRange` (`Literal["24h", "7d", "30d", "90d", "1y", "all"]`)
- `BundleAccent` (`Literal["orange", "red", "green", "blue", "purple"]`)

## Errors

Every 4xx/5xx response raises `ShrtnrError`. Network failures also raise `ShrtnrError` with
`status=0`.

```python
from shrtnr import ShrtnrError

try:
    client.links.get(99999)
except ShrtnrError as err:
    print(err.status)         # 404
    print(err.server_message) # "not found"
    print(str(err))           # "shrtnr API error (HTTP 404): not found"
```

## See also

- API docs: `/_/api/docs` on your shrtnr deployment
- OpenAPI spec: `/_/api/openapi.json`
- Source: [github.com/oddbit/shrtnr](https://github.com/oddbit/shrtnr)

## Attribution

`shrtnr` is developed and maintained by **[Oddbit](https://oddbit.id)**.

- Source repository: <https://github.com/oddbit/shrtnr>
- License: [Apache License 2.0](LICENSE)
- Attribution notices: [NOTICE](NOTICE)
- Name and logo usage: [Trademark Policy](TRADEMARK_POLICY.md)

If you publish a fork or derivative work, retain the license and notice files,
preserve applicable copyright and attribution notices, and clearly indicate
that your version has been modified.
