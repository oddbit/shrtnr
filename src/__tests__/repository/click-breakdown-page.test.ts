// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { BundleRepository, ClickRepository, LinkRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);
beforeEach(async () => {
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

// 12 distinct codes, recorded so the first gets the most clicks and the last
// the fewest, giving a deterministic count-descending order.
const CODES = ["US", "ID", "SE", "DE", "FR", "GB", "JP", "SG", "BR", "IN", "CA", "AU"];

async function recordDescendingCountries(slugFor: (i: number) => string) {
  for (let i = 0; i < CODES.length; i++) {
    for (let j = 0; j < CODES.length - i; j++) {
      await ClickRepository.record(env.DB, slugFor(i), { country: CODES[i] });
    }
  }
}

describe("ClickRepository.getLinkBreakdownPage", () => {
  it("pages through countries beyond the top 10 and reports the full total", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa" });
    const slug = link.slugs[0].slug;
    await recordDescendingCountries(() => slug);

    const page1 = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "countries", "all", 0, 10);
    expect(page1.total).toBe(12);
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0]).toEqual({ name: "US", count: 12 });

    const page2 = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "countries", "all", 10, 10);
    expect(page2.total).toBe(12);
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0].name).toBe("CA");

    // The two pages together cover every distinct country exactly once.
    const names = new Set([...page1.items, ...page2.items].map((x) => x.name));
    expect(names.size).toBe(12);
  });

  it("respects a custom limit smaller than the page default", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "lim" });
    const slug = link.slugs[0].slug;
    await recordDescendingCountries(() => slug);

    const page = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "countries", "all", 0, 3);
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(12);
    expect(page.items.map((x) => x.name)).toEqual(["US", "ID", "SE"]);
  });

  it("hides app-scheme referers from the sources breakdown and its total", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "src" });
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, { referrer: "https://news.example/a" });
    await ClickRepository.record(env.DB, slug, { referrer: "https://news.example/a" });
    await ClickRepository.record(env.DB, slug, { referrer: "https://blog.example/b" });
    await ClickRepository.record(env.DB, slug, { referrer: "android-app://com.linkedin.android/" });
    await ClickRepository.record(env.DB, slug, { referrer: "ios-app://123/" });

    const page = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "referrers", "all", 0, 10);
    expect(page.total).toBe(2);
    expect(page.items.map((x) => x.name)).toEqual(["https://news.example/a", "https://blog.example/b"]);
  });

  it("pages deterministically when many buckets share the same count", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "ties" });
    const slug = link.slugs[0].slug;
    // 15 countries, one click each: every count ties, so a stable tie-breaker
    // is the only thing keeping pages from overlapping or dropping rows.
    const codes = ["AA", "BB", "CC", "DD", "EE", "FF", "GG", "HH", "II", "JJ", "KK", "LL", "MM", "NN", "OO"];
    for (const code of codes) await ClickRepository.record(env.DB, slug, { country: code });

    const page1 = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "countries", "all", 0, 10);
    const page2 = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "countries", "all", 10, 10);
    expect(page1.items).toHaveLength(10);
    expect(page2.items).toHaveLength(5);
    const names = [...page1.items, ...page2.items].map((x) => x.name);
    // No duplicates and every country covered exactly once.
    expect(new Set(names).size).toBe(15);
    expect([...names].sort()).toEqual([...codes].sort());

    // Page one matches the top-10 the detail page renders from getStats, so the
    // server-rendered page and the paginated path agree at the boundary.
    const stats = await ClickRepository.getStats(env.DB, link.id, "all");
    expect(stats.countries.map((c) => c.name)).toEqual(page1.items.map((i) => i.name));
  });

  it("returns an empty page for a link with no clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "emp" });
    const page = await ClickRepository.getLinkBreakdownPage(env.DB, link.id, "countries", "all", 0, 10);
    expect(page).toEqual({ items: [], total: 0 });
  });
});

describe("ClickRepository.getBundleBreakdownPage", () => {
  it("aggregates a paginated breakdown across every link in the bundle", async () => {
    const l1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "b1", createdBy: "a@b" });
    const l2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "b2", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, l1.id);
    await BundleRepository.addLink(env.DB, bundle.id, l2.id);

    // Spread the countries across both member links.
    await recordDescendingCountries((i) => (i % 2 === 0 ? l1 : l2).slugs[0].slug);

    const page1 = await ClickRepository.getBundleBreakdownPage(env.DB, bundle.id, "countries", "all", 0, 10);
    expect(page1.total).toBe(12);
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0]).toEqual({ name: "US", count: 12 });

    const page2 = await ClickRepository.getBundleBreakdownPage(env.DB, bundle.id, "countries", "all", 10, 10);
    expect(page2.items).toHaveLength(2);
  });
});
