import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../setup";
import { cacheKey, getCacheVersion, bumpCacheVersion, serveCached } from "../../../admin/widgets/cache";

beforeEach(applyMigrations);
beforeEach(resetData);

const ctx = { identity: "a@b.c", filters: {}, t: ((k: string) => k) as any, lang: "en" };

describe("widget cache", () => {
  it("varies the key by identity, range and version", () => {
    const k1 = cacheKey("dashboard.kpis", ctx, { range: "30d" }, { ttl: 30 }, 0);
    const k2 = cacheKey("dashboard.kpis", { ...ctx, identity: "x@y.z" }, { range: "30d" }, { ttl: 30 }, 0);
    const k3 = cacheKey("dashboard.kpis", ctx, { range: "7d" }, { ttl: 30 }, 0);
    const k4 = cacheKey("dashboard.kpis", ctx, { range: "30d" }, { ttl: 30 }, 1);
    expect(new Set([k1, k2, k3, k4]).size).toBe(4);
  });

  it("serves the produced value on miss and the cached value on hit", async () => {
    let calls = 0;
    const produce = async () => { calls++; return `<p>${calls}</p>`; };
    const key = cacheKey("t.w", ctx, {}, { ttl: 60 }, 0);
    const a = await serveCached(env, key, 60, produce);
    const b = await serveCached(env, key, 60, produce);
    expect(a).toBe("<p>1</p>");
    expect(b).toBe("<p>1</p>"); // cache hit, produce not called again
    expect(calls).toBe(1);
  });

  it("bumps the version so old keys are abandoned", async () => {
    expect(await getCacheVersion(env, "a@b.c")).toBe(0);
    await bumpCacheVersion(env, "a@b.c");
    expect(await getCacheVersion(env, "a@b.c")).toBe(1);
  });
});
