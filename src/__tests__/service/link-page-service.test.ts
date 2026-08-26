// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository } from "../../db";
import { listLinksPage } from "../../services";
import { LINKS_MAX_PER_PAGE } from "../../constants";

beforeAll(applyMigrations);
beforeEach(resetData);

const NOW = Math.floor(Date.now() / 1000);

async function seed(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `s${i}` });
  }
}

describe("listLinksPage", () => {
  it("returns one window plus the page arithmetic", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 1, perPage: 25 });
    expect(result.links).toHaveLength(25);
    expect(result.total).toBe(30);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
  });

  it("clamps a page past the end and reports the page it served", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 99, perPage: 25 });
    expect(result.page).toBe(2);
    expect(result.links).toHaveLength(5);
  });

  it("clamps perPage to the maximum so a crafted query cannot request the catalog", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 1, perPage: 100000 });
    expect(result.perPage).toBe(LINKS_MAX_PER_PAGE);
    expect(result.links.length).toBeLessThanOrEqual(LINKS_MAX_PER_PAGE);
  });

  it("clamps a non-positive perPage to one row", async () => {
    await seed(3);
    const result = await listLinksPage(env as never, { page: 1, perPage: -5 });
    expect(result.perPage).toBe(1);
    expect(result.links).toHaveLength(1);
    expect(result.totalPages).toBe(3);
  });

  it("attaches deltas to the served rows only", async () => {
    await seed(2);
    const insert = env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)");
    await insert.bind("s1", NOW - 60).run();
    await insert.bind("s1", NOW - 40 * 86400).run();

    const result = await listLinksPage(env as never, { page: 1, perPage: 1, withDeltaRange: "30d", range: "30d" });
    expect(result.links).toHaveLength(1);
    expect(result.links[0].delta_pct).toBe(0);
  });

  it("reports no-links for an empty catalog", async () => {
    const result = await listLinksPage(env as never, { page: 1, perPage: 25 });
    expect(result.total).toBe(0);
    expect(result.emptyReason).toBe("no-links");
    expect(result.totalPages).toBe(1);
  });

  it("reports all-disabled when the active filter hid every link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await LinkRepository.update(env.DB, link.id, { expires_at: NOW - 10 });
    const result = await listLinksPage(env as never, { page: 1, perPage: 25, status: "active" });
    expect(result.total).toBe(0);
    expect(result.emptyReason).toBe("all-disabled");
  });

  it("reports no-matches when the disabled filter finds nothing to show", async () => {
    // The inverse of the case above: every link is active, so "all links are
    // disabled" would state the opposite of the truth.
    await seed(3);
    const result = await listLinksPage(env as never, { page: 1, perPage: 25, status: "disabled" });
    expect(result.total).toBe(0);
    expect(result.emptyReason).toBe("no-matches");
  });

  it("reports no-search-matches when a search finds nothing in a populated catalog", async () => {
    // The search is what emptied the window, so the reason has to say so: the
    // page cannot tell a search-emptied result from a filter-emptied one once
    // both arrive as the same reason.
    await seed(3);
    const result = await listLinksPage(env as never, { page: 1, perPage: 25, search: "xyzzy-nothing" });
    expect(result.emptyReason).toBe("no-search-matches");
  });

  it("reports no-search-matches when a status filter is narrowing alongside the search", async () => {
    await seed(3);
    const result = await listLinksPage(env as never, {
      page: 1,
      perPage: 25,
      status: "disabled",
      search: "xyzzy-nothing",
    });
    expect(result.emptyReason).toBe("no-search-matches");
  });

  it("reports no-links for an empty catalog even under a search", async () => {
    const result = await listLinksPage(env as never, { page: 1, perPage: 25, search: "anything" });
    expect(result.emptyReason).toBe("no-links");
  });

  it("names a reason whenever the served window is empty, not only when the total is zero", async () => {
    // The total and the window come from separate statements. Deleting rows
    // between them leaves a positive total with nothing to render, and the
    // page would otherwise print "30 links" above "No links yet".
    await seed(3);
    const result = await listLinksPage(env as never, { page: 1, perPage: 25, status: "disabled" });
    expect(result.links).toHaveLength(0);
    expect(result.emptyReason).toBeDefined();
  });

  it("owns every page and per-page guard, whatever the route hands over", async () => {
    await seed(30);
    // The route parses query params and does not clamp them, so the service is
    // the single place these rules live.
    for (const page of [0, -3, 0.5, NaN]) {
      const result = await listLinksPage(env as never, { page, perPage: 25 });
      expect(result.page).toBe(1);
      expect(result.links).toHaveLength(25);
    }
    for (const perPage of [0, -5, NaN]) {
      const result = await listLinksPage(env as never, { page: 1, perPage });
      expect(result.perPage).toBeGreaterThanOrEqual(1);
    }
  });

  it("leaves emptyReason unset when the window has rows", async () => {
    await seed(1);
    const result = await listLinksPage(env as never, { page: 1, perPage: 25 });
    expect(result.emptyReason).toBeUndefined();
  });

  it("windows a search instead of loading every match", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 2, perPage: 10, search: "example", includeOwner: true });
    expect(result.total).toBe(30);
    expect(result.links).toHaveLength(10);
    expect(result.totalPages).toBe(3);
  });
});
