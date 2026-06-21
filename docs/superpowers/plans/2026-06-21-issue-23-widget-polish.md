# Issue #23 — Widget-islands deferred polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this plan — tasks share files: shell.tsx in T1/T2, client.ts in T2/T5) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Clear the eight polish items deferred from PR #21 (admin widget islands): dead trigger, skeleton height, a11y busy-state, orphaned ids, copyUrl hygiene, two data-parity gaps, and write-path cache invalidation.

**Architecture:** Hono + hono/jsx SSR fragments served as htmx islands. Widgets live in `src/admin/widgets/`; data in `src/db/*-repository.ts`; admin writes funnel through `/_/admin/api/*` in `src/index.tsx`. Tests are vitest on `@cloudflare/vitest-pool-workers` (`cloudflare:test` env with `DB` + `SLUG_KV`).

**Tech Stack:** TypeScript, Hono, hono/jsx, htmx, D1 (SQLite), Workers KV, vitest.

## Global Constraints

- Test runner: `yarn test` (= `vitest run`); filter one file with `yarn test <path-substring>`.
- Testing rule (CLAUDE.md): never weaken/remove a test to accommodate code. The three test edits in T1/T2/T4 are pre-approved exceptions (user-authorized 2026-06-21). Adding assertions is always allowed.
- i18n: no new user-facing strings in this work (no `t()` keys added).
- No spec-hash/SDK impact: no changes to `src/api/router.ts`, `src/api/schemas.ts`, resource sub-apps, or `getTrendingLinks`. CI `sdk-spec-drift` stays green; no SDK regen.
- Writing rules: no em dashes, active voice, specific words.
- One commit per task (logically grouped). No Co-Authored-By lines. Never force push.

---

### Task 1: Remove dead `range:changed` trigger

**Files:**
- Modify: `src/admin/widgets/shell.tsx:38-40` (triggers array) and docstring `:18-20`
- Test: `src/__tests__/admin/widgets/shell.test.tsx:10`

- [ ] **Step 1: Flip the test assertion**

In `src/__tests__/admin/widgets/shell.test.tsx`, change line 10 from:
```ts
    expect(out).toContain("range:changed from:body");
```
to:
```ts
    expect(out).not.toContain("range:changed");
```

- [ ] **Step 2: Run the test, expect failure**

Run: `yarn test shell.test`
Expected: FAIL — the timeline test still finds `range:changed from:body` in the output.

- [ ] **Step 3: Remove the trigger and fix the docstring**

In `src/admin/widgets/shell.tsx`, replace the triggers line (38-40):
```ts
  const triggers = ["load", "range:changed from:body", poll ? "every 30s" : ""]
    .filter(Boolean)
    .join(", ");
```
with:
```ts
  const triggers = ["load", poll ? "every 30s" : ""].filter(Boolean).join(", ");
```
Replace docstring lines 18-20:
```
 * The hx-trigger fires on load and on the body-level range:changed event. Range
 * value propagation (hx-vals) is wired separately; this shell emits only the
 * static trigger. A poll prop adds a 30s refresh for live shapes.
```
with:
```
 * The hx-trigger fires on load. A poll prop adds a 30s refresh for live shapes.
 * Range switching reloads the whole dashboard via RangePicker, so no body-level
 * range event is wired here.
```

- [ ] **Step 4: Run the test, expect pass**

Run: `yarn test shell.test`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/admin/widgets/shell.tsx src/__tests__/admin/widgets/shell.test.tsx
git commit -m "fix: drop dead range:changed widget trigger

