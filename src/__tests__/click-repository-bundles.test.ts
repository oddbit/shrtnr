import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { BundleRepository, ClickRepository, LinkRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

async function recordClick(
  slug: string,
  at: number,
  data: { country?: string; referrer_host?: string; device_type?: string; os?: string; browser?: string; link_mode?: string } = {},
) {
  await env.DB
    .prepare(
      "INSERT INTO clicks (slug, clicked_at, country, referrer_host, device_type, os, browser, link_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      slug,
      at,
      data.country ?? null,
      data.referrer_host ?? null,
      data.device_type ?? null,
      data.os ?? null,
      data.browser ?? null,
      data.link_mode ?? "link",
    )
    .run();
}

describe("ClickRepository.getBundleStats", () => {
  it("returns null for unknown bundle", async () => {
    expect(await ClickRepository.getBundleStats(env.DB, 99999, "30d")).toBeNull();
  });

  it("returns zero-valued stats for an empty bundle", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.link_count).toBe(0);
    expect(stats.total_clicks).toBe(0);
    expect(stats.per_link).toEqual([]);
    expect(stats.countries).toEqual([]);
  });

  it("aggregates totals across links in the bundle", async () => {
    const link1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const link2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link1.id);
    await BundleRepository.addLink(env.DB, bundle.id, link2.id);

    const now = Math.floor(Date.now() / 1000);
    await recordClick(link1.slugs[0].slug, now - 3600, { country: "US", device_type: "desktop" });
    await recordClick(link1.slugs[0].slug, now - 7200, { country: "US", device_type: "mobile" });
    await recordClick(link2.slugs[0].slug, now - 1800, { country: "ID", device_type: "desktop" });

    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.total_clicks).toBe(3);
    expect(stats.link_count).toBe(2);
    expect(stats.clicked_links).toBe(2);
    expect(stats.countries_reached).toBe(2);
    expect(stats.countries).toHaveLength(2);
    const us = stats.countries.find((c) => c.name === "US");
    const id = stats.countries.find((c) => c.name === "ID");
    expect(us?.count).toBe(2);
    expect(id?.count).toBe(1);
  });

  it("counts countries_reached beyond the top-10 countries list cap", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);

    // 12 distinct countries, one click each. The countries list is capped at
    // LIMIT 10, but countries_reached must reflect the full distinct count.
    const now = Math.floor(Date.now() / 1000);
    const codes = ["US", "ID", "SE", "DE", "FR", "GB", "JP", "SG", "BR", "IN", "CA", "AU"];
    for (let i = 0; i < codes.length; i++) {
      await recordClick(link.slugs[0].slug, now - (i + 1), { country: codes[i] });
    }

    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.countries).toHaveLength(10);
    expect(stats.countries_reached).toBe(12);
  });

  it("sorts per_link by click count descending and computes pct_of_bundle", async () => {
    const link1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const link2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link1.id);
    await BundleRepository.addLink(env.DB, bundle.id, link2.id);

    const now = Math.floor(Date.now() / 1000);
    await recordClick(link1.slugs[0].slug, now - 1);
    await recordClick(link2.slugs[0].slug, now - 1);
    await recordClick(link2.slugs[0].slug, now - 1);
    await recordClick(link2.slugs[0].slug, now - 1);

    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.total_clicks).toBe(4);
    expect(stats.per_link[0].link_id).toBe(link2.id);
    expect(stats.per_link[0].click_count).toBe(3);
    expect(stats.per_link[0].pct_of_bundle).toBe(75);
    expect(stats.per_link[1].link_id).toBe(link1.id);
    expect(stats.per_link[1].click_count).toBe(1);
    expect(stats.per_link[1].pct_of_bundle).toBe(25);
  });

  it("identifies top_performer as the highest-click link in bundle", async () => {
    const link1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", label: "A", createdBy: "a@b" });
    const link2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb", label: "B", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link1.id);
    await BundleRepository.addLink(env.DB, bundle.id, link2.id);

    const now = Math.floor(Date.now() / 1000);
    await recordClick(link1.slugs[0].slug, now - 1);
    await recordClick(link2.slugs[0].slug, now - 1);
    await recordClick(link2.slugs[0].slug, now - 1);

    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.top_performer?.slug).toBe(link2.slugs[0].slug);
    expect(stats.top_performer?.label).toBe("B");
    expect(stats.top_performer?.click_count).toBe(2);
  });

  it("excludes clicks outside the requested range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);

    const now = Math.floor(Date.now() / 1000);
    await recordClick(link.slugs[0].slug, now - 60); // in-range
    await recordClick(link.slugs[0].slug, now - 100 * 86400); // out of 30d range

    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.total_clicks).toBe(1);
  });

  it("includes zero-click member links in per_link", async () => {
    const link1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const link2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link1.id);
    await BundleRepository.addLink(env.DB, bundle.id, link2.id);

    const now = Math.floor(Date.now() / 1000);
    await recordClick(link1.slugs[0].slug, now - 1);

    const stats = (await ClickRepository.getBundleStats(env.DB, bundle.id, "30d"))!;
    expect(stats.per_link).toHaveLength(2);
    expect(stats.clicked_links).toBe(1);
    // link2 appears with 0 clicks
    expect(stats.per_link.find((p) => p.link_id === link2.id)?.click_count).toBe(0);
  });
});

