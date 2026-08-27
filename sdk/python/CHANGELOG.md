# Changelog

All notable changes to the SDK are documented in this file.

## 1.1.3 (2026-08-27)

Transport fix. No public surface changes.

- The owned `httpx.Client` and `httpx.AsyncClient` follow redirects. httpx defaults to `follow_redirects=False`, while the TypeScript SDK (`fetch`, default `"follow"`) and the Dart SDK (`http.Client`) both follow a 3xx from a deployment's front door transparently, so the same `base_url` behaved differently depending on which SDK made the request. A caller-supplied `http_client` keeps its own setting.
- Records the spec hash for app 0.38.0. Paths and schemas are unchanged; only `info.version` moved.

## 1.1.2 (2026-08-10)

Error-handling fix. No public surface changes.

- An empty body served with a non-204 2xx raises `ShrtnrError(status, "Empty response body")`. This is the same "truncated body served with a 200" case the invalid-JSON guard covers, for instance a proxy that strips the body off some 2xx responses. Returning `None` only deferred the failure to the resource method's `SomeModel.from_dict(...)`, which reported it as a bare `AttributeError` and slipped past `except ShrtnrError` handling. A 204 still returns `None`. The Dart SDK carries the same fix in 2.1.2; TypeScript reaches the same outcome through its JSON-parse guard.
- Documentation: the `Key types` list names the types added since it was written (`BundleTopLink`, `DateCount`, `SlugCount`, `BreakdownDimension`, `BreakdownPage`).
- Records the spec hash for app 0.37.1. Paths and schemas are unchanged; only `info.version` moved.

## 1.1.1 (2026-07-28)

- A 2xx response whose body is not valid JSON now raises `ShrtnrError(status)`. Previously `response.json()` raised a bare `JSONDecodeError`, so an HTML error page or a truncated body served with a 200 escaped the SDK's error type. The TypeScript and Dart SDKs carry the same fix in 1.1.1 and 2.1.1.
- `links.qr()` now takes `size` as an `int` instead of a `str`, matching the API schema (which validates an integer) and the TypeScript and Dart SDKs. Callers who passed an int already got the correct behavior; the annotation was the only thing out of step.

## 1.1.0 (2026-06-19)

- Add `links.breakdown` and `bundles.breakdown` (sync and async) for paging through the countries, sources and domains analytics panels (offset/limit, returns items + total).

## 1.0.2 (2026-05-07)

- `links.update()` and `bundles.update()` can now distinguish "omit this field" from "set this field to null". Optional nullable params (`label`, `expires_at`, `description`, `icon`) default to a private `UNSET` sentinel; only keys explicitly provided by the caller are included in the request body. Pass `None` to clear a value, omit the param to leave the server-side value untouched. Sync and async resources both updated; regression tests cover both clients.

## 1.0.1 (2026-04-30)

Packaging, documentation, and CI hygiene. No public surface changes.

- Ship `NOTICE` and `TRADEMARK_POLICY.md` in the wheel and sdist alongside the existing `LICENSE`. Consumers running license scanners now see Oddbit's trademark policy without having to clone the repo.
- README polish: dropped the "Migrating from 0.x" section and replaced "License" with an "Attribution" section that points at the same files.
- Internal: tightened return-type annotations on resource list methods so `mypy --strict` passes; aligned the e2e test fixture loop scope with `pytest-asyncio`'s current default; cleared the remaining `ruff` warnings so CI runs clean. None of these change runtime behavior.

## 1.0.0 (2026-04-29)

Ground-up rewrite derived from the OpenAPI spec. This is a deliberate breaking release.

### Breaking changes

**Resource-grouped client.** All methods now live under `client.links`, `client.slugs`, or
`client.bundles`. Flat methods on the top-level client are gone.

```python
# 0.x
client.create_link(CreateLinkOptions(url="..."))
client.archive_bundle(42)

# 1.0
client.links.create(url="...")
client.bundles.archive(42)
```

**Constructor shape.** The positional `base_url` argument is replaced by a keyword-only `base_url`
parameter. `api_key` remains keyword-only.

```python
# 0.x
Shrtnr("https://s.example.com", api_key="sk_...")

# 1.0
Shrtnr(base_url="https://s.example.com", api_key="sk_...")
```

**`ShrtnrError` shape.** The `body` field is removed. Use `server_message` (the `error` string
from the JSON response). The `str()` representation formats as
`"shrtnr API error (HTTP {status}): {server_message}"`.

**Result types.** `delete`, `add_link`, and `remove_link` return typed dataclasses
(`DeletedResult`, `AddedResult`, `RemovedResult`) instead of bare `bool`. Access
`.deleted`, `.added`, or `.removed`.

**`ClickStats` expanded.** New fields from the spec: `referrer_hosts`, `link_modes`, `channels`,
`num_countries`, `num_referrers`, `num_referrer_hosts`, `num_os`, `num_browsers`.

**`Link` gains `delta_pct?`:** click count change percentage versus the previous period.

**`BundleWithSummary` is flat.** Fields are directly on the object instead of nested under a
`bundle` attribute.

**`bundles.list` `archived` parameter** is now the raw spec enum string (`"all"`, `"only"`,
`"1"`, `"true"`) instead of a Python `bool`.

**`health()` removed.** The `/_/health` endpoint is outside the public API spec.

**`X-Client: sdk` header removed.** The 1.0 HTTP layer sends only `Authorization: Bearer ...`.

### New surface

- `client.links`: `get`, `list`, `create`, `update`, `disable`, `enable`, `delete`,
  `analytics`, `timeline`, `qr`, `bundles`
- `client.slugs`: `lookup`, `add`, `disable`, `enable`, `remove`
- `client.bundles`: `get`, `list`, `create`, `update`, `delete`, `archive`, `unarchive`,
  `analytics`, `links`, `add_link`, `remove_link`
- `AsyncShrtnr` mirrors all methods with `async/await`.

See the README for the full method table and migration guide.

### 1.0 post-release fixes (SDK review)

**`Bundle.accent` is now required at parse time.** `Bundle.from_dict` and
`BundleWithSummary.from_dict` previously used `data.get("accent", "orange")`,
masking a missing field. They now use `data["accent"]`, raising `KeyError` if the
field is absent so the problem surfaces immediately.

**`bundles.list(archived=...)` tightened to `Literal["true","1","only","all"]`**
(was `str`), matching the TypeScript union type and completing cross-SDK parity.

**Model names confirmed canonical.** `DateCount`, `SlugCount`, `BundleTopLink`,
`DeletedResult`, `AddedResult`, `RemovedResult` are the reference names adopted by
all three SDKs.

---

## 0.2.0

- `get_link_analytics(link_id, *, range=...)` accepts an optional `TimelineRange` keyword.
  Defaults to all-time when omitted.
- `get_bundle_analytics(bundle_id, *, range=...)` default changed from `"30d"` to `"all"`.

## 0.1.0

First release of the Python SDK. Method-for-method parity with the TypeScript SDK.

- Sync `Shrtnr` client built on `httpx.Client` and async `AsyncShrtnr` client built on
  `httpx.AsyncClient`.
- Full link lifecycle: create, list, get, update, disable, enable, delete, list by owner.
- Slug management: add, disable, enable, remove, lookup by slug.
- Click analytics, QR code SVG, and service health check.
- Bundles: create, list, get, update, delete, archive, unarchive, analytics, membership
  management, reverse lookup.
- Bearer-token auth matching the TypeScript SDK, plus `X-Client: sdk` header.
- Typed with frozen dataclasses and `Literal` types; `py.typed` marker ships in the wheel.
- Works on Python 3.9 and later.
