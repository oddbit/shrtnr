// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { BundleRepository, ClickRepository, LinkRepository } from "../../db";
import { applyMigrations, resetData } from "../setup";

const DEV_IDENTITY = "dev@local";

// Mirrors the helper in redirect-flow.test.ts. Click recording runs through
// `ctx.waitUntil(...)` from the redirect handler, so the rows may not yet be
// visible the moment SELF.fetch resolves. Poll up to ~1s for the expected
// total before asserting; cheaper than a fixed sleep, bounded so a real
// regression still surfaces.
async function waitForBundleClicks(bundleId: number, expected: number, timeoutMs = 2000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM clicks c
       JOIN slugs s ON s.slug = c.slug
       JOIN bundle_links bl ON bl.link_id = s.link_id
       WHERE bl.bundle_id = ?`,
    )
      .bind(bundleId)
      .first<{ cnt: number }>();
    last = row?.cnt ?? 0;
    if (last >= expected) return last;
    await new Promise((r) => setTimeout(r, 25));
  }
  return last;
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("Bundle aggregates clicks across links", () => {
  it("sums one redirect per member link into bundle stats", async () => {
    // Browser-like UA so admin filter_bots (default true) keeps these clicks.
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

    const bundle = await BundleRepository.create(env.DB, {
      name: "Aggregation",
      createdBy: DEV_IDENTITY,
    });

    const slugs = ["agg-a", "agg-b", "agg-c"] as const;
    const linkIds: number[] = [];
    for (const slug of slugs) {
      const link = await LinkRepository.create(env.DB, {
        url: `https://example.com/${slug}`,
        slug,
        createdBy: DEV_IDENTITY,
      });
      await BundleRepository.addLink(env.DB, bundle.id, link.id);
      linkIds.push(link.id);
    }

    // One redirect per slug.
    for (const slug of slugs) {
      const res = await SELF.fetch(
        new Request(`https://shrtnr.test/${slug}`, {
          redirect: "manual",
          headers: { "User-Agent": ua },
        }),
      );
      expect(res.status).toBe(301);
    }

    // Wait for all three waitUntil(recordClick) writes to land.
    const total = await waitForBundleClicks(bundle.id, 3);
    expect(total).toBe(3);

    // BundleStats has total_clicks as a top-level number (see src/types.ts).
    const stats = await ClickRepository.getBundleStats(env.DB, bundle.id, "all");
    expect(stats).not.toBeNull();
    expect(stats!.total_clicks).toBe(3);
    expect(stats!.link_count).toBe(3);
    expect(stats!.clicked_links).toBe(3);
  });
});
