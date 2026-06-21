# Issue #23 — Admin widget islands: deferred polish

Design doc. Source: https://github.com/oddbit/shrtnr/issues/23
Scope approved 2026-06-21: all four buckets. `range:changed` → remove. `bumpCacheVersion` → wire now, service layer. top-links slug → widget-local batched fetch. All test edits approved.

## Goal

Clear the punch-list of polish items deferred from PR #21 (admin widget islands). No behavior regressions; restore dashboard parity where it slipped; tighten a11y, hygiene, and cache freshness.

## Bucket 1 — UI / shell polish

### 1a. Remove dead `range:changed` trigger
- `src/admin/widgets/shell.tsx`: drop `"range:changed from:body"` from the `triggers` array; revise the docstring (lines ~18-20) so it no longer claims a body-level range event.
- TEST EDIT (approved): `src/__tests__/admin/widgets/shell.test.tsx:10` — remove `expect(out).toContain("range:changed from:body")`.
- Range switching keeps working via `RangePicker` full-page reload. No new behavior.

### 1b. `.skel-kpi` height
- `src/styles.ts:1322`: `.skel-kpi { min-height: 96px; }` → `144px`.
- Rationale: loaded KPI card is `.bento-card.kpi` = `.kpi` min-height 104px + `.bento-card` padding 1.25rem×2 (~40px) ≈ 144px. Honors the no-collapse goal.

### 1c. `aria-busy` on the persistent slot
- `src/admin/widgets/shell.tsx`: add `aria-busy="true"` to the `.widget-slot` div (initial loading state).
- `src/admin/widgets/skeleton.tsx`: remove `aria-busy` from the skeleton node; keep shimmer + `aria-live`.
- `src/client.ts`: delegated htmx listeners — on `htmx:beforeRequest` set the requesting `.widget-slot`'s `aria-busy="true"`; on `htmx:afterSwap` set `"false"`. Clean true→false announcement on the node that survives the swap.
- TEST EDITS (approved):
  - `src/__tests__/admin/widgets/skeleton.test.tsx:15` — remove the `aria-busy="true"` assertion (attribute moved off the skeleton).
  - `src/__tests__/admin/widgets/shell.test.tsx` — ADD an assertion that the slot carries `aria-busy="true"` (coverage moves with the attribute).

### 1d. Orphaned `dash-*` ids
- `src/admin/widgets/dashboard/kpis.tsx`: drop `id`/`valueId`/`deltaId` values (`dash-kpi-*`, `dash-total-*`, `dash-*-delta`). Orphaned since `pollDashboard` was removed. `KpiCard` props stay optional.
- TEST EDIT (approved): `src/__tests__/admin/widgets/dashboard/kpis.test.tsx:44-45` — replace the `dash-kpi-links` / `dash-total-clicks` assertions with stable markers (KPI label text + `class="kpi-value"`) proving the cards still render.

## Bucket 2 — Hygiene: `copyUrl` sweep

Replace inline `onclick="…copyUrl('${escHtml(slug)}')"` with `data-copy-slug` + a delegated handler (mirrors `data-bundle-action` at `client.ts:1540`).
- Edit call sites: `src/admin/widgets/dashboard/recent-links.tsx:56`, `src/pages/links.tsx:232`, `src/pages/link-detail.tsx:205/211/325`.
- `src/client.ts`: one delegated `click` handler on `[data-copy-slug]` calling `preventDefault()` + `stopPropagation()` (needed for chips inside `<a>`), then `copyUrl(el.dataset.copySlug)`.
- No i18n changes (`title` stays). `escHtml` still used for the `data-*` attribute value (it documents itself as safe for that context).

## Bucket 3 — Data parity

### 3a. top-domains distinct-host count
- `src/db/click-repository.ts`: new `getBreakdownDistinctCount(db, dimension, range, filters)` → `SELECT COUNT(DISTINCT <dimension>)` with the same WHERE/filter as `getGlobalBreakdown` (dimension validated against `VALID_DIMENSIONS`).
- `src/admin/widgets/dashboard/top-domains.tsx`: header count uses the new distinct count; still lists top-5. Update the docstring (drop the "under-reports past 5 hosts by design" caveat). Widget stays at 2 constant queries.