Nothing dispatches a body-level range:changed event; range switching
runs through the RangePicker full-page reload. Remove the inert trigger
and its test assertion. Re #23."
```

---

### Task 2: Move `aria-busy` to the persistent widget slot

**Files:**
- Modify: `src/admin/widgets/shell.tsx` (add `aria-busy="true"` to the slot div)
- Modify: `src/admin/widgets/skeleton.tsx:22` (drop `aria-busy`)
- Modify: `src/client.ts` (htmx event listeners, appended near the existing delegated handlers)
- Test: `src/__tests__/admin/widgets/shell.test.tsx` (add slot assertion), `src/__tests__/admin/widgets/skeleton.test.tsx:15` (remove skeleton assertion)

**Interfaces:**
- Consumes: the `.widget-slot` div from `shell.tsx` (the htmx target that survives swaps).
- Produces: a slot that carries `aria-busy` toggled true→false across htmx swaps.

- [ ] **Step 1: Add the slot assertion to shell.test.tsx**

In the first test (`emits hx-get…`), after the `widget-slot` assertion, add:
```ts
    expect(out).toContain('aria-busy="true"'); // busy-state lives on the persistent slot
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test shell.test`
Expected: FAIL — the slot div has no `aria-busy` yet.

- [ ] **Step 3: Add aria-busy to the slot**

In `src/admin/widgets/shell.tsx`, add `aria-busy="true"` to the returned `<div>` (alongside `hx-indicator="this"`):
```tsx
    <div
      class={container}
      hx-get={url}
      hx-trigger={triggers}
      hx-target="this"
      hx-swap="innerHTML"
      hx-indicator="this"
      aria-busy="true"
    >
      <Skeleton shape={shape} />
    </div>
```

- [ ] **Step 4: Run, expect pass**

Run: `yarn test shell.test`
Expected: PASS.

- [ ] **Step 5: Remove aria-busy from the skeleton test**

In `src/__tests__/admin/widgets/skeleton.test.tsx`, delete line 15:
```ts
    expect(out).toContain('aria-busy="true"');
```

- [ ] **Step 6: Drop aria-busy from the skeleton node**

In `src/admin/widgets/skeleton.tsx:22`, change:
```tsx
    <div class={`widget-skeleton skel-${shape}`} aria-busy="true" aria-live="polite">
```
to:
```tsx
    <div class={`widget-skeleton skel-${shape}`} aria-live="polite">
```
Update the comment at `:16-18` to say the persistent slot (not the skeleton) announces busy:
```
// Reserves a widget's footprint and shimmers while htmx swaps in the real
// markup. The persistent .widget-slot owns aria-busy (toggled across htmx
// events in client.ts); this node only reserves space and shimmers.
```

- [ ] **Step 7: Run skeleton test, expect pass**

Run: `yarn test skeleton.test`
Expected: PASS (both tests).

- [ ] **Step 8: Wire the htmx toggle in client.ts**

Append to the end of the client script in `src/client.ts` (after the existing delegated handler near line 1550, before the closing backtick):
```js

// Toggle aria-busy on the persistent widget slot across htmx swaps so screen
// readers get a clean true->false "done loading" transition. The skeleton node
// no longer carries aria-busy (htmx removes it on swap, which is not announced).
document.body.addEventListener('htmx:beforeRequest', function(ev) {
  var slot = ev.target && ev.target.closest ? ev.target.closest('.widget-slot') : null;
  if (slot) slot.setAttribute('aria-busy', 'true');
});
document.body.addEventListener('htmx:afterSwap', function(ev) {
  var slot = ev.target && ev.target.closest ? ev.target.closest('.widget-slot') : null;
  if (slot) slot.setAttribute('aria-busy', 'false');
});
```

- [ ] **Step 9: Run the full suite, expect pass**

Run: `yarn test`
Expected: PASS (the client.ts JS toggle is browser behavior, verified manually in the final verification step).

- [ ] **Step 10: Commit**

```bash
git add src/admin/widgets/shell.tsx src/admin/widgets/skeleton.tsx src/client.ts src/__tests__/admin/widgets/shell.test.tsx src/__tests__/admin/widgets/skeleton.test.tsx
git commit -m "fix: announce widget loading on the persistent slot

aria-busy lived on the skeleton, which htmx removes on swap, so the busy
state cleared by node-removal rather than a clean true->false. Move it to
the persistent .widget-slot and toggle it on htmx events. Re #23."
```

---

### Task 3: Calibrate `.skel-kpi` reserved height

**Files:**
- Modify: `src/styles.ts:1322`
- Test: Create `src/__tests__/unit/skel-kpi-height.test.ts`

**Interfaces:**
- Consumes: the exported CSS string `adminStyles` from `src/styles.ts`.

- [ ] **Step 1: Write the guard test**

Create `src/__tests__/unit/skel-kpi-height.test.ts`:
```ts
// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { adminStyles } from "../../styles";

