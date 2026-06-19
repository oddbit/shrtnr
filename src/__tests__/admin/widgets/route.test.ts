// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../../setup";

beforeAll(applyMigrations);
beforeEach(resetData);

// The route resolves widgets from the registry; assert against a real
// dashboard widget. Dev mode (no ACCESS_AUD) resolves identity to
// DEV_IDENTITY ("dev@local" in tests), so the admin middleware passes.
import worker from "../../../index";

async function get(path: string) {
  return worker.fetch(new Request("https://x.test" + path), env as any, {
    waitUntil() {},
    passThroughOnException() {},
  } as any);
}

describe("widget route", () => {
  it("returns an HTML fragment for a known widget", async () => {
    const res = await get("/_/admin/w/dashboard.top-countries?range=30d");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type") ?? "").toContain("text/html");
    const body = await res.text();
    expect(body).not.toContain("<html"); // a fragment, not a full page
  });

  it("404s an unknown widget id", async () => {
    const res = await get("/_/admin/w/dashboard.nope");
    expect(res.status).toBe(404);
  });
});
