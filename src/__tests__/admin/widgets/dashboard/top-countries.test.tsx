// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../../setup";
import { LinkRepository, ClickRepository } from "../../../../db";
import { topCountriesWidget } from "../../../../admin/widgets/dashboard/top-countries";
import type { WidgetCtx } from "../../../../admin/widgets/types";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx: WidgetCtx = {
  identity: "dev@local",
  filters: {},
  t: ((k: string) => k) as WidgetCtx["t"],
  lang: "en",
};

describe("dashboard.top-countries widget", () => {
  it("renders country rows", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { country: "US" });
    const data = await topCountriesWidget.load(env, ctx, { range: "all" });
    const out = String(topCountriesWidget.render(data, ctx));
    expect(out).toContain("dashboard.topCountries");
    expect(out).toContain("stat-row");
    // The htmx placeholder already carries the bento-card shell, so the widget
    // must render inner content only and not nest its own outer wrapper.
    expect(out).not.toContain("bento-card");
  });

  it("shows the empty state with no data", async () => {
    const data = await topCountriesWidget.load(env, ctx, { range: "all" });
    const out = String(topCountriesWidget.render(data, ctx));
    expect(out).toContain("dashboard.topCountries");
    expect(out).toContain("dashboard.noData");
    expect(out).not.toContain("stat-row");
    expect(out).not.toContain("bento-card");
  });
});
