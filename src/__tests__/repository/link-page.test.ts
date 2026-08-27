// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData, spyDb } from "../setup";
import { LinkRepository, SlugRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

const NOW = Math.floor(Date.now() / 1000);

async function seed(count: number, prefix = "s"): Promise<void> {
  for (let i = 0; i < count; i++) {
    await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `${prefix}${i}` });
  }
}

async function click(slug: string, at: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
  ).bind(slug, at).run();
}

describe("LinkRepository.page windowing", () => {
  it("returns at most `limit` rows and the unwindowed total", async () => {
    await seed(30);
    const result = await LinkRepository.page(env.DB, { limit: 25 });
    expect(result.links).toHaveLength(25);
    expect(result.total).toBe(30);
    expect(result.offset).toBe(0);
  });

  it("walks disjoint windows across pages", async () => {
    await seed(30);
    const first = await LinkRepository.page(env.DB, { limit: 25, offset: 0 });
    const second = await LinkRepository.page(env.DB, { limit: 25, offset: 25 });
    expect(second.links).toHaveLength(5);
    expect(second.offset).toBe(25);
    const firstIds = new Set(first.links.map((l) => l.id));
    expect(second.links.some((l) => firstIds.has(l.id))).toBe(false);
  });

  it("clamps an offset past the end to the last populated window", async () => {
    await seed(30);
    const result = await LinkRepository.page(env.DB, { limit: 25, offset: 500 });
    expect(result.offset).toBe(25);
    expect(result.links).toHaveLength(5);
    expect(result.total).toBe(30);
  });

  it("returns an empty page for a non-positive limit rather than the whole table", async () => {
    await seed(5);
    expect((await LinkRepository.page(env.DB, { limit: 0 })).links).toEqual([]);
    expect((await LinkRepository.page(env.DB, { limit: -3 })).links).toEqual([]);
  });

  it("costs three statements at 5 links and the same three at 60", async () => {
    await seed(5, "a");
    const small: string[] = [];
    await LinkRepository.page(spyDb(small), { limit: 25 });

    await seed(55, "b");
    const large: string[] = [];
    const result = await LinkRepository.page(spyDb(large), { limit: 25 });

    // Pin the absolute count, not just the equality: a regression to thirty
    // statements per render is equally flat across catalog sizes and would
    // satisfy an equality assertion on its own.
    expect(small).toHaveLength(3);
    expect(large).toHaveLength(3);
    expect(result.links).toHaveLength(25);
    expect(result.total).toBe(60);
  });

  it("computes the filtered, sorted window exactly once per render", async () => {
    await seed(30);
    const log: string[] = [];
    await LinkRepository.page(spyDb(log), { limit: 5, offset: 5, sort: "popular" });

    // Under sort=popular the window's ORDER BY is a correlated COUNT over
    // clicks joined to slugs, so re-running it to fetch the slugs doubles the
    // per-row aggregates. Only the link query may carry the window, and only
    // it may carry the link-level aggregate the ordering rests on. The slug
    // query has its own per-slug click_count, hence the narrower match.
    expect(log.filter((sql) => sql.includes("LIMIT ? OFFSET ?"))).toHaveLength(1);
    expect(log.filter((sql) => sql.includes("JOIN slugs cs"))).toHaveLength(1);
  });

  it("binds the served ids to fetch slugs, staying inside the D1 parameter cap", async () => {
    await seed(3);
    const log: string[] = [];
    const result = await LinkRepository.page(spyDb(log), { limit: 2 });

    const slugQuery = log.find((sql) => sql.includes("FROM slugs s WHERE s.link_id IN"));
    expect(slugQuery).toBeDefined();
    expect(slugQuery).toContain("IN (?,?)");
    expect(result.links).toHaveLength(2);
    expect(result.links.every((l) => l.slugs.length === 1)).toBe(true);
  });

  it("attaches every slug of the windowed links and no others", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "alias-one");
    await SlugRepository.addCustom(env.DB, link.id, "alias-two");
    const other = await LinkRepository.create(env.DB, { url: "https://other.com", slug: "xyz" });

    const result = await LinkRepository.page(env.DB, { limit: 1 });
    expect(result.links).toHaveLength(1);
    expect(result.links[0].id).toBe(other.id);
    expect(result.links[0].slugs.map((s) => s.slug)).toEqual(["xyz"]);

    const secondPage = await LinkRepository.page(env.DB, { limit: 1, offset: 1 });
    expect(secondPage.links[0].slugs.map((s) => s.slug).sort()).toEqual(["abc", "alias-one", "alias-two"]);
  });
});

