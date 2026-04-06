import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, ClickRepository, SlugRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("ClickRepository.record", () => {
  it("increments slug click_count", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].click_count).toBe(1);
    expect(updated!.total_clicks).toBe(1);
  });

  it("increments link_click_count for link mode clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { linkMode: "link" });
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].link_click_count).toBe(1);
    expect(updated!.slugs[0].qr_click_count).toBe(0);
    expect(updated!.slugs[0].click_count).toBe(1);
  });

  it("increments qr_click_count for qr mode clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { linkMode: "qr" });
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].link_click_count).toBe(0);
    expect(updated!.slugs[0].qr_click_count).toBe(1);
    expect(updated!.slugs[0].click_count).toBe(1);
  });

  it("click_count is the sum of link and qr clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, { linkMode: "link" });
    await ClickRepository.record(env.DB, slugId, { linkMode: "link" });
    await ClickRepository.record(env.DB, slugId, { linkMode: "qr" });
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].link_click_count).toBe(2);
    expect(updated!.slugs[0].qr_click_count).toBe(1);
    expect(updated!.slugs[0].click_count).toBe(3);
  });

  it("stores referrer, country, device type, and browser", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, {
      referrer: "https://referrer.com",
      country: "US",
      deviceType: "mobile",
      browser: "Safari",
    });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([{ name: "US", count: 1 }]);
    expect(stats.referrers).toEqual([{ name: "https://referrer.com", count: 1 }]);
    expect(stats.devices).toEqual([{ name: "mobile", count: 1 }]);
    expect(stats.browsers).toEqual([{ name: "Safari", count: 1 }]);
  });

  it("stores link_mode when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, {
      country: "US",
      deviceType: "mobile",
      browser: "Chrome",
      linkMode: "qr",
    });
    const row = await env.DB.prepare("SELECT link_mode FROM clicks WHERE slug_id = ?").bind(link.slugs[0].id).first<{ link_mode: string }>();
    expect(row!.link_mode).toBe("qr");
  });

  it("defaults link_mode to link when not provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const row = await env.DB.prepare("SELECT link_mode FROM clicks WHERE slug_id = ?").bind(link.slugs[0].id).first<{ link_mode: string }>();
    expect(row!.link_mode).toBe("link");
  });

  it("handles null values without error", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
  });

  it("stores os when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { os: "ios" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.os).toEqual([{ name: "ios", count: 1 }]);
  });

  it("stores referrer_host when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, {
      referrer: "https://google.com/search?q=test",
      referrerHost: "google.com",
    });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.referrer_hosts).toEqual([{ name: "google.com", count: 1 }]);
  });

  it("stores UTM parameters", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, {
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "spring-launch",
    });
    const row = await env.DB.prepare("SELECT utm_source, utm_medium, utm_campaign FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ utm_source: string; utm_medium: string; utm_campaign: string }>();
    expect(row!.utm_source).toBe("newsletter");
    expect(row!.utm_medium).toBe("email");
    expect(row!.utm_campaign).toBe("spring-launch");
  });

  it("stores channel (traffic source) separately from link_mode", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, {
      linkMode: "qr",
      channel: "social",
    });
    const row = await env.DB.prepare("SELECT link_mode, channel FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ link_mode: string; channel: string }>();
    expect(row!.link_mode).toBe("qr");
    expect(row!.channel).toBe("social");
  });
});

describe("ClickRepository.getStats", () => {
  it("returns zeros for a link with no clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(0);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.referrer_hosts).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.os).toEqual([]);
    expect(stats.browsers).toEqual([]);
    expect(stats.link_modes).toEqual([]);
    expect(stats.channels).toEqual([]);
    expect(stats.clicks_over_time).toEqual([]);
  });

  it("aggregates clicks across multiple slugs", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    const autoSlug = fetched.slugs.find((s) => s.is_custom === 0)!;
    const customSlug = fetched.slugs.find((s) => s.is_custom === 1)!;
    await ClickRepository.record(env.DB, autoSlug.id, { country: "US", deviceType: "desktop", browser: "Chrome" });
    await ClickRepository.record(env.DB, customSlug.id, { country: "DE", deviceType: "mobile", browser: "Firefox" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(2);
  });

  it("returns link_mode breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { linkMode: "qr" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { linkMode: "qr" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.link_modes).toEqual(
      expect.arrayContaining([
        { name: "qr", count: 2 },
        { name: "link", count: 1 },
      ]),
    );
  });

  it("returns os breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { os: "ios" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { os: "android" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { os: "ios" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.os).toEqual([
      { name: "ios", count: 2 },
      { name: "android", count: 1 },
    ]);
  });

  it("returns referrer_hosts breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { referrerHost: "google.com" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { referrerHost: "google.com" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { referrerHost: "facebook.com" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.referrer_hosts).toEqual([
      { name: "google.com", count: 2 },
      { name: "facebook.com", count: 1 },
    ]);
  });
});

describe("ClickRepository.getDashboardStats", () => {
  it("returns totals and top lists", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { country: "US", deviceType: "desktop", browser: "Chrome" });
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

describe("ClickRepository.getTimeline", () => {
  it("returns empty buckets for a link with no clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "7d");
    expect(tl.range).toBe("7d");
    expect(tl.summary.last_24h).toBe(0);
    expect(tl.summary.last_7d).toBe(0);
    expect(tl.summary.last_30d).toBe(0);
    expect(tl.summary.last_90d).toBe(0);
    expect(tl.summary.last_1y).toBe(0);
    expect(tl.buckets).toHaveLength(7);
    expect(tl.buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("returns 24 hourly buckets for 24h range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "24h");
    expect(tl.buckets).toHaveLength(24);
  });

  it("returns 30 daily buckets for 30d range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "30d");
    expect(tl.buckets).toHaveLength(30);
  });

  it("returns 90 daily buckets for 90d range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "90d");
    expect(tl.buckets).toHaveLength(90);
  });

  it("counts clicks in summary stats", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "7d");
    expect(tl.summary.last_24h).toBe(2);
    expect(tl.summary.last_7d).toBe(2);
    expect(tl.summary.last_30d).toBe(2);
    expect(tl.summary.last_90d).toBe(2);
    expect(tl.summary.last_1y).toBe(2);
  });

  it("places click counts in the correct bucket", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "7d");
    // The last bucket (today) should have the click
    const lastBucket = tl.buckets[tl.buckets.length - 1];
    expect(lastBucket.count).toBe(1);
  });

  it("returns empty for nonexistent link", async () => {
    const tl = await ClickRepository.getTimeline(env.DB, 99999, "7d");
    expect(tl.summary.last_24h).toBe(0);
    expect(tl.buckets).toHaveLength(0);
  });

  it("all range returns monthly buckets", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "all");
    expect(tl.range).toBe("all");
    expect(tl.buckets.length).toBeGreaterThanOrEqual(1);
    // Monthly labels look like "YYYY-MM"
    expect(tl.buckets[0].label).toMatch(/^\d{4}-\d{2}$/);
  });
});
