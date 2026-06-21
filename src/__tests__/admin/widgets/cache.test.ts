// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../setup";
import { cacheKey, getCacheVersion, bumpCacheVersion, serveCached } from "../../../admin/widgets/cache";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx = { identity: "a@b.c", filters: {}, t: ((k: string) => k) as any, lang: "en" };

describe("widget cache", () => {
  it("varies the key by identity, range and version", () => {
    const k1 = cacheKey("dashboard.kpis", ctx, { range: "30d" }, { ttl: 30 }, "0");
    const k2 = cacheKey("dashboard.kpis", { ...ctx, identity: "x@y.z" }, { range: "30d" }, { ttl: 30 }, "0");
    const k3 = cacheKey("dashboard.kpis", ctx, { range: "7d" }, { ttl: 30 }, "0");
    const k4 = cacheKey("dashboard.kpis", ctx, { range: "30d" }, { ttl: 30 }, "tok1");
    expect(new Set([k1, k2, k3, k4]).size).toBe(4);
  });

  it("encodes dynamic key parts so special characters cannot inject separators or collide", () => {
    const policy = { ttl: 1, varyByEntity: true };
    const k1 = cacheKey("dashboard.x", ctx, { id: "a&v=9" }, policy, "0");
    const k2 = cacheKey("dashboard.x", ctx, { id: "a" }, policy, "0");
    // A raw entity value would inject a fake "v=" segment and make the key
    // ambiguous; it must be percent-encoded instead.
    expect(k1).not.toContain("e=a&v=9");
    expect(k1).toContain("a%26v%3D9");
    // Distinct entity ids must produce distinct keys.
    expect(k1).not.toBe(k2);
  });

  it("varies the key by language and filter settings (render-determining inputs)", () => {
    const base = cacheKey("w", ctx, { range: "30d" }, { ttl: 1 }, "0");
    const otherLang = cacheKey("w", { ...ctx, lang: "sv" }, { range: "30d" }, { ttl: 1 }, "0");
    const otherFilters = cacheKey(
      "w",
      { ...ctx, filters: { excludeBots: false, excludeSelfReferrers: true } },
      { range: "30d" },
      { ttl: 1 },
      "0",
    );
    // Fragments are rendered in the viewer's language and with their filter
    // settings, so two viewers (or one viewer after changing either) must not
    // share a cache entry.
    expect(base).not.toBe(otherLang);
    expect(base).not.toBe(otherFilters);
  });

  it("serves the produced value on miss and the cached value on hit", async () => {
    let calls = 0;
    const produce = async () => { calls++; return `<p>${calls}</p>`; };
    const key = cacheKey("t.w", ctx, {}, { ttl: 60 }, "0");
    const a = await serveCached(env, key, 60, produce);
    const b = await serveCached(env, key, 60, produce);
    expect(a).toBe("<p>1</p>");
    expect(b).toBe("<p>1</p>"); // cache hit, produce not called again
    expect(calls).toBe(1);
  });

  it("bumps the version to a fresh token so old keys are abandoned", async () => {
    const before = await getCacheVersion(env, "a@b.c");
    await bumpCacheVersion(env, "a@b.c");
    const after = await getCacheVersion(env, "a@b.c");
    // A fresh unique token (not a counter), so it must differ and yield a new
    // cache key. Bumping again must differ again.
    expect(after).not.toBe(before);
    await bumpCacheVersion(env, "a@b.c");
    expect(await getCacheVersion(env, "a@b.c")).not.toBe(after);
  });
});
