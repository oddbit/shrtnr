import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, ClickRepository } from "../db";
import { computeDelta } from "../services/trends";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("computeDelta", () => {
  it("returns undefined when there is no baseline to compare against", () => {
    expect(computeDelta(0, 0)).toBeUndefined();
    expect(computeDelta(50, 0)).toBeUndefined();
  });

  it("returns positive percent when current is higher than previous", () => {
    expect(computeDelta(120, 100)).toBe(20);
  });

  it("returns negative percent when current is lower than previous", () => {
    expect(computeDelta(80, 100)).toBe(-20);
  });

  it("returns 0 when current equals a non-zero previous", () => {
    expect(computeDelta(100, 100)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    expect(computeDelta(107, 100)).toBe(7);
    expect(computeDelta(93, 100)).toBe(-7);
  });
});

describe("ClickRepository.getPeriodClicks", () => {
  it("splits clicks into current and previous periods", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // Insert clicks at specific timestamps.
    // Current 24h window: now-86400 .. now.
    // Previous 24h window: now-172800 .. now-86400.
    const insertClick = async (t: number) =>
      env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, t).run();

    // 3 current clicks
    await insertClick(now - 100);
    await insertClick(now - 200);
    await insertClick(now - 300);
    // 1 previous click
    await insertClick(now - 90000);

    const result = await ClickRepository.getPeriodClicks(env.DB, "24h", now);
    expect(result.current).toBe(3);
    expect(result.previous).toBe(1);
  });

  it("returns 0 for previous when range is all", async () => {
    const result = await ClickRepository.getPeriodClicks(env.DB, "all");
    expect(result.previous).toBe(0);
  });

  it("counts per-link when linkId is given", async () => {
    const a = await LinkRepository.create(env.DB, { url: "https://a.example", slug: "aaa" });
    const b = await LinkRepository.create(env.DB, { url: "https://b.example", slug: "bbb" });
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(a.slugs[0].slug, now - 100).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(a.slugs[0].slug, now - 200).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(b.slugs[0].slug, now - 100).run();

    const resA = await ClickRepository.getPeriodClicks(env.DB, "24h", now, a.id);
    expect(resA.current).toBe(2);
    const resB = await ClickRepository.getPeriodClicks(env.DB, "24h", now, b.id);
    expect(resB.current).toBe(1);
  });
});

describe("ClickRepository.attachLinkDeltasBulk", () => {
  it("returns empty array for empty input", async () => {
    const result = await ClickRepository.attachLinkDeltasBulk(env.DB, [], "30d");
    expect(result).toEqual([]);
  });

  it("returns links unchanged when range is all", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const result = await ClickRepository.attachLinkDeltasBulk(env.DB, [link], "all");
    expect(result[0].delta_pct).toBeUndefined();
  });

  it("computes per-link delta across current and previous windows", async () => {
    const a = await LinkRepository.create(env.DB, { url: "https://a.example", slug: "aaa" });
    const b = await LinkRepository.create(env.DB, { url: "https://b.example", slug: "bbb" });
    const now = Math.floor(Date.now() / 1000);
    const insertClick = (slug: string, t: number) =>
      env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, t).run();

    // Link a: 10 in current 24h, 5 in previous 24h => +100%
    for (let i = 0; i < 10; i++) await insertClick(a.slugs[0].slug, now - i * 60);
    for (let i = 0; i < 5; i++) await insertClick(a.slugs[0].slug, now - 86401 - i * 60);
    // Link b: 3 in current 24h, 6 in previous 24h => -50%
    for (let i = 0; i < 3; i++) await insertClick(b.slugs[0].slug, now - i * 60);
    for (let i = 0; i < 6; i++) await insertClick(b.slugs[0].slug, now - 86401 - i * 60);

    const [outA, outB] = await ClickRepository.attachLinkDeltasBulk(env.DB, [a, b], "24h", now);
    expect(outA.delta_pct).toBe(100);
    expect(outB.delta_pct).toBe(-50);
  });

  it("leaves delta undefined for a link with no clicks in either window", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const [out] = await ClickRepository.attachLinkDeltasBulk(env.DB, [link], "24h");
    expect(out.delta_pct).toBeUndefined();
  });

  it("leaves delta undefined when previous window is zero but current has clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(link.slugs[0].slug, now - i * 60).run();
    }
    const [out] = await ClickRepository.attachLinkDeltasBulk(env.DB, [link], "24h", now);
    expect(out.delta_pct).toBeUndefined();
  });
});

