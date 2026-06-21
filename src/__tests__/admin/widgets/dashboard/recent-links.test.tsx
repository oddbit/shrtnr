// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../../setup";
import { LinkRepository } from "../../../../db";
import { recentLinksWidget } from "../../../../admin/widgets/dashboard/recent-links";
import type { WidgetCtx } from "../../../../admin/widgets/types";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx: WidgetCtx = {
  identity: "dev@local",
  filters: {},
  t: ((k: string) => k) as WidgetCtx["t"],
  lang: "en",
};

describe("dashboard.recent-links widget", () => {
  it("does not vary its cache by range (the loader ignores range)", () => {
    // The loader always returns the five newest links regardless of range, so
    // the cache must not fragment per range (one shared entry, no re-query on
    // range switch).
    expect(recentLinksWidget.cache?.varyByRange).toBe(false);
  });

  it("renders the five most recent links as recent-row anchors", async () => {
    // Seed seven links with distinct, increasing created_at so "most recent"
    // is unambiguous. create() stamps all rows in the same wall-clock second,
    // which ties under ORDER BY created_at DESC, so set the column explicitly.
    for (let i = 0; i < 7; i++) {
      const link = await LinkRepository.create(env.DB, { url: `https://e.com/${i}`, slug: `s${i}` });
      await env.DB.prepare("UPDATE links SET created_at = ? WHERE id = ?").bind(1000 + i, link.id).run();
    }

    const data = await recentLinksWidget.load(env, ctx, { range: "all" });
    const out = String(recentLinksWidget.render(data, ctx));

    expect(out).toContain("dashboard.recentLinks");
    // Exactly five recent-row anchors, no more (5 of the 7 seeded links).
    expect((out.match(/class="recent-row"/g) ?? []).length).toBe(5);

    // The five most recent are s6..s2; the two oldest (s0, s1) must not appear.
    expect(out).toContain("https://e.com/6");
    expect(out).toContain("https://e.com/2");
    expect(out).not.toContain("https://e.com/0");
    expect(out).not.toContain("https://e.com/1");

    // The htmx placeholder already carries the bento-card shell, so the widget
    // must render inner content only and not nest its own outer wrapper.
    expect(out).not.toContain("bento-card");
  });

  it("exposes the copy chip via data-copy-slug, not an inline onclick", async () => {
    await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    const data = await recentLinksWidget.load(env, ctx, { range: "all" });
    const out = String(recentLinksWidget.render(data, ctx));
    expect(out).toContain('data-copy-slug="abc"');
    expect(out).not.toContain("copyUrl(");
    expect(out).not.toContain("onclick");
  });

  it("issues a bounded query count regardless of catalog size", async () => {
    const make = (n0: number, n: number) =>
      Array.from({ length: n }, (_, i) =>
        LinkRepository.create(env.DB, { url: `https://e.com/${n0 + i}`, slug: `s${n0 + i}` }),
      );

    const count = async () => {
      const c = { n: 0 };
      const countingDb = new Proxy(env.DB, {
        get(t, p, r) {
          if (p === "prepare") {
            return (s: string) => {
              c.n++;
              return (t as unknown as D1Database).prepare(s);
            };
          }
          const v = Reflect.get(t, p, r);
          return typeof v === "function" ? v.bind(t) : v;
        },
      }) as unknown as D1Database;
      await recentLinksWidget.load({ ...env, DB: countingDb } as typeof env, ctx, { range: "all" });
      return c.n;
    };

    await Promise.all(make(0, 5));
    const small = await count();

    await Promise.all(make(5, 45));
    const large = await count();

    // The focused recent() query must not scale with catalog size: identical
    // prepare() count at 5 links and at 50 links.
    expect(large).toBe(small);
  });
});
