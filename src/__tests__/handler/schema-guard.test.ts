// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * The Worker's first request against a database with no tables: the state a
 * one-click deploy hands it. Nothing here calls applyMigrations(); the Worker
 * must create the schema itself, and the diagnostics must say what happened.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF, createExecutionContext } from "cloudflare:test";
import worker from "../../index";
import { resetSchemaGuard, MigrationError, MIGRATIONS_TABLE, SCHEMA_VERSION_KEY } from "../../db/migrate";
import { MIGRATIONS, SCHEMA_VERSION } from "../../db/migrations.generated";
import { schemaErrorResponse } from "../../schema-guard";
import { resetRateLimits } from "../../rate-limit";
import { spyDb } from "../setup";

const ALL_NAMES = MIGRATIONS.map((m) => m.name);

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, init);
}

async function wipeStorage(): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
  ).all<{ name: string }>();
  let remaining = results.map((r) => r.name);
  while (remaining.length > 0) {
    const failed: string[] = [];
    for (const name of remaining) {
      await env.DB.prepare(`DROP TABLE IF EXISTS "${name}"`).run().catch(() => failed.push(name));
    }
    if (failed.length === remaining.length) throw new Error(`Could not drop: ${failed.join(", ")}`);
    remaining = failed;
  }
  const { keys } = await env.SLUG_KV.list();
  await Promise.all(keys.map((k) => env.SLUG_KV.delete(k.name)));
}

