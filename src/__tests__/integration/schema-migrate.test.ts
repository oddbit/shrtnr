// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Runtime schema migration against a D1 that starts with no tables at all,
 * the state a one-click deploy hands the first request. The suite never
 * calls applyMigrations() here: the migrator under test is the only thing
 * that may create the schema.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { env } from "cloudflare:test";
import {
  ensureSchema,
  migrate,
  retrySchema,
  resetSchemaGuard,
  lastSchemaFailure,
  schemaStatus,
  MigrationError,
  MIGRATIONS_TABLE,
  RETRY_INTERVAL_MS,
  SCHEMA_VERSION_KEY,
} from "../../db/migrate";
import { MIGRATIONS, SCHEMA_VERSION } from "../../db/migrations.generated";
import { spyDb } from "../setup";

const ALL_NAMES = MIGRATIONS.map((m) => m.name);

async function appliedNames(): Promise<string[]> {
  const { results } = await env.DB.prepare(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`).all<{ name: string }>();
  return results.map((r) => r.name);
}

/**
 * Every test starts from the state a one-click deploy hands the Worker: a
 * database with no tables and an empty KV namespace. D1 keeps its own
 * _cf_* tables, which stay.
 */
async function wipeStorage(): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
  ).all<{ name: string }>();
  // D1 enforces foreign keys, so a parent cannot go before its children.
  // Keep dropping whatever still succeeds until nothing is left.
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

beforeEach(async () => {
  resetSchemaGuard();
  await wipeStorage();
});

describe("migrate() on an empty database", () => {
  it("applies every bundled migration and records each name the way wrangler does", async () => {
    await migrate(env);
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });

  it("creates the bookkeeping table with the column definition wrangler 4.127.1 uses", async () => {
    await migrate(env);
    const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(MIGRATIONS_TABLE)
      .first<{ sql: string }>();
    const normalized = row!.sql.replace(/\s+/g, " ");
    expect(normalized).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
    expect(normalized).toContain("name TEXT UNIQUE");
    expect(normalized).toContain("applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL");
  });

  it("stamps applied_at on every row", async () => {
    await migrate(env);
    const { results } = await env.DB.prepare(`SELECT applied_at FROM ${MIGRATIONS_TABLE}`).all<{ applied_at: string | null }>();
    expect(results).toHaveLength(ALL_NAMES.length);
    for (const r of results) expect(r.applied_at).toBeTruthy();
  });

  it("leaves the application tables usable", async () => {
    await migrate(env);
    await env.DB.prepare("INSERT INTO links (url, created_at, created_by) VALUES ('https://example.com', 1, 'x')").run();
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM links").first<{ n: number }>();
    expect(row!.n).toBe(1);
  });

  it("records the schema version in KV once the schema is current", async () => {
    await migrate(env);
    expect(await env.SLUG_KV.get(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION);
  });

  it("works without a KV binding", async () => {
    await migrate({ ...env, SLUG_KV: undefined } as unknown as typeof env);
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });
});

describe("migrate() on a database that is already current", () => {
  it("issues no migration statements, only the bootstrap read, when KV holds no version", async () => {
    await migrate(env);
    await env.SLUG_KV.delete(SCHEMA_VERSION_KEY);

    const log: string[] = [];
    await migrate({ ...env, DB: spyDb(log) });
    expect(log.some((sql) => /CREATE TABLE IF NOT EXISTS/.test(sql))).toBe(true);
    expect(log.some((sql) => /SELECT name FROM/.test(sql))).toBe(true);
    expect(log.some((sql) => /^CREATE TABLE links/.test(sql))).toBe(false);
    expect(log.some((sql) => /^INSERT INTO "?d1_migrations/.test(sql))).toBe(false);
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });

  it("touches D1 not at all when KV already holds the current schema version", async () => {
    await migrate(env);
    const log: string[] = [];
    await migrate({ ...env, DB: spyDb(log) });
    expect(log).toEqual([]);
  });

  it("goes back to D1 when KV holds a stale version", async () => {
    await migrate(env);
    await env.SLUG_KV.put(SCHEMA_VERSION_KEY, "0000_older.sql");
    const log: string[] = [];
    await migrate({ ...env, DB: spyDb(log) });
    expect(log.length).toBeGreaterThan(0);
    expect(await env.SLUG_KV.get(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION);
  });
});

describe("migrate() on a partially applied database", () => {
  it("applies only the migrations that are missing, in order", async () => {
    await migrate(env, MIGRATIONS.slice(0, 3));
    expect(await appliedNames()).toEqual(ALL_NAMES.slice(0, 3));

    const log: string[] = [];
    await migrate({ ...env, DB: spyDb(log) });
    expect(await appliedNames()).toEqual(ALL_NAMES);
    expect(log.some((sql) => /^CREATE TABLE links/.test(sql))).toBe(false);
    expect(log.some((sql) => /^CREATE TABLE bundles/.test(sql))).toBe(true);
  });

  it("honours names recorded by the wrangler CLI, whatever applied them", async () => {
    // Simulate `wrangler d1 migrations apply` having run the first migration.
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}"(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    ).run();
    await env.DB.batch([
      ...MIGRATIONS[0].statements.map((s) => env.DB.prepare(s)),
      env.DB.prepare(`INSERT INTO "${MIGRATIONS_TABLE}" (name) values (?)`).bind(MIGRATIONS[0].name),
    ]);

    await migrate(env);
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });
});

describe("migrate() under concurrency", () => {
  it("lets two isolates race on an empty database and ends with each migration recorded once", async () => {
    const noKv = { ...env, SLUG_KV: undefined } as unknown as typeof env;
    await Promise.all([migrate(noKv), migrate(noKv)]);
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });
});

/** A D1 binding whose first prepare() throws and every later call works. */
function brokenOnce(): D1Database {
  let failOnce = true;
  return new Proxy(env.DB, {
    get(target, prop, receiver) {
      if (prop === "prepare" && failOnce) {
        failOnce = false;
        throw new Error("D1 is warming up");
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as D1Database;
}

describe("ensureSchema()", () => {
  it("runs the migration once for concurrent callers in the same isolate", async () => {
    const log: string[] = [];
    const spied = { ...env, DB: spyDb(log) };
    await Promise.all([ensureSchema(spied), ensureSchema(spied), ensureSchema(spied)]);
    const bootstraps = log.filter((sql) => /CREATE TABLE IF NOT EXISTS/.test(sql)).length;
    expect(bootstraps).toBe(1);
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });

  it("does not return to D1 on later calls in the same isolate", async () => {
    await ensureSchema(env);
    await env.SLUG_KV.delete(SCHEMA_VERSION_KEY);
    const log: string[] = [];
    await ensureSchema({ ...env, DB: spyDb(log) });
    expect(log).toEqual([]);
  });

  it("remembers a failure and rejects again without touching D1 inside the retry window", async () => {
    let failOnce = true;
    const flaky = new Proxy(env.DB, {
      get(target, prop, receiver) {
        if (prop === "prepare" && failOnce) {
          failOnce = false;
          throw new Error("D1 is warming up");
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as D1Database;

    await expect(ensureSchema({ ...env, DB: flaky })).rejects.toThrow(/warming up/);
    expect(lastSchemaFailure()?.message).toMatch(/warming up/);
    const log: string[] = [];
    await expect(ensureSchema({ ...env, DB: spyDb(log) })).rejects.toThrow(/warming up/);
    expect(log).toEqual([]);
  });

  it("tries again once the retry window has passed", async () => {
    await expect(ensureSchema({ ...env, DB: brokenOnce() })).rejects.toThrow(/warming up/);
    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS + 1);
      await ensureSchema(env);
    } finally {
      vi.useRealTimers();
    }
    expect(lastSchemaFailure()).toBeNull();
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });

  it("retrySchema() ignores the window and clears the failure on success", async () => {
    await expect(ensureSchema({ ...env, DB: brokenOnce() })).rejects.toThrow(/warming up/);
    await retrySchema(env);
    expect(lastSchemaFailure()).toBeNull();
    expect(await appliedNames()).toEqual(ALL_NAMES);
  });
});

describe("a migration that fails", () => {
  const broken = [
    MIGRATIONS[0],
    { name: "0002_broken.sql", statements: ["CREATE TABLE nope ("] },
    { name: "0003_never.sql", statements: ["SELECT 1"] },
  ];

  it("raises a MigrationError that names the migration and carries the D1 error text", async () => {
    const err = await migrate(env, broken).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MigrationError);
    const me = err as MigrationError;
    expect(me.migration).toBe("0002_broken.sql");
    expect(me.message).toContain("0002_broken.sql");
    expect(me.message).toMatch(/syntax error|incomplete input/i);
  });

  it("marks the failure as happening on a database with no prior schema", async () => {
    const err = (await migrate(env, broken).catch((e: unknown) => e)) as MigrationError;
    expect(err.baselinePresent).toBe(false);
  });

  it("marks the failure as happening on an established schema when rows were recorded before", async () => {
    await migrate(env, MIGRATIONS.slice(0, 1));
    const err = (await migrate(env, broken).catch((e: unknown) => e)) as MigrationError;
    expect(err).toBeInstanceOf(MigrationError);
    expect(err.migration).toBe("0002_broken.sql");
    expect(err.baselinePresent).toBe(true);
  });

  it("records nothing for the failed migration or the ones after it", async () => {
    await migrate(env, broken).catch(() => undefined);
    expect(await appliedNames()).toEqual([MIGRATIONS[0].name]);
  });

  it("does not write a schema version to KV", async () => {
    await migrate(env, broken).catch(() => undefined);
    expect(await env.SLUG_KV.get(SCHEMA_VERSION_KEY)).toBeNull();
  });
});

describe("schemaStatus()", () => {
  it("reports every migration pending on an empty database without applying anything", async () => {
    const status = await schemaStatus(env);
    expect(status).toEqual({ version: SCHEMA_VERSION, ready: false, applied: [], pending: ALL_NAMES });
    const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'links'").first();
    expect(table).toBeNull();
  });

  it("reports the applied names with timestamps and nothing pending once current", async () => {
    await migrate(env);
    const status = await schemaStatus(env);
    expect(status.ready).toBe(true);
    expect(status.pending).toEqual([]);
    expect(status.applied.map((a) => a.name)).toEqual(ALL_NAMES);
    for (const a of status.applied) expect(a.applied_at).toBeTruthy();
  });

  it("reports a partial schema as not ready", async () => {
    await migrate(env, MIGRATIONS.slice(0, 2));
    const status = await schemaStatus(env);
    expect(status.ready).toBe(false);
    expect(status.pending).toEqual(ALL_NAMES.slice(2));
  });
});