describe("getDashboardStats with trends", () => {
  it("includes delta_pct for total clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // 10 in current 30d
    for (let i = 0; i < 10; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - i * 3600).run();
    }
    // 5 in previous 30d (30-60 days ago)
    for (let i = 0; i < 5; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - (35 + i) * 86400).run();
    }

    const stats = await ClickRepository.getDashboardStats(env.DB, "30d", now);
    expect(stats.total_clicks).toBe(10);
    expect(stats.total_clicks_delta).toBe(100); // 10 vs 5 => +100%
  });
});

describe("getDashboardStats range-filtered breakdowns", () => {
  it("filters top_countries by range window", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // Recent clicks within 7d
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - i * 3600, "US").run();
    }
    // Older clicks outside 7d
    for (let i = 0; i < 5; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - (30 + i) * 86400, "DE").run();
    }

    const stats7d = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats7d.top_countries).toEqual([{ name: "US", count: 3 }]);

    const statsAll = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(statsAll.top_countries).toEqual([
      { name: "DE", count: 5 },
      { name: "US", count: 3 },
    ]);
  });

  it("filters top_referrers by range window", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < 2; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, referrer_host) VALUES (?, ?, ?)").bind(slug, now - i * 3600, "twitter.com").run();
    }
    for (let i = 0; i < 4; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, referrer_host) VALUES (?, ?, ?)").bind(slug, now - (40 + i) * 86400, "old.example.com").run();
    }

    const stats30d = await ClickRepository.getDashboardStats(env.DB, "30d", now);
    expect(stats30d.top_referrers).toEqual([{ name: "twitter.com", count: 2 }]);
  });

  it("ranks top_links by clicks within the range window", async () => {
    const linkA = await LinkRepository.create(env.DB, { url: "https://a.example.com", slug: "aaa" });
    const linkB = await LinkRepository.create(env.DB, { url: "https://b.example.com", slug: "bbb" });
    const slugA = linkA.slugs[0].slug;
    const slugB = linkB.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // linkA: 2 recent + 100 very old
    for (let i = 0; i < 2; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slugA, now - i * 3600).run();
    }
    for (let i = 0; i < 100; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slugA, now - (200 + i) * 86400).run();
    }
    // linkB: 10 recent
    for (let i = 0; i < 10; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slugB, now - i * 3600).run();
    }

    const stats7d = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats7d.top_links).toHaveLength(2);
    expect(stats7d.top_links[0].id).toBe(linkB.id);
    expect(stats7d.top_links[0].total_clicks).toBe(10);
    expect(stats7d.top_links[1].id).toBe(linkA.id);
    expect(stats7d.top_links[1].total_clicks).toBe(2);

    const statsAll = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(statsAll.top_links[0].id).toBe(linkA.id);
    expect(statsAll.top_links[0].total_clicks).toBe(102);
  });

  it("counts total_links within the range window, lifetime when range is all", async () => {
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < 2; i++) {
      await env.DB
        .prepare("INSERT INTO links (url, created_at) VALUES (?, ?)")
        .bind(`https://recent${i}.example.com`, now - i * 3600)
        .run();
    }
    for (let i = 0; i < 3; i++) {
      await env.DB
        .prepare("INSERT INTO links (url, created_at) VALUES (?, ?)")
        .bind(`https://old${i}.example.com`, now - (30 + i) * 86400)
        .run();
    }

    const stats7d = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats7d.total_links).toBe(2);

    const statsAll = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(statsAll.total_links).toBe(5);
  });
});

describe("getDashboardStats clicks_per_day", () => {
  it("averages clicks across the window length", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // 60 clicks inside the last 30d
    for (let i = 0; i < 60; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - i * 3600).run();
    }

    const stats = await ClickRepository.getDashboardStats(env.DB, "30d", now);
    expect(stats.clicks_per_day).toBe(2); // 60 / 30
  });

  it("computes delta against the previous window's daily average", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // 90 clicks within the last 24h (well inside the 30d current window) => 3/day across 30d
    for (let i = 0; i < 90; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - i * 60).run();
    }
    // 30 clicks centered at 45d ago (well inside the previous 30d window) => 1/day across 30d
    for (let i = 0; i < 30; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - 45 * 86400 - i * 60).run();
    }

    const stats = await ClickRepository.getDashboardStats(env.DB, "30d", now);
    expect(stats.clicks_per_day).toBe(3);
    expect(stats.clicks_per_day_delta).toBe(200); // 3 vs 1 => +200%
  });

  it("suppresses delta when the previous window has no clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 10; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - i * 3600).run();
    }
    const stats = await ClickRepository.getDashboardStats(env.DB, "30d", now);
    expect(stats.clicks_per_day_delta).toBeUndefined();
  });

  it("averages against total window span for range=all", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // 20 clicks spanning roughly 10 days
    for (let i = 0; i < 20; i++) {
      await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - i * 12 * 3600).run();
    }

    const stats = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(stats.clicks_per_day).toBeGreaterThan(0);
    expect(stats.clicks_per_day_delta).toBeUndefined();
  });
});

