// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import {
  createLink,
  getLink,
  getLinkAnalytics,
  getLinkTimeline,
  getDashboardStats,
  deleteLink,
} from "../services/link-management";
import {
  getTrendingLinks,
  getGlobalBreakdown,
  getTotalClicks,
  getLinkBreakdown,
  compareLinkStats,
} from "../services/analytics";
import { ClickRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Helper: seed a link and record clicks ----

async function seedLink(url: string, label?: string) {
  const result = await createLink(env as never, { url, label });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function recordClicks(
  slugId: number,
  count: number,
  overrides: Partial<Parameters<typeof ClickRepository.record>[2]> = {},
) {
  for (let i = 0; i < count; i++) {
    await ClickRepository.record(env.DB, slugId, {
      country: overrides.country ?? "US",
      referrerHost: overrides.referrerHost ?? null,
      deviceType: overrides.deviceType ?? "desktop",
      os: overrides.os ?? "Windows",
      browser: overrides.browser ?? "Chrome",
      linkMode: overrides.linkMode ?? "link",
      ...overrides,
    });
  }
}

// ---- get_trending_links ----

describe("get_trending_links", () => {
  it("returns links sorted by click count in the given range", async () => {
    const linkA = await seedLink("https://a.com", "Link A");
    const linkB = await seedLink("https://b.com", "Link B");

    await recordClicks(linkA.slugs[0].id, 2);
    await recordClicks(linkB.slugs[0].id, 5);

    const result = await getTrendingLinks(env as never, "24h", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBe(2);
    expect(result.data[0].link_id).toBe(linkB.id);
    expect(result.data[0].clicks).toBe(5);
    expect(result.data[1].link_id).toBe(linkA.id);
    expect(result.data[1].clicks).toBe(2);
  });

  it("respects the limit parameter", async () => {
    const linkA = await seedLink("https://a.com", "A");
    const linkB = await seedLink("https://b.com", "B");
    const linkC = await seedLink("https://c.com", "C");

    await recordClicks(linkA.slugs[0].id, 3);
    await recordClicks(linkB.slugs[0].id, 2);
    await recordClicks(linkC.slugs[0].id, 1);

    const result = await getTrendingLinks(env as never, "24h", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBe(2);
  });

  it("returns empty array when no clicks exist", async () => {
    await seedLink("https://a.com");

    const result = await getTrendingLinks(env as never, "24h", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });
});

// ---- get_dashboard_stats (MCP exposure) ----

describe("get_dashboard_stats (service)", () => {
  it("returns total links, total clicks, and top lists", async () => {
    const link = await seedLink("https://example.com", "Test");
    await recordClicks(link.slugs[0].id, 3, { country: "SE" });

    const result = await getDashboardStats(env as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.total_links).toBe(1);
    expect(result.data.total_clicks).toBe(3);
    expect(result.data.top_countries.length).toBeGreaterThan(0);
    expect(result.data.top_countries[0].name).toBe("SE");
  });
});

// ---- get_link_timeline (MCP exposure) ----

describe("get_link_timeline (service)", () => {
  it("returns timeline buckets and summary for a link", async () => {
    const link = await seedLink("https://example.com");
    await recordClicks(link.slugs[0].id, 5);

    const result = await getLinkTimeline(env as never, link.id, "24h");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.range).toBe("24h");
    expect(result.data.buckets.length).toBeGreaterThan(0);
    expect(result.data.summary.last_24h).toBe(5);
  });

  it("returns 404 for nonexistent link", async () => {
    const result = await getLinkTimeline(env as never, 9999, "7d");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

// ---- get_clicks_by_country ----

describe("get_clicks_by_country", () => {
  it("returns cross-link country breakdown", async () => {
    const linkA = await seedLink("https://a.com");
    const linkB = await seedLink("https://b.com");

    await recordClicks(linkA.slugs[0].id, 3, { country: "US" });
    await recordClicks(linkB.slugs[0].id, 2, { country: "SE" });
    await recordClicks(linkB.slugs[0].id, 1, { country: "US" });

    const result = await getGlobalBreakdown(env as never, "country", "all", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBe(2);
    expect(result.data[0].name).toBe("US");
    expect(result.data[0].count).toBe(4);
    expect(result.data[1].name).toBe("SE");
    expect(result.data[1].count).toBe(2);
  });
});

// ---- get_clicks_by_referrer ----

describe("get_clicks_by_referrer", () => {
  it("returns cross-link referrer host breakdown", async () => {
    const link = await seedLink("https://a.com");

    await recordClicks(link.slugs[0].id, 3, { referrerHost: "twitter.com" });
    await recordClicks(link.slugs[0].id, 1, { referrerHost: "linkedin.com" });

    const result = await getGlobalBreakdown(env as never, "referrer_host", "all", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0].name).toBe("twitter.com");
    expect(result.data[0].count).toBe(3);
  });
});

// ---- get_clicks_by_device ----

describe("get_clicks_by_device", () => {
  it("returns cross-link device type breakdown", async () => {
    const link = await seedLink("https://a.com");

    await recordClicks(link.slugs[0].id, 4, { deviceType: "mobile" });
    await recordClicks(link.slugs[0].id, 2, { deviceType: "desktop" });

    const result = await getGlobalBreakdown(env as never, "device_type", "all", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0].name).toBe("mobile");
    expect(result.data[0].count).toBe(4);
  });

  it("supports os dimension", async () => {
    const link = await seedLink("https://a.com");
    await recordClicks(link.slugs[0].id, 3, { os: "iOS" });
    await recordClicks(link.slugs[0].id, 1, { os: "Android" });

    const result = await getGlobalBreakdown(env as never, "os", "all", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0].name).toBe("iOS");
  });

  it("supports browser dimension", async () => {
    const link = await seedLink("https://a.com");
    await recordClicks(link.slugs[0].id, 2, { browser: "Firefox" });

    const result = await getGlobalBreakdown(env as never, "browser", "all", 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data[0].name).toBe("Firefox");
  });
});

// ---- compare_links ----

describe("compare_links", () => {
  it("returns side-by-side stats for multiple links", async () => {
    const linkA = await seedLink("https://a.com", "Link A");
    const linkB = await seedLink("https://b.com", "Link B");

    await recordClicks(linkA.slugs[0].id, 5, { country: "US", referrerHost: "google.com" });
    await recordClicks(linkB.slugs[0].id, 3, { country: "SE", referrerHost: "twitter.com" });

    const result = await compareLinkStats(env as never, [linkA.id, linkB.id], "all");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBe(2);

    const a = result.data.find((r) => r.link_id === linkA.id)!;
    const b = result.data.find((r) => r.link_id === linkB.id)!;

    expect(a.total_clicks).toBe(5);
    expect(a.top_country).toBe("US");
    expect(a.top_referrer).toBe("google.com");

    expect(b.total_clicks).toBe(3);
    expect(b.top_country).toBe("SE");
    expect(b.top_referrer).toBe("twitter.com");
  });

  it("returns 404 when a link does not exist", async () => {
    const link = await seedLink("https://a.com");
    const result = await compareLinkStats(env as never, [link.id, 9999], "all");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

// ---- get_link_breakdown ----

describe("get_link_breakdown", () => {
  it("returns single-dimension breakdown with configurable limit", async () => {
    const link = await seedLink("https://a.com");

    await recordClicks(link.slugs[0].id, 5, { country: "US" });
    await recordClicks(link.slugs[0].id, 3, { country: "SE" });
    await recordClicks(link.slugs[0].id, 1, { country: "ID" });

    const result = await getLinkBreakdown(env as never, link.id, "country", "all", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBe(2);
    expect(result.data[0].name).toBe("US");
    expect(result.data[0].count).toBe(5);
    expect(result.data[1].name).toBe("SE");
    expect(result.data[1].count).toBe(3);
  });

  it("returns 404 for nonexistent link", async () => {
    const result = await getLinkBreakdown(env as never, 9999, "country", "all", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

// ---- get_total_clicks ----

describe("get_total_clicks", () => {
  it("returns total click count across all links", async () => {
    const linkA = await seedLink("https://a.com");
    const linkB = await seedLink("https://b.com");

    await recordClicks(linkA.slugs[0].id, 3);
    await recordClicks(linkB.slugs[0].id, 7);

    const result = await getTotalClicks(env as never, "all");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total_clicks).toBe(10);
  });

  it("returns 0 when no clicks exist", async () => {
    const result = await getTotalClicks(env as never, "all");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total_clicks).toBe(0);
  });
});

// ---- delete_link ----

describe("delete_link", () => {
  it("deletes a link with zero clicks", async () => {
    const link = await seedLink("https://deleteme.com");

    const result = await deleteLink(env as never, link.id);
    expect(result.ok).toBe(true);

    const get = await getLink(env as never, link.id);
    expect(get.ok).toBe(false);
  });

  it("refuses to delete a link with clicks", async () => {
    const link = await seedLink("https://clicked.com");
    await recordClicks(link.slugs[0].id, 1);

    const result = await deleteLink(env as never, link.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 404 for nonexistent link", async () => {
    const result = await deleteLink(env as never, 9999);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});
