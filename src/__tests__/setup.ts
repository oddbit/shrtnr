import { env } from "cloudflare:test";

// Load all migration files at build time via Vite's import.meta.glob with eager + raw.
const migrationFiles = import.meta.glob("../../migrations/*.sql", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

let migrated = false;

function parseSql(raw: string): string[] {
  const sql = raw
    .split("\n")
    .filter((line: string) => !line.trimStart().startsWith("--"))
    .join(" ")
    .replace(/\s+/g, " ");
  return sql
    .split(";")
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);
}

export async function applyMigrations() {
  if (migrated) return;
  // Sort by filename to apply migrations in order.
  const sorted = Object.keys(migrationFiles).sort();
  for (const path of sorted) {
    for (const stmt of parseSql(migrationFiles[path])) {
      try {
        await env.DB.exec(stmt);
      } catch {
        // Skip statements that are already satisfied by the current schema
        // (e.g. RENAME COLUMN on a column that doesn't exist in a fresh DB).
      }
    }
  }
  migrated = true;
}

export async function resetData() {
  await env.DB.exec("DELETE FROM clicks");
  await env.DB.exec("DELETE FROM slugs");
  await env.DB.exec("DELETE FROM links");
  await env.DB.exec("DELETE FROM settings");
  await env.DB.exec("DELETE FROM api_keys");
  await env.DB.exec("INSERT INTO settings (identity, key, value) VALUES ('anonymous', 'slug_default_length', '3')");

  // Clear KV cache
  const kv = env.SLUG_KV!;
  const { keys } = await kv.list();
  await Promise.all(keys.map((k) => kv.delete(k.name)));
}

/**
 * Records the SQL of every statement a call issues, so a test can pin both the
 * cost of an operation and the shape of what it sends. Traps exec() alongside
 * prepare(): batch() composes already-prepared statements and so is recorded
 * through prepare, but exec() takes raw SQL and would slip past entirely.
 */
export function spyDb(log: string[]): D1Database {
  return new Proxy(env.DB, {
    get(target, prop, receiver) {
      if (prop === "prepare") {
        return (sql: string) => {
          log.push(sql);
          return (target as unknown as D1Database).prepare(sql);
        };
      }
      if (prop === "exec") {
        return (sql: string) => {
          log.push(sql);
          return (target as unknown as D1Database).exec(sql);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as D1Database;
}