describe("LinkRepository.page ordering", () => {
  it("orders by created_at descending with an id tie-break", async () => {
    for (let i = 0; i < 4; i++) {
      await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `s${i}` });
    }
    // Same second for every row: the id tie-break decides, so a window is stable.
    await env.DB.prepare("UPDATE links SET created_at = ?").bind(NOW).run();
    const first = await LinkRepository.page(env.DB, { limit: 2 });
    const second = await LinkRepository.page(env.DB, { limit: 2, offset: 2 });
    const ids = [...first.links, ...second.links].map((l) => l.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it("sorts popular by total clicks across the whole catalog, not just the first window", async () => {
    await seed(6);
    // The oldest link (s0) is the most clicked, so recent order would bury it
    // on the last page while popular order must surface it first.
    await click("s0", NOW - 60);
    await click("s0", NOW - 61);
    await click("s3", NOW - 62);

    const popular = await LinkRepository.page(env.DB, { limit: 2, sort: "popular" });
    expect(popular.links[0].slugs[0].slug).toBe("s0");
    expect(popular.links[0].total_clicks).toBe(2);
    expect(popular.links[1].slugs[0].slug).toBe("s3");
  });

  it("scopes popular ordering to the requested click window", async () => {
    await seed(3);
    // s0 dominates lifetime, s2 dominates the last 7 days.
    await click("s0", NOW - 60 * 86400);
    await click("s0", NOW - 61 * 86400);
    await click("s2", NOW - 3600);

    const lifetime = await LinkRepository.page(env.DB, { limit: 1, sort: "popular" });
    expect(lifetime.links[0].slugs[0].slug).toBe("s0");

    const week = await LinkRepository.page(
      env.DB,
      { limit: 1, sort: "popular" },
      { sinceTs: NOW - 7 * 86400 },
    );
    expect(week.links[0].slugs[0].slug).toBe("s2");
    expect(week.links[0].total_clicks).toBe(1);
  });

  it("excludes bot clicks from popular ordering when filtered", async () => {
    await seed(2);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 1, 0)",
    ).bind("s0", NOW - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 1, 0)",
    ).bind("s0", NOW - 61).run();
    await click("s1", NOW - 62);

    const filtered = await LinkRepository.page(
      env.DB,
      { limit: 1, sort: "popular" },
      { filters: { excludeBots: true } },
    );
    expect(filtered.links[0].slugs[0].slug).toBe("s1");
    expect(filtered.links[0].total_clicks).toBe(1);
  });
});

describe("LinkRepository.page status filter", () => {
  it("keeps only unexpired links for status active", async () => {
    const live = await LinkRepository.create(env.DB, { url: "https://live.com", slug: "live" });
    const expired = await LinkRepository.create(env.DB, { url: "https://dead.com", slug: "dead" });
    await LinkRepository.update(env.DB, expired.id, { expires_at: NOW - 10 });

    const result = await LinkRepository.page(env.DB, { limit: 25, status: "active", now: NOW });
    expect(result.total).toBe(1);
    expect(result.links.map((l) => l.id)).toEqual([live.id]);
  });

  it("keeps only expired links for status disabled", async () => {
    await LinkRepository.create(env.DB, { url: "https://live.com", slug: "live" });
    const expired = await LinkRepository.create(env.DB, { url: "https://dead.com", slug: "dead" });
    await LinkRepository.update(env.DB, expired.id, { expires_at: NOW - 10 });

    const result = await LinkRepository.page(env.DB, { limit: 25, status: "disabled", now: NOW });
    expect(result.total).toBe(1);
    expect(result.links.map((l) => l.id)).toEqual([expired.id]);
  });

  it("treats a future expiry as active", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://live.com", slug: "live" });
    await LinkRepository.update(env.DB, link.id, { expires_at: NOW + 3600 });
    expect((await LinkRepository.page(env.DB, { limit: 25, status: "active", now: NOW })).total).toBe(1);
    expect((await LinkRepository.page(env.DB, { limit: 25, status: "disabled", now: NOW })).total).toBe(0);
  });

  it("counts both for status all", async () => {
    await LinkRepository.create(env.DB, { url: "https://live.com", slug: "live" });
    const expired = await LinkRepository.create(env.DB, { url: "https://dead.com", slug: "dead" });
    await LinkRepository.update(env.DB, expired.id, { expires_at: NOW - 10 });
    expect((await LinkRepository.page(env.DB, { limit: 25, status: "all", now: NOW })).total).toBe(2);
  });

  it("pages the filtered set, so the window never mixes in excluded rows", async () => {
    for (let i = 0; i < 6; i++) {
      const link = await LinkRepository.create(env.DB, { url: `https://e${i}.com`, slug: `s${i}` });
      if (i % 2 === 0) await LinkRepository.update(env.DB, link.id, { expires_at: NOW - 10 });
    }
    const result = await LinkRepository.page(env.DB, { limit: 2, status: "active", now: NOW });
    expect(result.total).toBe(3);
    expect(result.links).toHaveLength(2);
    expect(result.links.every((l) => l.expires_at === null)).toBe(true);
  });
});