describe("getDashboardStats num_domains", () => {
  it("counts distinct destination hostnames among links in the current window", async () => {
    const now = Math.floor(Date.now() / 1000);

    // Recent (within 7d): 3 urls on 2 distinct hosts
    await env.DB.prepare("INSERT INTO links (url, created_at) VALUES (?, ?)").bind("https://example.com/a", now - 100).run();
    await env.DB.prepare("INSERT INTO links (url, created_at) VALUES (?, ?)").bind("https://example.com/b", now - 200).run();
    await env.DB.prepare("INSERT INTO links (url, created_at) VALUES (?, ?)").bind("https://other.com/c", now - 300).run();
    // Old (outside 7d): different host
    await env.DB.prepare("INSERT INTO links (url, created_at) VALUES (?, ?)").bind("https://old.com/d", now - 30 * 86400).run();

    const stats7d = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats7d.num_domains).toBe(2);

    const statsAll = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(statsAll.num_domains).toBe(3);
  });

  it("returns 0 for range=all when there are no links", async () => {
    const now = Math.floor(Date.now() / 1000);
    const stats = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(stats.num_domains).toBe(0);
  });
});

describe("getDashboardStats num_countries", () => {
  it("counts distinct click countries within the current window", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);

    // Recent clicks (within 7d): 3 distinct countries (plus a duplicate)
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - 100, "US").run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - 200, "US").run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - 300, "SE").run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - 400, "ID").run();
    // Null country should not count.
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(slug, now - 500).run();
    // Older click outside the 7d window.
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country) VALUES (?, ?, ?)").bind(slug, now - 30 * 86400, "DE").run();

    const stats7d = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats7d.num_countries).toBe(3);

    const statsAll = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(statsAll.num_countries).toBe(4);
  });
});

describe("getDashboardStats clicked_links", () => {
  it("counts distinct links that received clicks in the current window", async () => {
    const linkA = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa" });
    const linkB = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb" });
    const linkC = await LinkRepository.create(env.DB, { url: "https://c.com", slug: "ccc" });
    const now = Math.floor(Date.now() / 1000);

    // A is clicked twice, B is clicked once, C has no clicks.
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkA.slugs[0].slug, now - 100).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkA.slugs[0].slug, now - 200).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkB.slugs[0].slug, now - 300).run();
    void linkC;

    const stats = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats.clicked_links).toBe(2);
  });

  it("scopes the count to the current window", async () => {
    const linkA = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa" });
    const linkB = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb" });
    const now = Math.floor(Date.now() / 1000);

    // A clicked inside 7d; B clicked 30d ago (outside 7d).
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkA.slugs[0].slug, now - 100).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkB.slugs[0].slug, now - 30 * 86400).run();

    const stats7d = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats7d.clicked_links).toBe(1);

    const statsAll = await ClickRepository.getDashboardStats(env.DB, "all", now);
    expect(statsAll.clicked_links).toBe(2);
  });

  it("computes delta against the previous window's distinct-link count", async () => {
    const linkA = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa" });
    const linkB = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb" });
    const linkC = await LinkRepository.create(env.DB, { url: "https://c.com", slug: "ccc" });
    const now = Math.floor(Date.now() / 1000);

    // Current 7d: 2 distinct links clicked (A, B)
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkA.slugs[0].slug, now - 100).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkB.slugs[0].slug, now - 200).run();
    // Previous 7d: 1 distinct link (C)
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkC.slugs[0].slug, now - 10 * 86400).run();

    const stats = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats.clicked_links).toBe(2);
    expect(stats.clicked_links_delta).toBe(100);
  });

  it("suppresses delta when the previous window has no clicked links", async () => {
    const linkA = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa" });
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)").bind(linkA.slugs[0].slug, now - 100).run();
    const stats = await ClickRepository.getDashboardStats(env.DB, "7d", now);
    expect(stats.clicked_links).toBe(1);
    expect(stats.clicked_links_delta).toBeUndefined();
  });
});
