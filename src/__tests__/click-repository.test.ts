import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, ClickRepository, SlugRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("ClickRepository.record", () => {
  it("increments slug click_count", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null);
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].click_count).toBe(1);
    expect(updated!.total_clicks).toBe(1);
  });

  it("increments link_click_count for direct clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null, "direct");
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].link_click_count).toBe(1);
    expect(updated!.slugs[0].qr_click_count).toBe(0);
    expect(updated!.slugs[0].click_count).toBe(1);
  });

  it("increments qr_click_count for qr clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null, "qr");
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].link_click_count).toBe(0);
    expect(updated!.slugs[0].qr_click_count).toBe(1);
    expect(updated!.slugs[0].click_count).toBe(1);
  });

  it("click_count is the sum of link and qr clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, null, null, null, null, "direct");
    await ClickRepository.record(env.DB, slugId, null, null, null, null, "direct");
    await ClickRepository.record(env.DB, slugId, null, null, null, null, "qr");
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].link_click_count).toBe(2);
    expect(updated!.slugs[0].qr_click_count).toBe(1);
    expect(updated!.slugs[0].click_count).toBe(3);
  });

  it("stores referrer, country, device type, and browser", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, "https://referrer.com", "US", "mobile", "Safari");
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([{ name: "US", count: 1 }]);
    expect(stats.referrers).toEqual([{ name: "https://referrer.com", count: 1 }]);
    expect(stats.devices).toEqual([{ name: "mobile", count: 1 }]);
    expect(stats.browsers).toEqual([{ name: "Safari", count: 1 }]);
  });

  it("stores channel when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, "US", "mobile", "Chrome", "qr");
    const row = await env.DB.prepare("SELECT channel FROM clicks WHERE slug_id = ?").bind(link.slugs[0].id).first<{ channel: string }>();
    expect(row!.channel).toBe("qr");
  });

  it("defaults channel to direct when not provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null);
    const row = await env.DB.prepare("SELECT channel FROM clicks WHERE slug_id = ?").bind(link.slugs[0].id).first<{ channel: string }>();
    expect(row!.channel).toBe("direct");
  });

  it("handles null values without error", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null);
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
  });
});

describe("ClickRepository.getStats", () => {
  it("returns zeros for a link with no clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(0);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
    expect(stats.clicks_over_time).toEqual([]);
  });

  it("aggregates clicks across multiple slugs", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    const autoSlug = fetched.slugs.find((s) => s.is_custom === 0)!;
    const customSlug = fetched.slugs.find((s) => s.is_custom === 1)!;
    await ClickRepository.record(env.DB, autoSlug.id, null, "US", "desktop", "Chrome");
    await ClickRepository.record(env.DB, customSlug.id, null, "DE", "mobile", "Firefox");
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(2);
  });

  it("returns channel breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null, "qr");
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null, "qr");
    await ClickRepository.record(env.DB, link.slugs[0].id, null, null, null, null);
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.channels).toEqual(
      expect.arrayContaining([
        { name: "qr", count: 2 },
        { name: "direct", count: 1 },
      ]),
    );
  });
});

describe("ClickRepository.getDashboardStats", () => {
  it("returns totals and top lists", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, null, "US", "desktop", "Chrome");
    const stats = await ClickRepository.getDashboardStats(env.DB);
    expect(stats.total_links).toBe(1);
    expect(stats.total_clicks).toBe(1);
    expect(stats.recent_links).toHaveLength(1);
    expect(stats.top_links).toHaveLength(1);
    expect(stats.top_countries).toEqual([{ name: "US", count: 1 }]);
  });

  it("caps recent_links at 5", async () => {
    for (let i = 0; i < 7; i++) {
      await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `s${i}${i}${i}` });
    }
    const stats = await ClickRepository.getDashboardStats(env.DB);
    expect(stats.recent_links).toHaveLength(5);
  });
});
