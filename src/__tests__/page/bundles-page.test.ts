// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, BundleRepository, ClickRepository } from "../../db";

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

describe("Bundles list card onboarding stats", () => {
  async function seedBundleWithTraffic() {
    const a = await LinkRepository.create(env.DB, { url: "https://a.example", slug: "aaa", createdBy: "dev@local" });
    const b = await LinkRepository.create(env.DB, { url: "https://b.example", slug: "bbb", createdBy: "dev@local" });
    const bundle = await BundleRepository.create(env.DB, { name: "Demo", createdBy: "dev@local" });
    await BundleRepository.addLink(env.DB, bundle.id, a.id);
    await BundleRepository.addLink(env.DB, bundle.id, b.id);
    await ClickRepository.record(env.DB, a.slugs[0].slug, { isBot: 0 });
    return bundle;
  }

  it("renders an avg/day stat alongside total clicks and links", async () => {
    await seedBundleWithTraffic();
    const res = await SELF.fetch(req("/_/admin/bundles?range=all"));
    const html = await res.text();
    expect(html).toContain("Avg / day");
    // Three stat values now render per card (total clicks, links, avg/day).
    const statValues = [...html.matchAll(/class="bundle-card-stat-value">/g)];
    expect(statValues.length).toBe(3);
  });

  it("computes avg/day with the shared formatAvgPerDay helper, matching the detail page", async () => {
    const a = await LinkRepository.create(env.DB, { url: "https://a.example", slug: "aaa", createdBy: "dev@local" });
    const bundle = await BundleRepository.create(env.DB, { name: "Demo", createdBy: "dev@local" });
    await BundleRepository.addLink(env.DB, bundle.id, a.id);
    await ClickRepository.record(env.DB, a.slugs[0].slug, { isBot: 0 });

    const res = await SELF.fetch(req("/_/admin/bundles?range=7d"));
    const html = await res.text();
    // 1 click over the fixed 7-day window is 1/7 ≈ 0.14, formatted to two
    // decimals by formatAvgPerDay (the same helper the detail page uses), not
    // rounded to an integer. This is deterministic for a bounded range.
    expect(html).toContain(">0.14<");
  });

  it("renders a links-with-traffic footer reflecting only links that got clicks", async () => {
    await seedBundleWithTraffic();
    const res = await SELF.fetch(req("/_/admin/bundles?range=all"));
    const html = await res.text();
    // Only link a saw traffic, so 1 of the 2 bundle links is counted.
    expect(html).toMatch(/1 of 2 bundle links got traffic/);
    // Assert the rendered element, not the bare class name (which also
    // appears in the embedded stylesheet).
    expect(html).toContain('class="bundle-card-foot"');
  });

  it("omits the traffic footer for a bundle with no links", async () => {
    await BundleRepository.create(env.DB, { name: "Empty", createdBy: "dev@local" });
    const res = await SELF.fetch(req("/_/admin/bundles?range=all"));
    const html = await res.text();
    expect(html).not.toContain('class="bundle-card-foot"');
  });
});
