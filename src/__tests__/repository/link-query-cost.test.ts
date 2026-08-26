// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData, spyDb } from "../setup";
import { LinkRepository, SlugRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

async function seed(count: number, prefix: string, owner?: string): Promise<void> {
  for (let i = 0; i < count; i++) {
    await LinkRepository.create(env.DB, {
      url: `https://example.com/${prefix}${i}`,
      slug: `${prefix}${i}`,
      createdBy: owner,
    });
  }
}

describe("unwindowed link queries cost the same at any match count", () => {
  it("search issues two statements for 3 matches and two for 40", async () => {
    await seed(3, "hit");
    const few: string[] = [];
    expect(await LinkRepository.search(spyDb(few), "hit")).toHaveLength(3);

    await resetData();
    await seed(40, "hit");
    const many: string[] = [];
    expect(await LinkRepository.search(spyDb(many), "hit")).toHaveLength(40);

    // One statement per match was the failure this route set out to remove: a
    // broad search over a large catalog trips D1's per-invocation subrequest
    // limit. Pin the absolute count, not just the equality.
    expect(few).toHaveLength(2);
    expect(many).toHaveLength(2);
  });

  it("findByOwner issues two statements for 3 links and two for 40", async () => {
    await seed(3, "own", "dennis@oddbit.id");
    const few: string[] = [];
    expect(await LinkRepository.findByOwner(spyDb(few), "dennis@oddbit.id")).toHaveLength(3);

    await resetData();
    await seed(40, "own", "dennis@oddbit.id");
    const many: string[] = [];
    expect(await LinkRepository.findByOwner(spyDb(many), "dennis@oddbit.id")).toHaveLength(40);

    expect(few).toHaveLength(2);
    expect(many).toHaveLength(2);
  });

  it("findByUrl issues two statements for 3 duplicates and two for 40", async () => {
    const url = "https://example.com/dupe";
    for (let i = 0; i < 3; i++) await LinkRepository.create(env.DB, { url, slug: `u${i}` });
    const few: string[] = [];
    expect(await LinkRepository.findByUrl(spyDb(few), url)).toHaveLength(3);

    for (let i = 3; i < 40; i++) await LinkRepository.create(env.DB, { url, slug: `u${i}` });
    const many: string[] = [];
    expect(await LinkRepository.findByUrl(spyDb(many), url)).toHaveLength(40);

    expect(few).toHaveLength(2);
    expect(many).toHaveLength(2);
  });

  it("list issues two statements whatever the catalog size", async () => {
    await seed(3, "all");
    const few: string[] = [];
    expect(await LinkRepository.list(spyDb(few))).toHaveLength(3);

    await resetData();
    await seed(40, "all");
    const many: string[] = [];
    expect(await LinkRepository.list(spyDb(many))).toHaveLength(40);

    expect(few).toHaveLength(2);
    expect(many).toHaveLength(2);
  });
});

describe("one SQL definition of search across every entry point", () => {
  it("search and the paginated listing return the same links in the same order", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Same created_at across all three, so tie ordering is what decides.
    for (const slug of ["match-a", "match-b", "match-c"]) {
      const link = await LinkRepository.create(env.DB, { url: `https://example.com/${slug}`, slug });
      await env.DB.prepare("UPDATE links SET created_at = ? WHERE id = ?").bind(now, link.id).run();
    }
    await LinkRepository.create(env.DB, { url: "https://other.test", slug: "nope" });

    const direct = await LinkRepository.search(env.DB, "match");
    const paged = await LinkRepository.page(env.DB, { limit: 25, search: "match", status: "all" });

    expect(direct.map((l) => l.id)).toEqual(paged.links.map((l) => l.id));
  });

  it("counts a link once when several of its slugs match", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "dup-one" });
    await SlugRepository.addCustom(env.DB, link.id, "dup-two");
    await SlugRepository.addCustom(env.DB, link.id, "dup-three");

    const results = await LinkRepository.search(env.DB, "dup");

    expect(results).toHaveLength(1);
    expect(results[0].slugs).toHaveLength(3);
  });

  it("matches created_by only when includeOwner is set", async () => {
    await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "owned",
      createdBy: "dennis@oddbit.id",
    });

    expect(await LinkRepository.search(env.DB, "dennis")).toHaveLength(0);
    expect(await LinkRepository.search(env.DB, "dennis", { includeOwner: true })).toHaveLength(1);
  });

  it("treats LIKE metacharacters in a search as literals", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/50%25-off", slug: "pct" });
    await LinkRepository.create(env.DB, { url: "https://example.com/plain", slug: "plain" });

    expect(await LinkRepository.search(env.DB, "%")).toHaveLength(1);
  });

  it("orders every unwindowed listing newest first with an id tie-break", async () => {
    const now = Math.floor(Date.now() / 1000);
    const ids: number[] = [];
    for (const slug of ["tie-a", "tie-b", "tie-c"]) {
      const link = await LinkRepository.create(env.DB, { url: `https://example.com/${slug}`, slug });
      await env.DB.prepare("UPDATE links SET created_at = ? WHERE id = ?").bind(now, link.id).run();
      ids.push(link.id);
    }
    const newestFirst = [...ids].reverse();

    // created_at is second-granularity, so links created in the same second
    // need the tie-break to come back in a stable order on every surface.
    expect((await LinkRepository.list(env.DB)).map((l) => l.id)).toEqual(newestFirst);
    expect((await LinkRepository.search(env.DB, "tie")).map((l) => l.id)).toEqual(newestFirst);
    expect((await LinkRepository.findByOwner(env.DB, "anonymous")).map((l) => l.id)).toEqual(newestFirst);
  });
});
