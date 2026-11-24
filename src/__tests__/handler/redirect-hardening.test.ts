// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { handleRedirect } from "../../redirect";
import { LinkRepository } from "../../db";
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