describe("skel-kpi reserved height", () => {
  // The loaded KPI card is .bento-card.kpi: .kpi min-height 104px + bento-card
  // padding 1.25rem x2 (~40px) = ~144px. The skeleton must reserve the same so
  // the KPI row does not shift down when the real strip swaps in.
  it("reserves the loaded KPI strip height, not the old 96px", () => {
    expect(adminStyles).toContain(".skel-kpi { min-height: 144px; }");
    expect(adminStyles).not.toContain(".skel-kpi { min-height: 96px; }");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test skel-kpi-height`
Expected: FAIL — styles still say 96px.

- [ ] **Step 3: Update the value**

In `src/styles.ts:1322`, change:
```
.skel-kpi { min-height: 96px; }
```
to:
```
.skel-kpi { min-height: 144px; }
```

- [ ] **Step 4: Run, expect pass**

Run: `yarn test skel-kpi-height`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.ts src/__tests__/unit/skel-kpi-height.test.ts
git commit -m "fix: reserve true KPI-strip height in the skeleton

.skel-kpi reserved 96px but the loaded strip is ~144px (.kpi 104px +
bento-card padding), so the row shifted down on load. Calibrate to 144px
to honor the no-collapse goal. Re #23."
```

---

### Task 4: Remove orphaned `dash-*` ids

**Files:**
- Modify: `src/admin/widgets/dashboard/kpis.tsx` (drop `id`/`valueId`/`deltaId` on all four KpiCards)
- Test: `src/__tests__/admin/widgets/dashboard/kpis.test.tsx:44-45`

- [ ] **Step 1: Swap the id assertions for stable markers**

In `src/__tests__/admin/widgets/dashboard/kpis.test.tsx`, replace lines 44-45:
```ts
    expect(out).toContain("dash-kpi-links");
    expect(out).toContain("dash-total-clicks");
```
with:
```ts
    // The dash-* ids were hooks for the removed pollDashboard and are gone.
    // Assert the cards rendered via stable markers instead.
    expect(out).toContain("dashboard.totalLinks");
    expect(out).toContain("dashboard.totalClicks");
    expect((out.match(/class="bento-card kpi/g) ?? []).length).toBe(4);
    expect(out).not.toContain("dash-");
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test kpis.test`
Expected: FAIL — `dash-` still present (the ids are still on the cards).

- [ ] **Step 3: Drop the ids in kpis.tsx**

In `src/admin/widgets/dashboard/kpis.tsx`, remove `id`, `valueId`, and `deltaId` props from all four `<KpiCard>` usages. Each card keeps `icon`, `label`, `value`, `deltaPct`, `lang`, `sparkline`. Example for the first card:
```tsx
        <KpiCard
          icon="link"
          label={t("dashboard.totalLinks")}
          value={fmtNumber(d.total_links, lang)}
          deltaPct={d.new_links_delta}
          lang={lang}
          sparkline={d.timeline_links}
        />
```
Apply the same removal (`id="dash-kpi-*"`, `valueId="dash-*"`, `deltaId="dash-*-delta"`) to the clicked-links, clicks, and clicks-per-day cards.

- [ ] **Step 4: Run, expect pass**

Run: `yarn test kpis.test`
Expected: PASS (both tests; query-count test unaffected).

- [ ] **Step 5: Confirm no stray references**

Run: `grep -rn "dash-kpi\|dash-total\|dash-clicked\|dash-clicks\|dash-links-delta" src/`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add src/admin/widgets/dashboard/kpis.tsx src/__tests__/admin/widgets/dashboard/kpis.test.tsx
git commit -m "chore: drop orphaned dash-* KPI ids

These ids were hooks for the removed pollDashboard and are unused. Remove
them; the kpi test now asserts stable render markers. Re #23."
```

---

### Task 5: Sweep `copyUrl` inline onclick to `data-copy-slug`

**Files:**
- Modify: `src/admin/widgets/dashboard/recent-links.tsx:54-61` (+ drop now-unused `escHtml` import line 6)
- Modify: `src/pages/links.tsx:232` (+ drop now-unused `escHtml` import line 9)
- Modify: `src/pages/link-detail.tsx:205,211,325` (keep `escHtml` import — still used elsewhere)
- Modify: `src/client.ts` (delegated `[data-copy-slug]` handler)
- Test: `src/__tests__/admin/widgets/dashboard/recent-links.test.tsx` (add a test)

**Interfaces:**
- Produces: elements tagged `data-copy-slug="<slug>"`; a single delegated click handler copies the short URL.

- [ ] **Step 1: Write the failing widget test**

In `src/__tests__/admin/widgets/dashboard/recent-links.test.tsx`, add inside the describe block:
```ts
  it("exposes the copy chip via data-copy-slug, not an inline onclick", async () => {
    await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    const data = await recentLinksWidget.load(env, ctx, { range: "all" });
    const out = String(recentLinksWidget.render(data, ctx));
    expect(out).toContain('data-copy-slug="abc"');
    expect(out).not.toContain("copyUrl(");
    expect(out).not.toContain("onclick");
  });
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test recent-links.test`
Expected: FAIL — output still has the inline `onclick="…copyUrl('abc')"`.

- [ ] **Step 3: Convert the recent-links chip**

In `src/admin/widgets/dashboard/recent-links.tsx`, change the chip (lines 54-61) from:
```tsx
                <span
                  class="slug-chip"
                  onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(slug)}')`}
                  title={t("dashboard.clickToCopy")}
                >
```
to:
```tsx
                <span
                  class="slug-chip"
                  data-copy-slug={slug}
                  title={t("dashboard.clickToCopy")}
                >
```
Then remove the now-unused import at line 6 (`import { escHtml } from "../../../escape";`).

- [ ] **Step 4: Convert the links.tsx chip**

In `src/pages/links.tsx:232`, change:
```tsx
                              onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(mainSlug.slug)}')`}
```
to:
```tsx
                              data-copy-slug={mainSlug.slug}
```
Then remove the now-unused import at line 9 (`import { escHtml } from "../escape";`) — it is referenced only at line 232.

- [ ] **Step 5: Convert the three link-detail.tsx sites**

In `src/pages/link-detail.tsx`, change each `copyUrl` onclick to a data attribute (keep the `escHtml` import — it is still used by other onclick handlers in this file):
- Line 205: `onclick={`copyUrl('${escHtml(displaySlug)}')`}` → `data-copy-slug={displaySlug}`
- Line 211: `onclick={`copyUrl('${escHtml(displaySlug)}')`}` → `data-copy-slug={displaySlug}`
- Line 325: `onclick={`copyUrl('${escHtml(s.slug)}')`}` → `data-copy-slug={s.slug}`

- [ ] **Step 6: Add the delegated handler in client.ts**

Append to the end of the client script in `src/client.ts` (with the other delegated handlers added in Task 2):
```js

// Copy a link's short URL when any element tagged data-copy-slug is clicked.
// Reading from dataset avoids interpolating the slug into an inline onclick
// JS-string (insufficiently escaped per src/escape.ts). preventDefault +
// stopPropagation keep a chip click inside a row anchor from also navigating.
document.addEventListener('click', function(ev) {
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-copy-slug]') : null;
  if (!el) return;
  ev.preventDefault();
  ev.stopPropagation();
  copyUrl(el.getAttribute('data-copy-slug'));
});
```

- [ ] **Step 7: Run the widget test, expect pass**

Run: `yarn test recent-links.test`
Expected: PASS.

- [ ] **Step 8: Run page suites + confirm no stray copyUrl onclick**

Run: `yarn test links-page link-detail-page`
Expected: PASS.
Run: `grep -rn "copyUrl(" src/pages src/admin`
Expected: no matches (all moved to data-copy-slug; client.ts retains the `copyUrl` function definition + the delegated handler call).

- [ ] **Step 9: Commit**

```bash
git add src/admin/widgets/dashboard/recent-links.tsx src/pages/links.tsx src/pages/link-detail.tsx src/client.ts src/__tests__/admin/widgets/dashboard/recent-links.test.tsx
git commit -m "refactor: copy slugs via data-* and a delegated handler

Inline onclick interpolated a slug into a JS-string, the context escape.ts
documents escHtml as insufficient for (inert today, slugs are charset-
validated). Replace every copyUrl onclick with data-copy-slug + one
delegated click handler. Re #23."
```

---

### Task 6: top-domains exact distinct-host count

**Files:**
- Modify: `src/db/click-repository.ts` (add `getBreakdownDistinctCount` after `getGlobalBreakdown`, ~line 364)
- Test: `src/__tests__/repository/click-repository.test.ts` (add a test)
- Modify: `src/admin/widgets/dashboard/top-domains.tsx` (use the count; update docstring)
- Test: `src/__tests__/admin/widgets/dashboard/top-domains.test.tsx` (add a test)

**Interfaces:**
- Produces: `ClickRepository.getBreakdownDistinctCount(db, dimension, range, filters?) => Promise<number>`.

- [ ] **Step 1: Write the repository test**

In `src/__tests__/repository/click-repository.test.ts`, add a test (match the file's existing imports/setup):
```ts
  it("getBreakdownDistinctCount counts distinct values past any list cap", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    for (let i = 0; i < 7; i++) {
      await ClickRepository.record(env.DB, link.slugs[0].slug, { referrerHost: `h${i}.com` });
    }
    const n = await ClickRepository.getBreakdownDistinctCount(env.DB, "referrer_host", "all");
    expect(n).toBe(7);
  });
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test click-repository.test`
Expected: FAIL — `getBreakdownDistinctCount is not a function`.

- [ ] **Step 3: Implement the method**

In `src/db/click-repository.ts`, add after `getGlobalBreakdown` (after line 364):
```ts
  static async getBreakdownDistinctCount(
    db: D1Database,
    dimension: BreakdownDimension,
    range: TimelineRange,
    filters?: ClickFilters,
  ): Promise<number> {
    if (!VALID_DIMENSIONS.has(dimension)) return 0;

    let where = `${dimension} IS NOT NULL`;
    const binds: number[] = [];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      where += " AND clicked_at >= ?";
      binds.push(now - (seconds[range] ?? 0));
    }

    where += clickFilterSql(filters);

    const row = await db
      .prepare(`SELECT COUNT(DISTINCT ${dimension}) as n FROM clicks WHERE ${where}`)
      .bind(...binds)
      .first<{ n: number }>();

    return row?.n ?? 0;
  }