describe("LinkRepository.page search", () => {
  it("matches label, url and slug", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/docs", slug: "aaa", label: "Handbook" });
    await LinkRepository.create(env.DB, { url: "https://other.test/x", slug: "handy", label: null });
    await LinkRepository.create(env.DB, { url: "https://nomatch.test/x", slug: "zzz", label: null });

    expect((await LinkRepository.page(env.DB, { limit: 25, search: "handbook" })).total).toBe(1);
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "example.com" })).total).toBe(1);
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "hand" })).total).toBe(2);
  });

  it("matches created_by only when searchOwner is set", async () => {
    await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "aaa",
      createdBy: "dennis@example.com",
    });
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "dennis" })).total).toBe(0);
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "dennis", searchOwner: true })).total).toBe(1);
  });

  it("counts a link once even when several of its slugs match", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "promo-a" });
    await SlugRepository.addCustom(env.DB, link.id, "promo-b");
    await SlugRepository.addCustom(env.DB, link.id, "promo-c");

    const result = await LinkRepository.page(env.DB, { limit: 25, search: "promo" });
    expect(result.total).toBe(1);
    expect(result.links).toHaveLength(1);
  });

  it("treats LIKE metacharacters as literals", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/50%25-off", slug: "aaa" });
    await LinkRepository.create(env.DB, { url: "https://example.com/plain", slug: "bbb" });
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "%" })).total).toBe(1);
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "_" })).total).toBe(0);
  });

  it("returns nothing for a blank search", async () => {
    await seed(3);
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "   " })).total).toBe(0);
    expect((await LinkRepository.page(env.DB, { limit: 25, search: "" })).total).toBe(0);
  });

  it("windows search results instead of loading every match", async () => {
    await seed(30, "match");
    const result = await LinkRepository.page(env.DB, { limit: 10, search: "match" });
    expect(result.total).toBe(30);
    expect(result.links).toHaveLength(10);
  });

  it("combines search with the status filter", async () => {
    const live = await LinkRepository.create(env.DB, { url: "https://example.com/a", slug: "keep-a" });
    const dead = await LinkRepository.create(env.DB, { url: "https://example.com/b", slug: "keep-b" });
    await LinkRepository.update(env.DB, dead.id, { expires_at: NOW - 10 });

    const active = await LinkRepository.page(env.DB, { limit: 25, search: "keep", status: "active", now: NOW });
    expect(active.links.map((l) => l.id)).toEqual([live.id]);
    const all = await LinkRepository.page(env.DB, { limit: 25, search: "keep", status: "all", now: NOW });
    expect(all.total).toBe(2);
  });
});

describe("LinkRepository.count", () => {
  it("counts the catalog ignoring the status filter", async () => {
    await seed(3);
    const expired = await LinkRepository.create(env.DB, { url: "https://dead.com", slug: "dead" });
    await LinkRepository.update(env.DB, expired.id, { expires_at: NOW - 10 });
    expect(await LinkRepository.count(env.DB)).toBe(4);
  });

  it("counts search matches", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "aaa", label: "Handbook" });
    await LinkRepository.create(env.DB, { url: "https://other.test", slug: "bbb" });
    expect(await LinkRepository.count(env.DB, { search: "handbook" })).toBe(1);
    expect(await LinkRepository.count(env.DB, { search: "nothing" })).toBe(0);
  });

  it("agrees with page().total under every filter combination", async () => {
    // page() derives its total from count(), so the empty-state count the
    // service takes and the total the toolbar renders cannot disagree.
    await seed(4, "live");
    const expired = await LinkRepository.create(env.DB, { url: "https://dead.com", slug: "dead-one" });
    await LinkRepository.update(env.DB, expired.id, { expires_at: NOW - 10 });

    const cases = [
      {},
      { status: "active" as const },
      { status: "disabled" as const },
      { status: "all" as const },
      { search: "live" },
      { search: "dead", status: "disabled" as const },
      { search: "nomatch" },
    ];
    for (const query of cases) {
      const paged = await LinkRepository.page(env.DB, { ...query, limit: 2, now: NOW });
      expect(paged.total).toBe(await LinkRepository.count(env.DB, { ...query, now: NOW }));
    }
  });
});

describe("LinkRepository.page reference time", () => {
  it("counts and windows against one `now`, so a link expiring mid-request cannot skew the total", async () => {
    // count() and the row query are separate statements. Each read the clock
    // for itself, so a link whose expires_at fell between the two reads was
    // counted as active and then excluded from the rows: total 1, links 0.
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "a" });
    const expiresAt = NOW + 5;
    await env.DB.prepare("UPDATE links SET expires_at = ? WHERE id = ?").bind(expiresAt, link.id).run();

    // First clock read lands before the expiry, every later one after it.
    let reads = 0;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => (reads++ === 0 ? expiresAt - 1 : expiresAt + 1) * 1000);
    try {
      const result = await LinkRepository.page(env.DB, { limit: 25, status: "active" });
      expect(result.links).toHaveLength(result.total);
      expect(result.total).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
