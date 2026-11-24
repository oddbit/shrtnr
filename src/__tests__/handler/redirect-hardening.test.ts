// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { handleRedirect } from "../../redirect";
import { LinkRepository, SlugRepository } from "../../db";
import { MAX_SLUG_LENGTH } from "../../constants";
import type { Env } from "../../types";
import { applyMigrations, resetData } from "../setup";

function req(path: string): Request {
  return new Request(`https://shrtnr.test/${path}`, { redirect: "manual" });
}

/** A binding whose every method rejects, to prove a code path never reaches it. */
function unreachable<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      return () => {
        throw new Error(`${name}.${String(prop)} must not be called`);
      };
    },
  });
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("Redirect: paths that cannot be a slug", () => {
  // KV refuses a key longer than 512 bytes, so an overlong path used to
  // surface the KV error as a 500 instead of the 404 any unknown slug gets.
  it("answers 404, not 500, for a path longer than any slug", async () => {
    const res = await SELF.fetch(req("a".repeat(600)));
    expect(res.status).toBe(404);
  });

  it("answers 404 for a path one character past the slug limit", async () => {
    const res = await SELF.fetch(req("a".repeat(MAX_SLUG_LENGTH + 1)));
    expect(res.status).toBe(404);
  });

  // Scanner traffic (/wp-login.php, /.env) dwarfs real misses on a public
  // short domain. No slug carries these characters, so the answer needs
  // neither a KV read nor a D1 query.
  it.each(["wp-login.php", ".env", "a b", "café", "a".repeat(MAX_SLUG_LENGTH + 1)])(
    "answers 404 for %j without touching KV or D1",
    async (path) => {
      const ctx = createExecutionContext();
      const sealed = {
        ...env,
        SLUG_KV: unreachable<KVNamespace>("SLUG_KV"),
        DB: unreachable<D1Database>("DB"),
      } as unknown as Env;
      const res = await handleRedirect(path, req(encodeURIComponent(path)), sealed, ctx);
      await waitOnExecutionContext(ctx);
      expect(res.status).toBe(404);
    },
  );

  it("still resolves a slug at the maximum length", async () => {
    const slug = "m".repeat(MAX_SLUG_LENGTH);
    await LinkRepository.create(env.DB, { url: "https://example.com/max", slug, createdBy: "dev@local" });
    const res = await SELF.fetch(req(slug));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/max");
  });

  it("still resolves a mixed-case request for a hyphenated custom slug", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/promo", slug: "summer-sale", createdBy: "dev@local" });
    const res = await SELF.fetch(req("Summer-Sale"));
    expect(res.status).toBe(301);
  });
});

describe("Redirect: KV is a cache, D1 is the truth", () => {
  // A KV read that rejects (outage, rate limit, a corrupt entry that fails
  // the JSON parse) must cost a D1 lookup, never the redirect.
  it("falls back to D1 when the KV read rejects", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/d1", slug: "kvdown", createdBy: "dev@local" });
    const brokenKv = {
      get: async () => {
        throw new Error("KV GET failed: 500 Internal Server Error");
      },
      put: async () => {
        throw new Error("KV PUT failed: 500 Internal Server Error");
      },
    } as unknown as KVNamespace;
    const ctx = createExecutionContext();
    const res = await handleRedirect("kvdown", req("kvdown"), { ...env, SLUG_KV: brokenKv } as Env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/d1");
  });

  // Falling back must not mean failing open. With the cache unusable, D1
  // still decides whether the link is alive.
  describe("with the cache unusable, D1 still decides", () => {
    const brokenKv = {
      get: async () => {
        throw new Error("KV GET failed: 500 Internal Server Error");
      },
      put: async () => {
        throw new Error("KV PUT failed: 500 Internal Server Error");
      },
    } as unknown as KVNamespace;

    async function viaBrokenKv(slug: string): Promise<Response> {
      const ctx = createExecutionContext();
      const res = await handleRedirect(slug, req(slug), { ...env, SLUG_KV: brokenKv } as Env, ctx);
      await waitOnExecutionContext(ctx);
      return res;
    }

    it("a disabled link stays 404", async () => {
      const link = await LinkRepository.create(env.DB, { url: "https://example.com/off", slug: "wasoff", createdBy: "dev@local" });
      await LinkRepository.disable(env.DB, link.id);
      expect((await viaBrokenKv("wasoff")).status).toBe(404);
    });

    it("an expired link stays 404", async () => {
      await LinkRepository.create(env.DB, { url: "https://example.com/old", slug: "expired", createdBy: "dev@local", expiresAt: 1 });
      expect((await viaBrokenKv("expired")).status).toBe(404);
    });

    it("a disabled custom slug stays 404 while the link's other slug resolves", async () => {
      const link = await LinkRepository.create(env.DB, { url: "https://example.com/two", slug: "sysone", createdBy: "dev@local" });
      await SlugRepository.addCustom(env.DB, link.id, "custom-off");
      await SlugRepository.disable(env.DB, "custom-off");
      expect((await viaBrokenKv("custom-off")).status).toBe(404);
      expect((await viaBrokenKv("sysone")).status).toBe(301);
    });

    it("an unknown slug is 404", async () => {
      expect((await viaBrokenKv("nosuch")).status).toBe(404);
    });

    it("the click is still recorded", async () => {
      await LinkRepository.create(env.DB, { url: "https://example.com/count", slug: "counted", createdBy: "dev@local" });
      expect((await viaBrokenKv("counted")).status).toBe(301);
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM clicks WHERE slug = 'counted'").first<{ n: number }>();
      expect(row?.n).toBe(1);
    });
  });

  it("a corrupt cache entry for a disabled link does not resurrect it", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/dead", slug: "deadone", createdBy: "dev@local" });
    await LinkRepository.disable(env.DB, link.id);
    await env.SLUG_KV!.put("deadone", "{not json");
    expect((await SELF.fetch(req("deadone"))).status).toBe(404);
  });

  it("a 404 for a path that cannot be a slug records no click", async () => {
    await SELF.fetch(req("wp-login.php"));
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM clicks").first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("falls back to D1 when the cached entry is not valid JSON", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/ok", slug: "corrupt", createdBy: "dev@local" });
    await env.SLUG_KV!.put("corrupt", "{not json");
    const res = await SELF.fetch(req("corrupt"));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/ok");
  });

  it("falls back to D1 when the cached entry has the wrong shape", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/shape", slug: "shape", createdBy: "dev@local" });
    await env.SLUG_KV!.put("shape", JSON.stringify("just a string"));
    const res = await SELF.fetch(req("shape"));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/shape");
  });
});
