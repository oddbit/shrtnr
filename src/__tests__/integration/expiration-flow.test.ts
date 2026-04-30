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
