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
      await env.DB.exec(stmt);
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
  await env.DB.exec("INSERT INTO settings (key, value) VALUES ('slug_default_length', '3')");
}
