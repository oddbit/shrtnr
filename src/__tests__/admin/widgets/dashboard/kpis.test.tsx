// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../../setup";
import { LinkRepository, ClickRepository } from "../../../../db";
import { kpisWidget } from "../../../../admin/widgets/dashboard/kpis";
import type { WidgetCtx } from "../../../../admin/widgets/types";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx: WidgetCtx = {
  identity: "dev@local",
  filters: {},
  t: ((k: string) => k) as WidgetCtx["t"],
  lang: "en",
};

// Wrap a D1Database so every .prepare() call increments a counter, while
// delegating all behavior to the real binding. Mirrors the Stage 1
// query-count test in src/__tests__/repository/click-repository.test.ts.
function countingDb(db: D1Database, counter: { n: number }): D1Database {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return (sql: string) => {
          counter.n++;
          return (target as unknown as D1Database).prepare(sql);
        };
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? v.bind(target) : v;
    },
  }) as unknown as D1Database;
}

describe("dashboard.kpis widget", () => {
  it("loads totals and renders the kpi strip", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { country: "US" });
    const data = await kpisWidget.load(env, ctx, { range: "30d" });
    const out = String(kpisWidget.render(data, ctx));
    // The dash-* ids were hooks for the removed pollDashboard and are gone.
    // Assert the cards rendered via stable markers instead.
    expect(out).toContain("dashboard.totalLinks");
    expect(out).toContain("dashboard.totalClicks");
    expect((out.match(/class="bento-card kpi/g) ?? []).length).toBe(4);
    expect(out).not.toContain("dash-");
    // The htmx placeholder already carries the kpi-strip shell, so the widget
    // must render inner content only and not nest its own outer wrapper.
    expect(out).not.toContain('class="kpi-strip"');
  });

  it("issues a query count that does not grow with the number of links", async () => {
    for (let i = 0; i < 5; i++) {
      await LinkRepository.create(env.DB, { url: `https://e.com/${i}`, slug: `s${i}` });
    }
    const small = { n: 0 };
    await kpisWidget.load({ ...env, DB: countingDb(env.DB, small) }, ctx, { range: "30d" });

    for (let i = 5; i < 40; i++) {
      await LinkRepository.create(env.DB, { url: `https://e.com/${i}`, slug: `s${i}` });
    }
    const large = { n: 0 };
    await kpisWidget.load({ ...env, DB: countingDb(env.DB, large) }, ctx, { range: "30d" });

    expect(small.n).toBeGreaterThan(0);
    expect(large.n).toBe(small.n);
  });
});
