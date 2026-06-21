// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { LinkRepository } from "../../db";
import { SlugCache } from "../../kv";
import { applyMigrations, resetData } from "../setup";

const DEV_IDENTITY = "dev@local";

function req(slug: string): Request {
  return new Request(`https://shrtnr.test/${slug}`, { redirect: "manual" });
}

// Park execution just after a fresh Unix-second boundary so the create/fetch
// that follow land inside the same second as the captured timestamp. The
// redirect handler computes its own Math.floor(Date.now() / 1000) in the
// Worker isolate, a clock the test process can not freeze, so the boundary
// case (expires_at === handler's now) is only reliably exercised when both
// readings fall in the same second. Without the alignment a mid-test tick
// turns the case into expires_at < now, which the pre-fix strict-`<` code
// also 404s, making the regression test pass against the bug it guards.
async function alignToSecondStart(): Promise<void> {
  // The outer % 1000 collapses the delay to 0 when Date.now() already sits on a
  // boundary, sidestepping a needless full-second sleep (1000 - 0 = 1000).
  await new Promise((r) => setTimeout(r, (1000 - (Date.now() % 1000)) % 1000));
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("expires_at flow", () => {
  it("active -> expired -> re-enabled -> future expiry tracks redirect status", async () => {
    // expires_at lives on the `links` table (see src/db/link-repository.ts).
    // The redirect handler reads it through SlugRepository.findForRedirect,
    // so KV must be busted after each direct DB mutation.
    const slug = "expflow";
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/expflow",
      slug,
      createdBy: DEV_IDENTITY,
    });

    // Stage A: active, no expiry -> 301
    {
      const res = await SELF.fetch(req(slug));
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("https://example.com/expflow");
    }

    // Stage B: expires_at in the past -> 404
    await env.DB.prepare("UPDATE links SET expires_at = ? WHERE id = ?")
      .bind(1, link.id) // 1970-01-01
      .run();
    await SlugCache.delete(env.SLUG_KV, slug);
    {
      const res = await SELF.fetch(req(slug));
      expect(res.status).toBe(404);
    }

    // Stage C: clear expires_at (NULL) -> 301 again
    await env.DB.prepare("UPDATE links SET expires_at = NULL WHERE id = ?")
      .bind(link.id)
      .run();
    await SlugCache.delete(env.SLUG_KV, slug);
    {
      const res = await SELF.fetch(req(slug));
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("https://example.com/expflow");
    }

    // Stage D: expires_at in the future -> 301 (still active)
    const future = Math.floor(Date.now() / 1000) + 3600;
    await env.DB.prepare("UPDATE links SET expires_at = ? WHERE id = ?")
      .bind(future, link.id)
      .run();
    await SlugCache.delete(env.SLUG_KV, slug);
    {
      const res = await SELF.fetch(req(slug));
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("https://example.com/expflow");
    }
  });
});

describe("expires_at = now boundary", () => {
  it("treats expires_at equal to the current second as expired (disable takes effect immediately)", async () => {
    // LinkRepository.disable() sets expires_at = Math.floor(Date.now() / 1000).
    // The redirect handler must treat that as expired rather than waiting an
    // extra second before the strict-less-than check turns true.
    const slug = "exact-now";
    // Capture the second at the top of a fresh tick, then create + evict + fetch
    // inside that same second so the handler reads expires_at === its own now.
    await alignToSecondStart();
    const nowSec = Math.floor(Date.now() / 1000);
    await LinkRepository.create(env.DB, {
      url: "https://example.com/exact-now",
      slug,
      expiresAt: nowSec,
      createdBy: DEV_IDENTITY,
    });
    await SlugCache.delete(env.SLUG_KV, slug);
    const res = await SELF.fetch(req(slug));
    expect(res.status).toBe(404);
  });
});

describe("expires_at = 0 boundary", () => {
  it("treats 0 as an epoch timestamp (expired), not as no expiry", async () => {
    // The Link schema documents "null means no expiry". A stored 0 is a real
    // timestamp (1970-01-01) and must 404, so the expiry check has to be
    // null-aware rather than truthy.
    const slug = "expzero";
    await LinkRepository.create(env.DB, {
      url: "https://example.com/expzero",
      slug,
      expiresAt: 0,
      createdBy: DEV_IDENTITY,
    });

    const res = await SELF.fetch(req(slug));
    expect(res.status).toBe(404);
  });
});