```

- [ ] **Step 4: Run, expect pass**

Run: `yarn test click-repository.test`
Expected: PASS.

- [ ] **Step 5: Write the widget parity test**

In `src/__tests__/admin/widgets/dashboard/top-domains.test.tsx`, add:
```ts
  it("counts distinct hosts exactly while listing only the top five", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    for (let i = 0; i < 7; i++) {
      await ClickRepository.record(env.DB, link.slugs[0].slug, { referrerHost: `h${i}.com` });
    }
    const data = await topDomainsWidget.load(env, ctx, { range: "all" });
    expect(data.num).toBe(7); // exact distinct count, not the 5-row cap
    expect(data.rows.length).toBe(5);
    const out = String(topDomainsWidget.render(data, ctx));
    expect((out.match(/stat-row/g) ?? []).length).toBe(5);
  });
```

- [ ] **Step 6: Run, expect failure**

Run: `yarn test top-domains.test`
Expected: FAIL — `data.num` is 5 (capped by `rows.length`).

- [ ] **Step 7: Wire the count into the loader**

In `src/admin/widgets/dashboard/top-domains.tsx`, replace the `load` body:
```ts
  async load(env: Env, ctx, { range }): Promise<TopDomainsData> {
    const rows = await ClickRepository.getGlobalBreakdown(env.DB, "referrer_host", range, 5, ctx.filters);
    return { range, rows, num: rows.length };
  },
