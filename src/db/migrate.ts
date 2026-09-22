// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Applies the bundled migrations to D1 from inside the Worker.
 *
 * A "Deploy to Cloudflare" click provisions an empty D1 database and never
 * runs `wrangler d1 migrations apply`, so the first request has to create
 * the schema itself. This module does what the CLI does, against the same
 * bookkeeping table with the same recorded names, so either path can run
 * first and the other one sees its work:
 *
 *   table:   d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,
 *                           name TEXT UNIQUE,
 *                           applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)
 *   name:    the migration file name, extension included ("0001_initial.sql")
 *
 * Verified against wrangler 4.127.1: getCreateMigrationsTableQuery() and
 * buildMigrationQuery() in node_modules/wrangler/wrangler-dist/cli.js
 * (search for DEFAULT_MIGRATION_TABLE).
 *
 * Each migration runs as one batch() with the bookkeeping INSERT last. D1
 * runs a batch as a single transaction, so a migration either lands with its
 * row or not at all, and two isolates racing on a cold deploy cannot both
 * record the same name: the loser's batch fails, and the re-read of the
 * table shows the winner's row.
 */

import type { Env } from "../types";
import { MIGRATIONS, SCHEMA_VERSION, type BundledMigration } from "./migrations.generated";

export const MIGRATIONS_TABLE = "d1_migrations";

/** KV key holding the name of the last migration the schema is known to include. */
export const SCHEMA_VERSION_KEY = "schema:version";

// Same text wrangler runs, whitespace aside, so the two paths create one table.
const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}"(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;
const LIST_APPLIED = `SELECT name FROM "${MIGRATIONS_TABLE}" ORDER BY id`;
const LIST_APPLIED_WITH_TIME = `SELECT name, applied_at FROM "${MIGRATIONS_TABLE}" ORDER BY id`;
const RECORD_APPLIED = `INSERT INTO "${MIGRATIONS_TABLE}" (name) VALUES (?)`;

export class MigrationError extends Error {
  /** File name of the migration that failed, or null when the bookkeeping itself failed. */
  readonly migration: string | null;

  constructor(migration: string | null, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(migration ? `Migration ${migration} failed: ${reason}` : `Schema bookkeeping failed: ${reason}`);
    this.name = "MigrationError";
    this.migration = migration;
    this.cause = cause;
  }
}

export interface AppliedMigration {
  name: string;
  applied_at: string;
}

export interface SchemaStatus {
  /** The schema this build expects: the last bundled migration name. */
  version: string;
  ready: boolean;
  applied: AppliedMigration[];
  pending: string[];
}

/*
 * Module-level, so one isolate migrates once and every later request
 * awaits an already settled promise. The promise resolves to void: no I/O
 * object from the first request crosses into a later one, which is what
 * Workers forbid. A rejection clears the slot so the next request retries
 * instead of serving the same stale failure for the isolate's lifetime.
 */
let inflight: Promise<void> | null = null;

export function ensureSchema(env: Env): Promise<void> {
  inflight ??= migrate(env).catch((err: unknown) => {
    inflight = null;
    throw err;
  });
  return inflight;
}

/** Drops the once-per-isolate memo, so the next ensureSchema() goes back to storage. */
export function resetSchemaGuard(): void {
  inflight = null;
}

/** Forgets the memo and migrates again: the retry behind POST /_/setup. */
export function retrySchema(env: Env): Promise<void> {
  resetSchemaGuard();
  return ensureSchema(env);
}

export async function migrate(env: Env, migrations: readonly BundledMigration[] = MIGRATIONS): Promise<void> {
  const kv = env.SLUG_KV as KVNamespace | undefined;
  const target = migrations[migrations.length - 1]?.name ?? SCHEMA_VERSION;

  // One edge-local read decides the common case. Never fatal: KV can be
  // unbound on a deploy that provisioned D1 alone, and a KV hiccup must not
  // stop a redirect that D1 could have served.
  if (kv) {
    const seen = await kv.get(SCHEMA_VERSION_KEY).catch(() => null);
    if (seen === target) return;
  }

  let applied: Set<string>;
  try {
    // One round trip: create the table if this is the first boot ever, then
    // read what is recorded.
    const [, listed] = await env.DB.batch<{ name: string }>([
      env.DB.prepare(CREATE_MIGRATIONS_TABLE),
      env.DB.prepare(LIST_APPLIED),
    ]);
    applied = new Set(listed.results.map((r) => r.name));
  } catch (err) {
    throw new MigrationError(null, err);
  }

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    const statements = migration.statements.map((sql) => env.DB.prepare(sql));
    statements.push(env.DB.prepare(RECORD_APPLIED).bind(migration.name));

    try {
      await env.DB.batch(statements);
    } catch (err) {
      // Another isolate may have applied it between our read and our write.
      // Its batch committed the schema and the row together, so a recorded
      // name means the work is done and the failure was ours to lose.
      if (await isRecorded(env.DB, migration.name)) continue;
      throw new MigrationError(migration.name, err);
    }
  }

  if (kv) {
    await kv.put(SCHEMA_VERSION_KEY, target).catch(() => undefined);
  }
}

async function isRecorded(db: D1Database, name: string): Promise<boolean> {
  try {
    const row = await db.prepare(`SELECT 1 AS present FROM "${MIGRATIONS_TABLE}" WHERE name = ?`).bind(name).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * What is recorded against what is bundled. Read-only: a diagnostic that
 * must answer on a database no migration has touched, where the
 * bookkeeping table itself is missing.
 */
export async function schemaStatus(env: Env): Promise<SchemaStatus> {
  let applied: AppliedMigration[] = [];
  try {
    const { results } = await env.DB.prepare(LIST_APPLIED_WITH_TIME).all<AppliedMigration>();
    applied = results;
  } catch (err) {
    if (!isMissingTable(err)) throw new MigrationError(null, err);
  }
  const recorded = new Set(applied.map((a) => a.name));
  const pending = MIGRATIONS.map((m) => m.name).filter((name) => !recorded.has(name));
  return { version: SCHEMA_VERSION, ready: pending.length === 0, applied, pending };
}

function isMissingTable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no such table/i.test(message);
}
