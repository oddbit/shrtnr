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
import { resetSchemaGuard, migrate, MigrationError, MIGRATIONS_TABLE, SCHEMA_VERSION_KEY } from "../../db/migrate";
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

/**
 * A D1 binding that serves every statement except a migration batch, the one
 * whose last statement records a name in the bookkeeping table. Stands in
 * for a migration that fails against a live database.
 */
function failingMigrationDb(message: string): D1Database {
  const RECORD = new RegExp(`INSERT INTO "${MIGRATIONS_TABLE}"`);
  // Statements are wrapped so the SQL text travels with them through bind(),
  // which returns a fresh statement; batch() unwraps before calling D1.
  const real = new WeakMap<object, D1PreparedStatement>();
  const sqlOf = new WeakMap<object, string>();
  const tag = (stmt: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const wrapped = new Proxy(stmt, {
      get(t, p, r) {
        if (p === "bind") return (...args: unknown[]) => tag(t.bind(...args), sql);
        const v = Reflect.get(t, p, r);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    real.set(wrapped, stmt);
    sqlOf.set(wrapped, sql);
    return wrapped;
  };
  return new Proxy(env.DB, {
    get(target, prop, receiver) {
      if (prop === "prepare") return (sql: string) => tag(target.prepare(sql), sql);
      if (prop === "batch") {
        return (stmts: D1PreparedStatement[]) => {
          if (stmts.some((st) => RECORD.test(sqlOf.get(st) ?? ""))) return Promise.reject(new Error(message));
          return target.batch(stmts.map((st) => real.get(st) ?? st));
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1Database;
}

/** Applies the schema the way any first request would, without going through /_/health. */
async function warmSchema(): Promise<void> {
  const res = await SELF.fetch(req("/_/setup", { method: "POST" }));
  expect(res.status).toBe(200);
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
    await warmSchema();
    const log: string[] = [];
    const res = await worker.fetch(req("/nothing-here"), { ...env, DB: spyDb(log) }, createExecutionContext());
    expect(res.status).toBe(404);
    expect(log.filter((sql) => sql.includes(MIGRATIONS_TABLE))).toEqual([]);
  });

  it("reads one KV key and no D1 bookkeeping when a fresh isolate finds the version in KV", async () => {
    await warmSchema();
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

  it("answers a redirect with the 503 page too when the database never had a schema", async () => {
    const res = await worker.fetch(
      req("/some-slug", { headers: { Accept: "text/html" } }),
      { ...env, DB: failingMigrationDb("disk I/O error") },
      createExecutionContext(),
    );
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("0001_initial.sql");
  });

  it("remembers the failure and does not run the migration again within the retry window", async () => {
    const broken = { ...env, DB: brokenDb("D1 is unavailable right now") };
    await worker.fetch(req("/x"), broken, createExecutionContext());
    const log: string[] = [];
    const res = await worker.fetch(req("/x"), { ...env, DB: spyDb(log) }, createExecutionContext());
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("D1 is unavailable right now");
    expect(log).toEqual([]);
  });

  it("POST /_/setup retries at once and clears the remembered failure", async () => {
    await worker.fetch(req("/x"), { ...env, DB: brokenDb("D1 is unavailable right now") }, createExecutionContext());
    await warmSchema();
    const res = await SELF.fetch(req("/nothing-here"), { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});

describe("when a later migration fails on a database that already has a schema", () => {
  const failing = () => ({ ...env, DB: failingMigrationDb("disk I/O error") });

  beforeEach(async () => {
    await migrate(env, MIGRATIONS.slice(0, -1));
    await env.SLUG_KV.delete(SCHEMA_VERSION_KEY);
    await env.DB.prepare("INSERT INTO links (id, url, created_at, created_by) VALUES (1, 'https://example.com/kept', 1, 'x')").run();
    await env.DB.prepare("INSERT INTO slugs (link_id, slug, is_primary, created_at) VALUES (1, 'kept', 1, 1)").run();
  });

  it("keeps redirecting short links", async () => {
    const res = await worker.fetch(req("/kept"), failing(), createExecutionContext());
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/kept");
  });

  it("answers 404 for an unknown slug, not a schema error", async () => {
    const res = await worker.fetch(req("/unknown"), failing(), createExecutionContext());
    expect(res.status).toBe(404);
  });

  it("shows the operator the 503 page on admin routes, naming the migration", async () => {
    const res = await worker.fetch(req("/_/admin/dashboard", { headers: { Accept: "text/html" } }), failing(), createExecutionContext());
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).toContain(SCHEMA_VERSION);
    expect(body).toContain("disk I/O error");
  });

  it("answers API routes with the 503 JSON", async () => {
    const res = await worker.fetch(req("/_/api/links"), failing(), createExecutionContext());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { migration: string };
    expect(body.migration).toBe(SCHEMA_VERSION);
  });

  it("answers the MCP host with the 503 JSON", async () => {
    const res = await worker.fetch(new Request("https://mcp.shrtnr.test/mcp", { method: "POST" }), failing(), createExecutionContext());
    expect(res.status).toBe(503);
  });

  it("reports degraded on /_/health with the error", async () => {
    await worker.fetch(req("/kept"), failing(), createExecutionContext());
    const res = await SELF.fetch(req("/_/health"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; schema: { ready: boolean; error: string; applied: string } };
    expect(body.status).toBe("degraded");
    expect(body.schema.ready).toBe(false);
    expect(body.schema.error).toContain("disk I/O error");
    expect(body.schema.applied).toBe(MIGRATIONS[MIGRATIONS.length - 2].name);
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
  it("reports ready false on an untouched database and applies nothing", async () => {
    const res = await SELF.fetch(req("/_/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; schema: { version: string; applied: string | null; ready: boolean } };
    expect(body.status).toBe("ok");
    expect(body.schema).toEqual({ version: SCHEMA_VERSION, applied: null, ready: false });
    const links = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'links'").first();
    expect(links).toBeNull();
  });

  it("reports the schema version and readiness once migrated", async () => {
    await warmSchema();
    const res = await SELF.fetch(req("/_/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; schema: { version: string; applied: string | null; ready: boolean } };
    expect(body.status).toBe("ok");
    expect(body.schema).toEqual({ version: SCHEMA_VERSION, applied: SCHEMA_VERSION, ready: true });
  });

  it("answers 503 degraded after a failed attempt, quoting the error", async () => {
    await worker.fetch(req("/x"), { ...env, DB: brokenDb("D1 is unavailable right now") }, createExecutionContext());
    const res = await SELF.fetch(req("/_/health"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; version: string; schema: { ready: boolean; error: string } };
    expect(body.status).toBe("degraded");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.schema.ready).toBe(false);
    expect(body.schema.error).toContain("D1 is unavailable right now");
  });

  it("answers 503 degraded when it cannot read the bookkeeping table at all", async () => {
    const res = await worker.fetch(req("/_/health"), { ...env, DB: brokenDb("D1 is unavailable right now") }, createExecutionContext());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; schema: { error: string } };
    expect(body.status).toBe("degraded");
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