```
with:
```ts
  async load(env: Env, ctx, { range }): Promise<TopDomainsData> {
    const [rows, num] = await Promise.all([
      ClickRepository.getGlobalBreakdown(env.DB, "referrer_host", range, 5, ctx.filters),
      ClickRepository.getBreakdownDistinctCount(env.DB, "referrer_host", range, ctx.filters),
    ]);
    return { range, rows, num };
  },
```
Update the docstring (lines ~16-24) to drop the "under-reports past five hosts by design" caveat:
```
 * Top-domains panel widget: renders the dashboard referrer-host breakdown for
 * the selected range. Lists the top five hosts and shows the exact distinct
 * host count in the header (a dedicated COUNT(DISTINCT) query), so the count
 * stays accurate past the five-row cap. Two grouped queries, both constant as
 * the click table grows. Emits the panel's inner content only; the htmx
 * placeholder owns the surrounding bento-card.
```

- [ ] **Step 8: Run widget test, expect pass**

Run: `yarn test top-domains.test`
Expected: PASS (all three tests).

- [ ] **Step 9: Commit**

```bash
git add src/db/click-repository.ts src/admin/widgets/dashboard/top-domains.tsx src/__tests__/repository/click-repository.test.ts src/__tests__/admin/widgets/dashboard/top-domains.test.tsx
git commit -m "fix: count distinct referrer hosts exactly on the dashboard