### 3b. top-links primary slug (widget-local, no shared/MCP change)
- `getTrendingLinks` (and the MCP `get_trending_links` tool) stay untouched. It is NOT a REST endpoint, so no spec-hash/SDK impact either way; keeping it untouched also avoids MCP output drift.
- `src/db/link-repository.ts`: new batched `primarySlugByIds(db, ids[])` → one `SELECT link_id, slug, is_custom FROM slugs WHERE link_id IN (…)`, returns `Map<link_id, slug>` picking primary (first non-custom, fallback first) — same rule as `recent-links` `primarySlug`.
- `src/admin/widgets/dashboard/top-links.tsx`: after the trending rows, batch-fetch slugs; render the primary slug (mono) instead of `label || url`. Update the docstring. Stays at 2 constant queries.

## Bucket 4 — Wire `bumpCacheVersion` (admin-api write middleware)

Invalidate the writer's dashboard cache immediately on admin writes instead of waiting out the 30-60s TTL.

**Placement decision (revised at plan time, from "service layer"):** A scoped Hono middleware on `/_/admin/api/*`, mirroring the existing after-`next()` middleware at `src/index.tsx:132-137`.

Why not the service layer (the originally-approved spot): identity is sourced inconsistently there. `createLink` has no `identity` param (uses `body.created_by`), `updateLink` has none at all. Wiring there means signature changes and per-function identity plumbing.

Why the middleware: every admin write funnels through `/_/admin/api/*` (client.ts `API = '/_/admin/api'`), and the `/_/admin/*` auth middleware (`index.tsx:125`) sets `c.var.identity` — the exact identity the widget cache keys on. One block, uniform identity, and it auto-covers every future admin write route (the issue's "lands naturally with the first write-bearing admin page" outcome).

```ts
// After a successful admin-api write, invalidate the writer's widget read
// cache so dashboard fragments reflect the change immediately instead of
// riding out the 30-60s TTL. Reads (GET/HEAD) and failures (status >= 400)
// do not bump. Awaited (not waitUntil) so the version is current before the
// client's follow-up dashboard fetch.
app.use("/_/admin/api/*", async (c, next) => {
  await next();
  if (c.req.method === "GET" || c.req.method === "HEAD") return;
  if (c.res.ok) await bumpCacheVersion(c.env, c.var.identity);
});
```

- Import `bumpCacheVersion` from `./admin/widgets/cache` into `index.tsx`.
- Register after the auth middleware (so `c.var.identity` is set) — placing it next to the line-132 middleware is natural.
- Scope note: this also covers `/_/admin/api/keys` writes, which do not feed any dashboard widget. Bumping there is harmless (one extra cache miss for the writer) and keeps the middleware simple; no dimension-specific carve-out.
- Semantics: cache version is per-identity; dashboard data is global, so bumping the writer's identity refreshes the writer's view immediately; other viewers ride the TTL. Acceptable.
- `bumpCacheVersion`/`getCacheVersion` stay in `src/admin/widgets/cache.ts` (no relocation; no import cycle — `cache.ts` imports only types).

## Testing plan (TDD)

- Each behavior gets a test first. Existing tests only edited where listed above (all approved).
- New/updated tests:
  - `shell.test.tsx`: no `range:changed`; slot has `aria-busy="true"`.
  - `skeleton.test.tsx`: aria-busy assertion removed.
  - `kpis.test.tsx`: stable-marker assertions instead of `dash-*` ids.
  - `click-repository.test.ts`: `getBreakdownDistinctCount` returns exact distinct count past the top-5 cap.
  - `link-repository.test.ts`: `primarySlugByIds` batched, picks primary, single query.
  - `top-links` / `top-domains` widget tests: render slug / exact count; query-count constant.
  - `cache.test.ts`: import path only if primitives move (they will NOT move — kept in `cache.ts`).
  - service tests (link/bundle/settings): `bumpCacheVersion` called on success (assert KV version incremented).
  - `client.ts` delegated copy handler: covered by existing client tests if present; otherwise add a focused test for the `[data-copy-slug]` path.

## Out of scope / non-goals

- The in-place range-switch feature (the reason `range:changed` existed) — explicitly deferred.
- Changing `getTrendingLinks` shared shape or the MCP tool.
- Owner-scoped or global (cross-viewer) cache invalidation — per-identity bump only.

## Commit grouping

One coherent commit per bucket (or per sub-item where cleaner): shell/skeleton/a11y, dash-id cleanup, copyUrl sweep, top-domains count, top-links slug, cache wiring. Tests land with their change.

## Branch

New branch off `main` (current branch `feat/bundles-overview-cards` is unrelated bundle-card work).
