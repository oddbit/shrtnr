// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../../setup";
import { LinkRepository, ClickRepository } from "../../../../db";
import { topLinksWidget } from "../../../../admin/widgets/dashboard/top-links";
import type { WidgetCtx } from "../../../../admin/widgets/types";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx: WidgetCtx = {
  identity: "dev@local",
  filters: {},
  t: ((k: string) => k) as WidgetCtx["t"],
  lang: "en",
};

describe("dashboard.top-links widget", () => {
  it("renders the most-clicked rows linking to link detail", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {});
    const data = await topLinksWidget.load(env, ctx, { range: "all" });
    const out = String(topLinksWidget.render(data, ctx));
    expect(out).toContain("dashboard.mostClicked");
    expect(out).toContain("top-link-row");
    expect(out).toContain(`/_/admin/links/${link.id}`);
    // The htmx placeholder already carries the bento-card shell, so the widget
    // must render inner content only and not nest its own outer wrapper.
    expect(out).not.toContain("bento-card");
  });

  it("shows the empty state with no data", async () => {
    const data = await topLinksWidget.load(env, ctx, { range: "all" });
    const out = String(topLinksWidget.render(data, ctx));
    expect(out).toContain("dashboard.mostClicked");
    expect(out).toContain("dashboard.noData");
    expect(out).not.toContain("top-link-row");
    expect(out).not.toContain("bento-card");
  });

  it("names each row by its primary slug, not label or url", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "primo", label: "My Label" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {});
    const data = await topLinksWidget.load(env, ctx, { range: "all" });
    expect(data.rows[0].slug).toBe("primo");
    const out = String(topLinksWidget.render(data, ctx));
    expect(out).toContain("primo"); // primary slug shown, matching the page
  });
});