The top-domains header reused the top-5 row count, under-reporting past a
sixth host. Add a dedicated COUNT(DISTINCT) query for an exact header count
while still listing the top five. Re #23."
```

---

### Task 7: top-links names rows by primary slug

**Files:**
- Modify: `src/db/link-repository.ts` (add `primarySlugByIds` after `findByOwner`, ~line 280)
- Test: `src/__tests__/repository/link-repository.test.ts` (add tests)
- Modify: `src/admin/widgets/dashboard/top-links.tsx` (fetch slugs; render slug; update docstring)
- Test: `src/__tests__/admin/widgets/dashboard/top-links.test.tsx` (add a test)

**Interfaces:**
- Produces: `LinkRepository.primarySlugByIds(db, ids: number[]) => Promise<Map<number, string>>` — primary slug per id (first non-custom, fallback first), mirroring `recent-links` and the repo's `is_custom ASC, created_at ASC` slug order.
- `TopLinksData.rows[]` gains `slug: string`.

- [ ] **Step 1: Write the repository tests**

In `src/__tests__/repository/link-repository.test.ts`, add:
```ts
  it("primarySlugByIds picks the auto slug over a custom one, batched", async () => {
    const a = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "auto-a" });
    await env.DB
      .prepare("INSERT INTO slugs (link_id, slug, is_custom, is_primary, created_at) VALUES (?, ?, 1, 0, ?)")
      .bind(a.id, "custom-a", 2000)
      .run();
    const b = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "auto-b" });

    const map = await LinkRepository.primarySlugByIds(env.DB, [a.id, b.id]);
    expect(map.get(a.id)).toBe("auto-a"); // non-custom wins
    expect(map.get(b.id)).toBe("auto-b");
  });

  it("primarySlugByIds returns an empty map for no ids", async () => {
    const map = await LinkRepository.primarySlugByIds(env.DB, []);
    expect(map.size).toBe(0);
  });
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test link-repository.test`
Expected: FAIL — `primarySlugByIds is not a function`.

- [ ] **Step 3: Implement the method**

In `src/db/link-repository.ts`, add after `findByOwner` (after line ~280, inside the class):
```ts
  /**
   * Batch-resolve the display slug for a set of link ids in one query. Picks
   * the primary slug per link the way the dashboard does: the first
   * auto-generated (non-custom) slug, falling back to the first slug of any
   * kind. Mirrors the `is_custom ASC, created_at ASC` ordering the slug loaders
   * use, so the pick matches recent-links exactly. Returns a Map keyed by
   * link_id; ids with no slug are absent.
   */
  static async primarySlugByIds(db: D1Database, ids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT link_id, slug FROM slugs WHERE link_id IN (${placeholders})
         ORDER BY is_custom ASC, created_at ASC`,
      )
      .bind(...ids)
      .all<{ link_id: number; slug: string }>();
    for (const r of rows.results ?? []) {
      if (!out.has(r.link_id)) out.set(r.link_id, r.slug); // first per link = primary
    }
    return out;
  }
```

- [ ] **Step 4: Run, expect pass**

Run: `yarn test link-repository.test`
Expected: PASS.

- [ ] **Step 5: Write the widget test**

In `src/__tests__/admin/widgets/dashboard/top-links.test.tsx`, add:
```ts
  it("names each row by its primary slug, not label or url", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "primo", label: "My Label" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {});
    const data = await topLinksWidget.load(env, ctx, { range: "all" });
    expect(data.rows[0].slug).toBe("primo");
    const out = String(topLinksWidget.render(data, ctx));
    expect(out).toContain("primo"); // primary slug shown, matching the page
  });
```

- [ ] **Step 6: Run, expect failure**

Run: `yarn test top-links.test`
Expected: FAIL — `rows[0].slug` is undefined (loader does not fetch slugs yet).

- [ ] **Step 7: Fetch slugs and render them**

In `src/admin/widgets/dashboard/top-links.tsx`:

Add the import (after the `ClickRepository` import):
```ts
import { ClickRepository, LinkRepository } from "../../../db";
```
(adjust the existing `import { ClickRepository } from "../../../db";` to include `LinkRepository`.)

Extend the interface:
```ts
interface TopLinksData {
  range: TimelineRange;
  rows: { link_id: number; clicks: number; url: string; label: string | null; slug: string }[];
}
```
Replace the `load` body:
```ts
  async load(env: Env, ctx, { range }): Promise<TopLinksData> {
    const trending = await ClickRepository.getTrendingLinks(env.DB, range, 5, ctx.filters);
    const slugs = await LinkRepository.primarySlugByIds(env.DB, trending.map((r) => r.link_id));
    const rows = trending.map((r) => ({ ...r, slug: slugs.get(r.link_id) ?? "" }));
    return { range, rows };
  },
```
In `render`, change the name span (line 47) from:
```tsx
                    <span class="label">{link.label || link.url}</span>
```
to:
```tsx
                    <span class="label">{link.slug || link.label || link.url}</span>
```
Update the docstring (lines ~14-22) to:
```
 * Most-clicked panel widget: renders the top five links by clicks for the
 * selected range. getTrendingLinks (one grouped query) returns no slug, so the
 * loader batch-fetches the primary slug for those link ids in a second bounded
 * query (LinkRepository.primarySlugByIds) and names each row by its slug, the
 * way the full dashboard page does. Two queries, both constant as the click
 * table grows. Emits the panel's inner content only; the htmx placeholder owns
 * the surrounding bento-card.
```

- [ ] **Step 8: Run widget test, expect pass**

Run: `yarn test top-links.test`
Expected: PASS (all tests; existing "renders the most-clicked rows" test seeds slug `abc` and still passes).

- [ ] **Step 9: Commit**

```bash
git add src/db/link-repository.ts src/admin/widgets/dashboard/top-links.tsx src/__tests__/repository/link-repository.test.ts src/__tests__/admin/widgets/dashboard/top-links.test.tsx
git commit -m "fix: show primary slug in the most-clicked panel

getTrendingLinks returns no slug, so rows named links by label||url instead
of the primary slug the full dashboard shows. Batch-fetch primary slugs for
the trending ids (one bounded query) and render them. getTrendingLinks and
its MCP tool are untouched. Re #23."
```

---

### Task 8: Invalidate the writer's widget cache on admin writes

**Files:**
- Modify: `src/index.tsx` (import `bumpCacheVersion`; add a middleware next to the existing `/_/admin/*` post-response middleware ~line 137)
- Test: Create `src/__tests__/admin/widgets/cache-invalidation.test.ts`

**Interfaces:**
- Consumes: `bumpCacheVersion(env, identity)` and `getCacheVersion(env, identity)` from `src/admin/widgets/cache.ts`; `c.var.identity` set by the `/_/admin/*` auth middleware (dev identity `dev@local` in tests).

- [ ] **Step 1: Write the integration test**

Create `src/__tests__/admin/widgets/cache-invalidation.test.ts`:
```ts
// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../setup";
import { getCacheVersion } from "../../../admin/widgets/cache";
import worker from "../../../index";

beforeAll(applyMigrations);
beforeEach(resetData);

// Dev mode (no ACCESS_AUD) resolves identity to "dev@local" — see route.test.ts.
const IDENTITY = "dev@local";

async function req(path: string, init?: RequestInit) {
  return worker.fetch(new Request("https://x.test" + path, init), env as never, {
    waitUntil() {},
    passThroughOnException() {},
  } as never);
}

describe("admin-api write cache invalidation", () => {
  it("bumps the writer's cache version on a successful write", async () => {
    const before = await getCacheVersion(env as never, IDENTITY);
    const res = await req("/_/admin/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res.ok).toBe(true);
    const after = await getCacheVersion(env as never, IDENTITY);
    expect(after).toBe(before + 1);
  });

  it("does not bump on a failed write", async () => {
    const before = await getCacheVersion(env as never, IDENTITY);
    const res = await req("/_/admin/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // missing url => 400
    });
    expect(res.status).toBe(400);
    const after = await getCacheVersion(env as never, IDENTITY);
    expect(after).toBe(before);
  });

  it("does not bump on a GET read", async () => {
    const before = await getCacheVersion(env as never, IDENTITY);
    await req("/_/admin/api/links");
    const after = await getCacheVersion(env as never, IDENTITY);
    expect(after).toBe(before);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `yarn test cache-invalidation`
Expected: FAIL — the successful-write case finds `after === before` (no bump wired yet).

- [ ] **Step 3: Add the import**

In `src/index.tsx`, add to the widget-cache import area (near the top with the other `./admin/widgets/*` imports):
```ts
import { bumpCacheVersion } from "./admin/widgets/cache";
```

- [ ] **Step 4: Add the middleware**

In `src/index.tsx`, immediately after the existing `/_/admin/*` HTML cache-control middleware (the block ending around line 137), add:
```ts
// After a successful admin-api write, invalidate the writer's widget read
// cache so dashboard fragments reflect the change immediately instead of
// riding out the 30-60s TTL. GET/HEAD and failures (status >= 400) skip it.
// Awaited (not waitUntil) so the version is current before the client's
// follow-up dashboard fetch. Covers every current and future admin write
// route, including keys (harmless: keys feed no widget).
app.use("/_/admin/api/*", async (c, next) => {
  await next();
  if (c.req.method === "GET" || c.req.method === "HEAD") return;
  if (c.res.ok) await bumpCacheVersion(c.env, c.var.identity);
});
```

- [ ] **Step 5: Run, expect pass**

Run: `yarn test cache-invalidation`
Expected: PASS (all three).

- [ ] **Step 6: Commit**

```bash
git add src/index.tsx src/__tests__/admin/widgets/cache-invalidation.test.ts
git commit -m "feat: invalidate widget cache on admin writes

bumpCacheVersion was implemented but never called (the dashboard is
read-only). Add a /_/admin/api/* middleware that bumps the writer's cache
version after any successful non-GET, so link/bundle/settings changes show
immediately instead of waiting out the 30-60s TTL. Re #23."
```

---

### Task 9: Final verification

- [ ] **Step 1: Full suite**

Run: `yarn test`
Expected: PASS, no failures.

- [ ] **Step 2: Confirm no spec drift**

Run: `./scripts/spec-hash.sh` and compare to `x-spec-hash` in `sdk/typescript/package.json`.
Expected: unchanged (no API/spec files were touched). If it differs, stop — something in scope touched the spec unexpectedly.

- [ ] **Step 3: Manual a11y/htmx check (Task 2 client.ts JS)**

Use the `run` or `verify` skill to load `/_/admin/dashboard`, confirm widgets load without the KPI row shifting, the copy chips copy on click, and the slot's `aria-busy` flips true→false on swap (DevTools elements panel). Document the result.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin feat/issue-23-widget-polish
gh pr create --title "Widget-islands deferred polish (#23)" --body "Closes #23. <summary of the eight items>"
```

## Self-Review notes

- **Spec coverage:** all 8 issue items map to tasks — range:changed (T1), skel-kpi (T3), aria-busy (T2), dash-* ids (T4), bumpCacheVersion (T8), copyUrl (T5), top-domains count (T6), top-links slug (T7).
- **Type consistency:** `primarySlugByIds` returns `Map<number,string>` (T7 produces, top-links consumes). `getBreakdownDistinctCount` returns `number` (T6). `TopLinksData.rows[].slug: string` added in T7.
- **No placeholders:** every code/test step shows the full snippet.
- **Out of scope (noted, not done):** non-copyUrl inline onclick handlers (`deleteKey`, `showQRModal`, `showDuplicateModal`, `confirmDeleteSlug`, `confirmDisableSlug`) share the anti-pattern; the issue scopes only copyUrl. keys-page `copyCodeBlock('quickstart-curl')` is a static arg, not affected.
