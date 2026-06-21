// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, BundleRepository, ClickRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundles");
  await env.DB.exec("DELETE FROM bundle_links");
});

describe("getBundleSummariesBulk card extras", () => {
  it("omits clicked_links unless card extras are requested", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "dev@local" });
    const map = await ClickRepository.getBundleSummariesBulk(env.DB, [bundle.id], undefined, undefined, "all");
    const s = map.get(bundle.id)!;
    expect(s.clicked_links).toBeUndefined();
  });

  it("counts only the links with traffic when requested", async () => {
    const a = await LinkRepository.create(env.DB, { url: "https://a.example", slug: "aaa", createdBy: "dev@local" });
    const b = await LinkRepository.create(env.DB, { url: "https://b.example", slug: "bbb", createdBy: "dev@local" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "dev@local" });
    await BundleRepository.addLink(env.DB, bundle.id, a.id);
    await BundleRepository.addLink(env.DB, bundle.id, b.id);

    // Link a gets 3 clicks (recorded at "now"); link b gets none.
    const slugA = a.slugs[0].slug;
    await ClickRepository.record(env.DB, slugA, { isBot: 0 });
    await ClickRepository.record(env.DB, slugA, { isBot: 0 });
    await ClickRepository.record(env.DB, slugA, { isBot: 0 });

    const map = await ClickRepository.getBundleSummariesBulk(
      env.DB,
      [bundle.id],
      undefined,
      undefined,
      "all",
      true,
    );
    const s = map.get(bundle.id)!;
    expect(s.total_clicks).toBe(3);
    // Only link a saw traffic, so 1 of the 2 bundle links is "clicked".
    expect(s.clicked_links).toBe(1);
  });
});
