// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// A client that composes a short URL itself has to know which origin the
// deployment hands links out on. On a deployment that answers on several
// domains, the host the client reached the API on is not necessarily the host
// short links live on, so `GET /_/api/config` and the `short_origin` field on
// every link response answer it. Unset keeps the request origin, which is what
// every deployment did before SHORT_ORIGIN existed.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, createExecutionContext } from "cloudflare:test";
import worker from "../../index";
import { LinkRepository, BundleRepository } from "../../db";
import { applyMigrations, resetData } from "../setup";
import type { Env } from "../../types";

const PUBLIC = "https://shrtnr.test";
const PINNED = "https://c.example";

// Seeds an api_keys row directly, the way api-links.test.ts does, so a test can
// mint a key with an arbitrary scope without an admin round-trip.
async function seedApiKey(db: D1Database, scope: string | null, identity = "origin@shrtnr.test"): Promise<string> {
  const raw = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = raw.slice(0, 7);
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare(
    "INSERT INTO api_keys (identity, title, key_prefix, key_hash, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(identity, "test", prefix, hash, scope, Math.floor(Date.now() / 1000)).run();
  return raw;
}

/** The public API against a deployment whose SHORT_ORIGIN is pinned or unset. */
async function api(
  path: string,
  options: { key?: string; shortOrigin?: string; method?: string; body?: unknown } = {},
): Promise<Response> {
  const e = { ...env, SHORT_ORIGIN: options.shortOrigin } as Env;
  return worker.fetch(
    new Request(`${PUBLIC}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.key ? { Authorization: `Bearer ${options.key}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    e,
    createExecutionContext(),
  );
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("GET /_/api/config", () => {
  it("answers the configured origin", async () => {
    const key = await seedApiKey(env.DB, "read");

    const res = await api("/_/api/config", { key, shortOrigin: PINNED });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ short_origin: PINNED });
  });

  it("normalizes a bare host the way every other surface does", async () => {
    const key = await seedApiKey(env.DB, "read");

    const res = await api("/_/api/config", { key, shortOrigin: "c.example" });

    expect(await res.json()).toEqual({ short_origin: PINNED });
  });

  it("falls back to the origin of the request when the deployment pins nothing", async () => {
    const key = await seedApiKey(env.DB, "read");

    const res = await api("/_/api/config", { key });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ short_origin: PUBLIC });
  });

  it("ignores a value that is not a bare origin", async () => {
    const key = await seedApiKey(env.DB, "read");

    const res = await api("/_/api/config", { key, shortOrigin: `${PINNED}/s` });

    expect(await res.json()).toEqual({ short_origin: PUBLIC });
  });

  it("requires a bearer token", async () => {
    const res = await api("/_/api/config");

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  it("requires the read scope", async () => {
    const key = await seedApiKey(env.DB, "create");

    const res = await api("/_/api/config", { key });

    expect(res.status).toBe(403);
  });
});

describe("link responses carry the origin", () => {
  it("on a created link, a fetched link and the list", async () => {
    const key = await seedApiKey(env.DB, "read,create");

    const created = await api("/_/api/links", {
      key,
      shortOrigin: PINNED,
      method: "POST",
      body: { url: "https://example.com/origin-create" },
    });
    expect(created.status).toBe(201);
    const link = (await created.json()) as { id: number; short_origin?: string };
    expect(link.short_origin).toBe(PINNED);

    const one = await api(`/_/api/links/${link.id}`, { key, shortOrigin: PINNED });
    expect(((await one.json()) as { short_origin?: string }).short_origin).toBe(PINNED);

    const list = await api("/_/api/links", { key, shortOrigin: PINNED });
    const links = (await list.json()) as { short_origin?: string }[];
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((item) => item.short_origin === PINNED)).toBe(true);
  });

  it("on a slug lookup, with the request origin when nothing is pinned", async () => {
    const key = await seedApiKey(env.DB, "read");
    await LinkRepository.create(env.DB, { url: "https://example.com/origin-slug", slug: "originslug" });

    const res = await api("/_/api/slugs/originslug", { key });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { short_origin?: string }).short_origin).toBe(PUBLIC);
  });

  it("on the links inside a bundle", async () => {
    const key = await seedApiKey(env.DB, "read,create");
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/origin-bundle", slug: "originbundle" });
    const bundle = await BundleRepository.create(env.DB, { name: "Origin bundle", createdBy: "origin@shrtnr.test" });

    const added = await api(`/_/api/bundles/${bundle.id}/links`, {
      key,
      shortOrigin: PINNED,
      method: "POST",
      body: { link_id: link.id },
    });
    expect(added.ok).toBe(true);

    const res = await api(`/_/api/bundles/${bundle.id}/links`, { key, shortOrigin: PINNED });
    const links = (await res.json()) as { short_origin?: string }[];
    expect(links.length).toBe(1);
    expect(links[0].short_origin).toBe(PINNED);
  });
});
