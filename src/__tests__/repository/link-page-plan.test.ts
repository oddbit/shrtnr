// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

/** The planner's steps for a statement, one string per row. */
async function plan(sql: string, ...binds: unknown[]): Promise<string[]> {
  const rows = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...binds)
    .all<{ detail: string }>();
  return (rows.results ?? []).map((r) => r.detail);
}

describe("links listing query plans", () => {
  it("indexes the order the listing pages by", async () => {
    const rows = await env.DB.prepare("PRAGMA index_list(links)").all<{ name: string }>();
    expect((rows.results ?? []).map((r) => r.name)).toContain("idx_links_created_at");
  });

  it("walks the index for the recent window instead of sorting the catalog", async () => {
    for (let i = 0; i < 40; i++) {
      await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `p${i}` });
    }
    await env.DB.exec("ANALYZE");

    const steps = await plan(
      "SELECT l.* FROM links l ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?",
      25,
      0,
    );

    // A temp B-tree here means the planner materialized and sorted every row
    // before taking 25 of them, which is the cost the index exists to remove.
    expect(steps.join(" | ")).not.toContain("USE TEMP B-TREE FOR ORDER BY");
    expect(steps.join(" | ")).toContain("idx_links_created_at");
  });
});
