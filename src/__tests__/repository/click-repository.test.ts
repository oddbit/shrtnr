import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { BundleRepository, ClickRepository, LinkRepository, SlugRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);
beforeEach(async () => {
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

describe("ClickRepository.record", () => {
  it("click_count is aggregated from clicks table", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(link.slugs[0].click_count).toBe(0);

    await ClickRepository.record(env.DB, link.slugs[0].slug);
    const after1 = await LinkRepository.getById(env.DB, link.id);
    expect(after1!.slugs[0].click_count).toBe(1);
    expect(after1!.total_clicks).toBe(1);
  });

  it("click_count counts all link modes together", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, { linkMode: "link" });
    await ClickRepository.record(env.DB, slug, { linkMode: "link" });
    await ClickRepository.record(env.DB, slug, { linkMode: "qr" });
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].click_count).toBe(3);
  });

  it("stores referrer, country, device type, and browser", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {
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
    await ClickRepository.record(env.DB, link.slugs[0].slug, {
      country: "US",
      deviceType: "mobile",
      browser: "Chrome",
      linkMode: "qr",
    });
    const row = await env.DB.prepare("SELECT link_mode FROM clicks WHERE slug = ?").bind(link.slugs[0].slug).first<{ link_mode: string }>();
    expect(row!.link_mode).toBe("qr");
  });

  it("defaults link_mode to link when not provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug);
    const row = await env.DB.prepare("SELECT link_mode FROM clicks WHERE slug = ?").bind(link.slugs[0].slug).first<{ link_mode: string }>();
    expect(row!.link_mode).toBe("link");
  });

  it("handles null values without error", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug);
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
  });

  it("stores os when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { os: "ios" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.os).toEqual([{ name: "ios", count: 1 }]);
  });

  it("stores referrer_host when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {
      referrer: "https://google.com/search?q=test",
      referrerHost: "google.com",
    });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.referrer_hosts).toEqual([{ name: "google.com", count: 1 }]);
  });

  it("stores UTM parameters", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "spring-launch",
    });
    const row = await env.DB.prepare("SELECT utm_source, utm_medium, utm_campaign FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ utm_source: string; utm_medium: string; utm_campaign: string }>();
    expect(row!.utm_source).toBe("newsletter");
    expect(row!.utm_medium).toBe("email");
    expect(row!.utm_campaign).toBe("spring-launch");
  });

  it("stores channel (traffic source) separately from link_mode", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, {
      linkMode: "qr",
      channel: "social",
    });
    const row = await env.DB.prepare("SELECT link_mode, channel FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
    await ClickRepository.record(env.DB, autoSlug.slug, { country: "US", deviceType: "desktop", browser: "Chrome" });
    await ClickRepository.record(env.DB, customSlug.slug, { country: "DE", deviceType: "mobile", browser: "Firefox" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(2);
  });

  it("returns link_mode breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { linkMode: "qr" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { linkMode: "qr" });
    await ClickRepository.record(env.DB, link.slugs[0].slug);
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
    await ClickRepository.record(env.DB, link.slugs[0].slug, { os: "ios" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { os: "android" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { os: "ios" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.os).toEqual([
      { name: "ios", count: 2 },
      { name: "android", count: 1 },
    ]);
  });

  it("returns referrer_hosts breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { referrerHost: "google.com" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { referrerHost: "google.com" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { referrerHost: "facebook.com" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.referrer_hosts).toEqual([
      { name: "google.com", count: 2 },
      { name: "facebook.com", count: 1 },
    ]);
  });

  it("filters app-scheme raw referrers from the Sources breakdown and num_referrers", async () => {
    // Sources panel groups by raw referrer URL. App-scheme Referer values like
    // `android-app://com.linkedin.android/` look strange next to real URLs and
    // are already attributed via referrer_host in the Domains panel. Hide them
    // here while keeping the raw row in the DB.
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "src1" });
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://news.ycombinator.com/item?id=42",
      referrerHost: "news.ycombinator.com",
    });
    await ClickRepository.record(env.DB, slug, {
      referrer: "android-app://com.linkedin.android/",
      referrerHost: "linkedin.com",
    });
    await ClickRepository.record(env.DB, slug, {
      referrer: "ios-app://com.linkedin.LinkedIn/",
      referrerHost: "linkedin.com",
    });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    const sourceNames = stats.referrers.map((r) => r.name);
    expect(sourceNames).toContain("https://news.ycombinator.com/item?id=42");
    expect(sourceNames).not.toContain("android-app://com.linkedin.android/");
    expect(sourceNames).not.toContain("ios-app://com.linkedin.LinkedIn/");
    expect(stats.num_referrers).toBe(1);
    // Domains panel still aggregates the rolled-up brand domain.
    expect(stats.referrer_hosts.find((r) => r.name === "linkedin.com")?.count).toBe(2);
  });
});

