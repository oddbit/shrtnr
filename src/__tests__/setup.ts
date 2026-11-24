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

/**
 * A database on which `competitor` runs immediately before a write matching
 * `match` reaches D1, as a second request would in production.
 *
 * This is how a test states a concurrency expectation without knowing how the
 * code under test is written: let it read whatever it wants first, land
 * another writer's change at the last moment, then assert that both changes
 * survive. The competitor writes through the plain `env.DB`, so it never
 * re-triggers itself. It fires once unless `every` is set.
 */
export function interleaveDb(
  match: RegExp,
  competitor: () => Promise<unknown>,
  opts: { every?: boolean } = {},
): D1Database {
  const db = env.DB as unknown as D1Database;
  const realOf = new WeakMap<object, D1PreparedStatement>();
  const sqlOf = new WeakMap<object, string>();
  let fired = false;

  const fire = async (sql: string): Promise<void> => {
    if (!match.test(sql)) return;
    if (fired && !opts.every) return;
    fired = true;
    await competitor();
  };

  const wrap = (stmt: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(stmt, {
      get(target, prop) {
        if (prop === "bind") return (...args: unknown[]) => wrap(target.bind(...args), sql);
        if (prop === "run" || prop === "first" || prop === "all" || prop === "raw") {
          return async (...args: unknown[]) => {
            await fire(sql);
            return (target as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    realOf.set(proxy, stmt);
    sqlOf.set(proxy, sql);
    return proxy;
  };

  return new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") return (sql: string) => wrap(target.prepare(sql), sql);
      if (prop === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          for (const s of statements) await fire(sqlOf.get(s) ?? "");
          return target.batch(statements.map((s) => realOf.get(s) ?? s));
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as D1Database;
}
