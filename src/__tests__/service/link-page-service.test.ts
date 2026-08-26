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
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.links).toHaveLength(25);
    expect(result.data.total).toBe(30);
    expect(result.data.totalPages).toBe(2);
    expect(result.data.page).toBe(1);
  });

  it("clamps a page past the end and reports the page it served", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 99, perPage: 25 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.page).toBe(2);
    expect(result.data.links).toHaveLength(5);
  });

  it("clamps perPage to the maximum so a crafted query cannot request the catalog", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 1, perPage: 100000 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.perPage).toBe(LINKS_MAX_PER_PAGE);
    expect(result.data.links.length).toBeLessThanOrEqual(LINKS_MAX_PER_PAGE);
  });

  it("clamps a non-positive perPage to one row", async () => {
    await seed(3);
    const result = await listLinksPage(env as never, { page: 1, perPage: -5 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.perPage).toBe(1);
    expect(result.data.links).toHaveLength(1);
    expect(result.data.totalPages).toBe(3);
  });

  it("attaches deltas to the served rows only", async () => {
    await seed(2);
    const insert = env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)");
    await insert.bind("s1", NOW - 60).run();
    await insert.bind("s1", NOW - 40 * 86400).run();

    const result = await listLinksPage(env as never, { page: 1, perPage: 1, withDeltaRange: "30d", range: "30d" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.links).toHaveLength(1);
    expect(result.data.links[0].delta_pct).toBe(0);
  });

  it("reports no-links for an empty catalog", async () => {
    const result = await listLinksPage(env as never, { page: 1, perPage: 25 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.total).toBe(0);
    expect(result.data.emptyReason).toBe("no-links");
    expect(result.data.totalPages).toBe(1);
  });

  it("reports all-filtered when the status filter hid every link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await LinkRepository.update(env.DB, link.id, { expires_at: NOW - 10 });
    const result = await listLinksPage(env as never, { page: 1, perPage: 25, status: "active" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.total).toBe(0);
    expect(result.data.emptyReason).toBe("all-filtered");
  });

  it("leaves emptyReason unset when the window has rows", async () => {
    await seed(1);
    const result = await listLinksPage(env as never, { page: 1, perPage: 25 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.emptyReason).toBeUndefined();
  });

  it("windows a search instead of loading every match", async () => {
    await seed(30);
    const result = await listLinksPage(env as never, { page: 2, perPage: 10, search: "example", includeOwner: true });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.total).toBe(30);
    expect(result.data.links).toHaveLength(10);
    expect(result.data.totalPages).toBe(3);
  });
});
