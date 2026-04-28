# Changelog

## 0.2.0

- `get_link_analytics(link_id, *, range=...)` accepts an optional `TimelineRange` keyword. Defaults to all-time when omitted. Use the keyword to scope a query to `"7d"`, `"30d"`, or any other supported window in the same call.
- `get_bundle_analytics(bundle_id, *, range=...)` default changed from `"30d"` to `"all"` so it matches `get_link_analytics` and returns lifetime stats out of the box. Pass `range="30d"` if you depended on the previous default.
- Both methods continue to return raw click counts. The server-side public API does not apply per-identity bot or self-referrer filters, regardless of the API key owner's admin settings, so SDK consumers always get unfiltered data.

## 0.1.0

First release of the Python SDK. Method-for-method parity with the TypeScript SDK.

- Sync `Shrtnr` client built on `httpx.Client` and async `AsyncShrtnr` client built on `httpx.AsyncClient`.
- Full link lifecycle: create, list, get, update, disable, enable, delete, list by owner.
- Slug management: add, disable, enable, remove, lookup by slug.
- Click analytics, QR code SVG, and service health check.
- Bundles: create, list, get, update, delete, archive, unarchive, analytics, membership management, reverse lookup.
- Bearer-token auth matching the TypeScript SDK, plus `X-Client: sdk` header.
- Typed with frozen dataclasses and `Literal` types; `py.typed` marker ships in the wheel.
- Works on Python 3.9 and later.