/** A D1 binding whose every statement fails, standing in for a database the Worker cannot use. */
function brokenDb(message: string): D1Database {
  return new Proxy(env.DB, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return () => {
          throw new Error(message);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1Database;
}

beforeEach(async () => {
  resetSchemaGuard();
  resetRateLimits();
  await wipeStorage();
});

describe("cold start on an empty database", () => {
  it("serves the first admin write with the schema it created on the way in", async () => {
    const res = await SELF.fetch(
      req("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/first" }),
      }),
    );
    expect(res.status).toBe(201);
    const { results } = await env.DB.prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(ALL_NAMES);
  });

  it("answers a redirect for an unknown slug with 404, not a schema error", async () => {
    const res = await SELF.fetch(req("/nothing-here"), { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});

describe("redirect hot path", () => {
  it("issues no bookkeeping statements once the isolate has checked the schema", async () => {
    await SELF.fetch(req("/_/health"));
    const log: string[] = [];
    const res = await worker.fetch(req("/nothing-here"), { ...env, DB: spyDb(log) }, createExecutionContext());
    expect(res.status).toBe(404);
    expect(log.filter((sql) => sql.includes(MIGRATIONS_TABLE))).toEqual([]);
  });

  it("reads one KV key and no D1 bookkeeping when a fresh isolate finds the version in KV", async () => {
    await SELF.fetch(req("/_/health"));
    resetSchemaGuard();
    expect(await env.SLUG_KV.get(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION);
    const log: string[] = [];
    await worker.fetch(req("/nothing-here"), { ...env, DB: spyDb(log) }, createExecutionContext());
    expect(log.filter((sql) => sql.includes(MIGRATIONS_TABLE))).toEqual([]);
  });
});

describe("when the schema cannot be created", () => {
  it("answers HTML visitors with a 503 page that carries the error text and a docs link", async () => {
    const res = await worker.fetch(
      req("/some-slug", { headers: { Accept: "text/html" } }),
      { ...env, DB: brokenDb("D1 is unavailable right now") },
      createExecutionContext(),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("D1 is unavailable right now");
    expect(body).toContain("/_/setup");
    expect(body).toMatch(/href="https:\/\/github\.com\/oddbit\/shrtnr#/);
    expect(body).not.toMatch(/error 1101/i);
  });

  it("answers API clients with a 503 JSON body", async () => {
    const res = await worker.fetch(
      req("/_/api/links", { headers: { Accept: "application/json" } }),
      { ...env, DB: brokenDb("D1 is unavailable right now") },
      createExecutionContext(),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = (await res.json()) as { error: string; migration: string | null };
    expect(body.error).toContain("D1 is unavailable right now");
    expect(body.migration).toBeNull();
  });

  it("names the failing migration on the page", async () => {
    const res = schemaErrorResponse(new MigrationError("0004_slug_text_pk.sql", new Error("near \"(\": syntax error")), req("/x", { headers: { Accept: "text/html" } }));
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).toContain("0004_slug_text_pk.sql");
    expect(body).toContain("syntax error");
  });

  it("escapes the error text on the page", async () => {
    const res = schemaErrorResponse(new MigrationError("0001_x.sql", new Error("<script>alert(1)</script>")), req("/x", { headers: { Accept: "text/html" } }));
    const body = await res.text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).toContain("&lt;script&gt;");
  });
});

describe("GET /_/health", () => {
  it("reports the schema version and readiness once migrated", async () => {
    const res = await SELF.fetch(req("/_/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; schema: { version: string; applied: string | null; ready: boolean } };
    expect(body.status).toBe("ok");
    expect(body.schema).toEqual({ version: SCHEMA_VERSION, applied: SCHEMA_VERSION, ready: true });
  });

  it("answers 503 with the error when the schema cannot be created, instead of the generic page", async () => {
    const res = await worker.fetch(req("/_/health"), { ...env, DB: brokenDb("D1 is unavailable right now") }, createExecutionContext());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; version: string; schema: { ready: boolean; error: string } };
    expect(body.status).toBe("degraded");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.schema.ready).toBe(false);
    expect(body.schema.error).toContain("D1 is unavailable right now");
  });
});

describe("/_/setup", () => {
  it("GET reports every migration pending on an empty database and applies nothing", async () => {
    const res = await SELF.fetch(req("/_/setup"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: string; ready: boolean; applied: unknown[]; pending: string[] };
    expect(body).toEqual({ version: SCHEMA_VERSION, ready: false, applied: [], pending: ALL_NAMES });
    const links = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'links'").first();
    expect(links).toBeNull();
  });

  it("POST applies the pending migrations and reports the result", async () => {
    const res = await SELF.fetch(req("/_/setup", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ready: boolean; applied: { name: string; applied_at: string }[]; pending: string[] };
    expect(body.ready).toBe(true);
    expect(body.pending).toEqual([]);
    expect(body.applied.map((a) => a.name)).toEqual(ALL_NAMES);
  });

  it("POST is idempotent", async () => {
    await SELF.fetch(req("/_/setup", { method: "POST" }));
    const res = await SELF.fetch(req("/_/setup", { method: "POST" }));
    expect(res.status).toBe(200);
    const { results } = await env.DB.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all();
    expect(results).toHaveLength(ALL_NAMES.length);
  });

  it("POST answers 503 with the error when migration fails", async () => {
    const res = await worker.fetch(req("/_/setup", { method: "POST" }), { ...env, DB: brokenDb("D1 is unavailable right now") }, createExecutionContext());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("D1 is unavailable right now");
  });

  it("requires an Access identity when ACCESS_AUD is set", async () => {
    const prodEnv = { ...env, ACCESS_AUD: "aud-tag", ACCESS_JWKS_URL: "https://team.cloudflareaccess.com/cdn-cgi/access/certs" };
    for (const method of ["GET", "POST"]) {
      const res = await worker.fetch(req("/_/setup", { method }), prodEnv, createExecutionContext());
      expect(res.status).toBe(401);
    }
  });

  it("rate-limits a client to ten requests a minute", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.7" };
    for (let i = 0; i < 10; i++) {
      const res = await SELF.fetch(req("/_/setup", { headers }));
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
    const blocked = await SELF.fetch(req("/_/setup", { headers }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    const other = await SELF.fetch(req("/_/setup", { headers: { "CF-Connecting-IP": "203.0.113.8" } }));
    expect(other.status).toBe(200);
  });
});