describe("ClickRepository.getBundleSummariesBulk", () => {
  it("returns empty map when called with no bundles", async () => {
    const res = await ClickRepository.getBundleSummariesBulk(env.DB, []);
    expect(res.size).toBe(0);
  });

  it("returns total_clicks and top_links per bundle", async () => {
    const link1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const link2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb", createdBy: "a@b" });
    const b1 = await BundleRepository.create(env.DB, { name: "B1", createdBy: "a@b" });
    const b2 = await BundleRepository.create(env.DB, { name: "B2", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, b1.id, link1.id);
    await BundleRepository.addLink(env.DB, b2.id, link2.id);

    const now = Math.floor(Date.now() / 1000);
    await recordClick(link1.slugs[0].slug, now - 1);
    await recordClick(link1.slugs[0].slug, now - 1);
    await recordClick(link2.slugs[0].slug, now - 1);

    const res = await ClickRepository.getBundleSummariesBulk(env.DB, [b1.id, b2.id], now);
    expect(res.get(b1.id)?.total_clicks).toBe(2);
    expect(res.get(b2.id)?.total_clicks).toBe(1);
    expect(res.get(b1.id)?.top_links[0].slug).toBe(link1.slugs[0].slug);
    expect(res.get(b1.id)?.top_links[0].click_count).toBe(2);
  });

  it("zero-fills sparkline for bundles with no clicks", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await ClickRepository.getBundleSummariesBulk(env.DB, [bundle.id]);
    expect(res.get(bundle.id)?.sparkline.length).toBeGreaterThan(0);
    expect(res.get(bundle.id)?.sparkline.every((x) => x === 0)).toBe(true);
  });

  it("range scopes total_clicks, top_links, and delta on each summary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);

    const now = Math.floor(Date.now() / 1000);
    // 1 click "now" inside any range
    await recordClick(link.slugs[0].slug, now - 60);
    // 2 clicks 60 days ago: outside 7d/30d, inside 90d/all, also previous-30d window for delta
    await recordClick(link.slugs[0].slug, now - 60 * 86400);
    await recordClick(link.slugs[0].slug, now - 60 * 86400);

    const all = await ClickRepository.getBundleSummariesBulk(env.DB, [bundle.id], now, undefined, "all");
    expect(all.get(bundle.id)?.total_clicks).toBe(3);
    expect(all.get(bundle.id)?.delta_pct).toBeUndefined();

    const last7 = await ClickRepository.getBundleSummariesBulk(env.DB, [bundle.id], now, undefined, "7d");
    expect(last7.get(bundle.id)?.total_clicks).toBe(1);
    expect(last7.get(bundle.id)?.top_links[0]?.click_count).toBe(1);

    const last30 = await ClickRepository.getBundleSummariesBulk(env.DB, [bundle.id], now, undefined, "30d");
    expect(last30.get(bundle.id)?.total_clicks).toBe(1);
    // current 30d has 1, previous 30d has 2 → -50%
    expect(last30.get(bundle.id)?.delta_pct).toBe(-50);
  });
});
