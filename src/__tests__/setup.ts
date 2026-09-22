import { env } from "cloudflare:test";

import { migrate } from "../db/migrate";

/**
 * Brings the test database to the current schema through the same migrator
 * the Worker runs at a cold start, so the suite exercises the real path and
 * the bookkeeping rows the Worker expects are present.
 */
export async function applyMigrations() {
  await migrate(env);
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
