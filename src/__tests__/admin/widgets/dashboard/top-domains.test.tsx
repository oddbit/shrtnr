// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../../setup";
import { LinkRepository, ClickRepository } from "../../../../db";
import { topDomainsWidget } from "../../../../admin/widgets/dashboard/top-domains";
import type { WidgetCtx } from "../../../../admin/widgets/types";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx: WidgetCtx = {
  identity: "dev@local",
  filters: {},
  t: ((k: string) => k) as WidgetCtx["t"],
  lang: "en",
};

describe("dashboard.top-domains widget", () => {
  it("renders referrer host rows", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { referrerHost: "google.com" });
    const data = await topDomainsWidget.load(env, ctx, { range: "all" });
    const out = String(topDomainsWidget.render(data, ctx));
    expect(out).toContain("dashboard.topDomains");
    expect(out).toContain("google.com");
    expect(out).toContain("stat-row");
    // The htmx placeholder already carries the bento-card shell, so the widget
    // must render inner content only and not nest its own outer wrapper.
    expect(out).not.toContain("bento-card");
  });

  it("shows the empty state with no data", async () => {
    const data = await topDomainsWidget.load(env, ctx, { range: "all" });
    const out = String(topDomainsWidget.render(data, ctx));
    expect(out).toContain("dashboard.topDomains");
    expect(out).toContain("dashboard.noData");
    expect(out).not.toContain("stat-row");
    expect(out).not.toContain("bento-card");
  });

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
});
