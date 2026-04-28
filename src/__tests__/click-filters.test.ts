// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, ClickRepository, BundleRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

// A fixture with one bot click, one self-referrer click, and two "real" clicks.
async function seedClicksMixed(slug: string): Promise<void> {
  await ClickRepository.record(env.DB, slug, {
    referrer: "https://pub.dev/",
    referrerHost: "pub.dev",
    country: "US",
    deviceType: "desktop",
    browser: "Chrome",
    os: "macos",
    isBot: 0,
    isSelfReferrer: 0,
  });
  await ClickRepository.record(env.DB, slug, {
    referrer: "https://github.com/oddbit/shrtnr",
    referrerHost: "github.com",
    country: "SE",
    deviceType: "desktop",
    browser: "Firefox",
    os: "linux",
    isBot: 0,
    isSelfReferrer: 0,
  });
  await ClickRepository.record(env.DB, slug, {
    referrer: "https://shrtnr.test/",
    referrerHost: "shrtnr.test",
    country: "ID",
    deviceType: "mobile",
    browser: "Safari",
    os: "ios",
    isBot: 0,
    isSelfReferrer: 1,
  });
  await ClickRepository.record(env.DB, slug, {
    referrer: "https://crawler.example/",
    referrerHost: "crawler.example",
    country: "US",
    deviceType: "desktop",
    browser: "Bot",
    os: "linux",
    isBot: 1,
    isSelfReferrer: 0,
  });
}

describe("ClickRepository.getStats: ClickFilters", () => {
  it("no filter passed: all clicks counted everywhere", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f1a" });
    await seedClicksMixed(link.slugs[0].slug);

    const stats = await ClickRepository.getStats(env.DB, link.id);

    expect(stats.total_clicks).toBe(4);
    expect(stats.referrer_hosts.map((r) => r.name).sort()).toEqual(
      ["crawler.example", "github.com", "pub.dev", "shrtnr.test"],
    );
    expect(stats.countries.find((c) => c.name === "US")?.count).toBe(2);
  });

  it("excludeBots=true: bot clicks drop from totals, breakdowns, and distinct counts", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f1b" });
    await seedClicksMixed(link.slugs[0].slug);

    const stats = await ClickRepository.getStats(env.DB, link.id, undefined, {
      excludeBots: true,
    });

    expect(stats.total_clicks).toBe(3);
    expect(stats.referrer_hosts.map((r) => r.name)).not.toContain("crawler.example");
    expect(stats.browsers.map((b) => b.name)).not.toContain("Bot");
  });

  it("excludeSelfReferrers=true: self-referrer clicks drop from totals and breakdowns", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f1c" });
    await seedClicksMixed(link.slugs[0].slug);

    const stats = await ClickRepository.getStats(env.DB, link.id, undefined, {
      excludeSelfReferrers: true,
    });

    expect(stats.total_clicks).toBe(3);
    expect(stats.referrer_hosts.map((r) => r.name)).not.toContain("shrtnr.test");
    // A self-referrer click from ID contributed; with the filter on, ID drops out.
    expect(stats.countries.find((c) => c.name === "ID")).toBeUndefined();
  });

  it("both filters on: only the two real clicks remain", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f1d" });
    await seedClicksMixed(link.slugs[0].slug);

    const stats = await ClickRepository.getStats(env.DB, link.id, undefined, {
      excludeBots: true,
      excludeSelfReferrers: true,
    });

    expect(stats.total_clicks).toBe(2);
    expect(stats.referrer_hosts.map((r) => r.name).sort()).toEqual(["github.com", "pub.dev"]);
  });
});

describe("ClickRepository.getDashboardStats: ClickFilters", () => {
  it("both filters on: KPIs, breakdowns and top-links all drop bot + self-referrer clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f2a" });
    await seedClicksMixed(link.slugs[0].slug);

    const stats = await ClickRepository.getDashboardStats(env.DB, "all", undefined, {
      excludeBots: true,
      excludeSelfReferrers: true,
    });

    expect(stats.total_clicks).toBe(2);
    expect(stats.top_referrers.map((r) => r.name).sort()).toEqual(["github.com", "pub.dev"]);
    expect(stats.num_referrers).toBe(2);
  });

  it("no filter passed: every click counted in dashboard totals and breakdowns", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f2b" });
    await seedClicksMixed(link.slugs[0].slug);

    const stats = await ClickRepository.getDashboardStats(env.DB, "all");

    expect(stats.total_clicks).toBe(4);
    expect(stats.top_referrers.map((r) => r.name)).toContain("shrtnr.test");
    expect(stats.top_referrers.map((r) => r.name)).toContain("crawler.example");
  });

  it("recent_links[].total_clicks honors filters so cards match the filtered KPIs", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f2c" });
    await seedClicksMixed(link.slugs[0].slug);

    const filtered = await ClickRepository.getDashboardStats(env.DB, "all", undefined, {
      excludeBots: true,
      excludeSelfReferrers: true,
    });
    const raw = await ClickRepository.getDashboardStats(env.DB, "all");

    expect(raw.recent_links[0].total_clicks).toBe(4);
    expect(filtered.recent_links[0].total_clicks).toBe(2);
  });

  it("recent_links[].total_clicks honors the selected time range", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f2d" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();

    const all = await ClickRepository.getDashboardStats(env.DB, "all", now);
    const last7 = await ClickRepository.getDashboardStats(env.DB, "7d", now);

    expect(all.recent_links[0].total_clicks).toBe(2);
    expect(last7.recent_links[0].total_clicks).toBe(1);
  });
});

describe("ClickRepository.getBundleStats: ClickFilters", () => {
  it("both filters on: bundle totals, per-link, and breakdowns drop bot + self-referrer", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f3a" });
    await seedClicksMixed(link.slugs[0].slug);
    const bundle = await BundleRepository.create(env.DB, {
      name: "Filter Bundle",
      accent: "orange",
      icon: "link",
      createdBy: "test@example.com",
    });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);

    const stats = await ClickRepository.getBundleStats(env.DB, bundle.id, "all", undefined, {
      excludeBots: true,
      excludeSelfReferrers: true,
    });

    expect(stats).not.toBeNull();
    expect(stats!.total_clicks).toBe(2);
    expect(stats!.referrer_hosts.map((r) => r.name).sort()).toEqual(["github.com", "pub.dev"]);
    expect(stats!.per_link[0]?.click_count).toBe(2);
  });
});

describe("ClickRepository.getTotalClicks / getGlobalBreakdown: ClickFilters", () => {
  it("getTotalClicks respects both filters", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f4a" });
    await seedClicksMixed(link.slugs[0].slug);

    const filtered = await ClickRepository.getTotalClicks(env.DB, "all", {
      excludeBots: true,
      excludeSelfReferrers: true,
    });
    const raw = await ClickRepository.getTotalClicks(env.DB, "all");

    expect(raw).toBe(4);
    expect(filtered).toBe(2);
  });

  it("getGlobalBreakdown(country) drops countries contributed only by filtered clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "f4b" });
    await seedClicksMixed(link.slugs[0].slug);

    const filtered = await ClickRepository.getGlobalBreakdown(env.DB, "country", "all", 10, {
      excludeBots: true,
      excludeSelfReferrers: true,
    });

    const names = filtered.map((c) => c.name).sort();
    expect(names).toEqual(["SE", "US"]);
    expect(names).not.toContain("ID");
  });
});
