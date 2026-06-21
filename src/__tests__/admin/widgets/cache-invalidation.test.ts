// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../setup";
import { getCacheVersion } from "../../../admin/widgets/cache";
import worker from "../../../index";

beforeAll(applyMigrations);
beforeEach(resetData);

// Dev mode (no ACCESS_AUD) resolves identity to "dev@local" — see route.test.ts.
const IDENTITY = "dev@local";

async function req(path: string, init?: RequestInit) {
  return worker.fetch(new Request("https://x.test" + path, init), env as never, {
    waitUntil() {},
    passThroughOnException() {},
  } as never);
}

describe("admin-api write cache invalidation", () => {
  it("bumps the writer's cache version on a successful write", async () => {
    const before = await getCacheVersion(env as never, IDENTITY);
    const res = await req("/_/admin/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res.ok).toBe(true);
    const after = await getCacheVersion(env as never, IDENTITY);
    expect(after).not.toBe(before); // a fresh token, so old cache keys are abandoned
  });

  it("does not bump on a failed write", async () => {
    const before = await getCacheVersion(env as never, IDENTITY);
    const res = await req("/_/admin/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // missing url => 400
    });
    expect(res.status).toBe(400);
    const after = await getCacheVersion(env as never, IDENTITY);
    expect(after).toBe(before);
  });

  it("does not bump on a GET read", async () => {
    const before = await getCacheVersion(env as never, IDENTITY);
    await req("/_/admin/api/links");
    const after = await getCacheVersion(env as never, IDENTITY);
    expect(after).toBe(before);
  });
});
