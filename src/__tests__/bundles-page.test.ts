// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, BundleRepository, ClickRepository } from "../db";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
}

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  // resetData preserves bundle rows; clear them explicitly so each test starts fresh.
  await env.DB.exec("DELETE FROM bundles");
  await env.DB.exec("DELETE FROM bundle_links");
});

describe("Bundles list page range selector", () => {
  it("renders a range picker linking back to /_/admin/bundles", async () => {
    await BundleRepository.create(env.DB, { name: "Demo", createdBy: "dev@local" });
    const res = await SELF.fetch(req("/_/admin/bundles"));
    const html = await res.text();
    expect(html).toMatch(/class="range-picker"/);
    expect(html).toMatch(/href="\/_\/admin\/bundles\?[^"]*range=7d/);
    expect(html).toMatch(/href="\/_\/admin\/bundles\?[^"]*range=all/);
  });

  it("displayed total_clicks per bundle reflects the selected range", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
      createdBy: "dev@local",
    });
    const bundle = await BundleRepository.create(env.DB, {
      name: "Demo",
      createdBy: "dev@local",
    });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);

    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await ClickRepository.record(env.DB, slug, { isBot: 0 });
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();

    const all = await SELF.fetch(req("/_/admin/bundles?range=all"));
    const allHtml = await all.text();
    const allMatch = allHtml.match(/class="bundle-card-stat-value">([0-9]+)</);
    expect(allMatch?.[1]).toBe("2");

    const last7 = await SELF.fetch(req("/_/admin/bundles?range=7d"));
    const last7Html = await last7.text();
    const last7Match = last7Html.match(/class="bundle-card-stat-value">([0-9]+)</);
    expect(last7Match?.[1]).toBe("1");
  });

  it("filter chips preserve the active range", async () => {
    await BundleRepository.create(env.DB, { name: "Demo", createdBy: "dev@local" });
    const res = await SELF.fetch(req("/_/admin/bundles?range=7d"));
    const html = await res.text();
    const chipHrefs = [...html.matchAll(/href="(\/_\/admin\/bundles[^"]*filter=archived[^"]*)"/g)].map((m) => m[1]);
    expect(chipHrefs.some((h) => h.includes("range=7d"))).toBe(true);
  });
});