describe("ClickRepository.getDashboardStats", () => {
  it("returns totals and top lists", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { country: "US", deviceType: "desktop", browser: "Chrome" });
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

describe("ClickRepository.getStats with range filter", () => {
  it("returns all clicks when range is undefined", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { country: "US" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { country: "DE" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(2);
  });

  it("filters clicks by 7d range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    // Insert a recent click
    await ClickRepository.record(env.DB, slug, { country: "US" });
    // Insert an old click (30 days ago) by directly writing to DB
    const oldTs = Math.floor(Date.now() / 1000) - 30 * 86400;
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, country, link_mode) VALUES (?, ?, ?, ?)"
    ).bind(slug, oldTs, "DE", "link").run();

    const allStats = await ClickRepository.getStats(env.DB, link.id);
    expect(allStats.total_clicks).toBe(2);

    const filteredStats = await ClickRepository.getStats(env.DB, link.id, "7d");
    expect(filteredStats.total_clicks).toBe(1);
    expect(filteredStats.countries).toEqual([{ name: "US", count: 1 }]);
  });

  it("filters all breakdown fields by range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    // Recent click
    await ClickRepository.record(env.DB, slug, {
      country: "US",
      referrerHost: "google.com",
      os: "ios",
      browser: "Safari",
      deviceType: "mobile",
    });
    // Old click (60 days ago)
    const oldTs = Math.floor(Date.now() / 1000) - 60 * 86400;
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, country, referrer_host, os, browser, device_type, link_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(slug, oldTs, "DE", "facebook.com", "android", "Chrome", "desktop", "link").run();

    const stats = await ClickRepository.getStats(env.DB, link.id, "30d");
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([{ name: "US", count: 1 }]);
    expect(stats.referrer_hosts).toEqual([{ name: "google.com", count: 1 }]);
    expect(stats.os).toEqual([{ name: "ios", count: 1 }]);
    expect(stats.browsers).toEqual([{ name: "Safari", count: 1 }]);
    expect(stats.devices).toEqual([{ name: "mobile", count: 1 }]);
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
    await ClickRepository.record(env.DB, link.slugs[0].slug);
    await ClickRepository.record(env.DB, link.slugs[0].slug);
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "7d");
    expect(tl.summary.last_24h).toBe(2);
    expect(tl.summary.last_7d).toBe(2);
    expect(tl.summary.last_30d).toBe(2);
    expect(tl.summary.last_90d).toBe(2);
    expect(tl.summary.last_1y).toBe(2);
  });

  it("places click counts in the correct bucket", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug);
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

  it("all range returns buckets with granularity based on data span", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug);
    const tl = await ClickRepository.getTimeline(env.DB, link.id, "all");
    expect(tl.range).toBe("all");
    expect(tl.buckets.length).toBeGreaterThanOrEqual(1);
    // Accept daily (YYYY-MM-DD), weekly (YYYY-MM-DD), or monthly (YYYY-MM)
    expect(tl.buckets[0].label).toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
  });
});

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
