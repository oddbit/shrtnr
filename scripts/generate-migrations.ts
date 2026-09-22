// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Bundles migrations/*.sql into src/db/migrations.generated.ts.
 *
 * Workers have no file system, so the SQL that `wrangler d1 migrations apply`
 * reads from disk has to travel inside the bundle for the Worker to apply it
 * at a cold start. The output is committed: the fork a "Deploy to Cloudflare"
 * click creates builds with whatever command Cloudflare's defaults hand it,
 * and a committed module needs no build step there. `yarn dev` regenerates
 * it through its pre-hook, and the vitest drift test fails when the
 * committed module is stale, so a change lands or the suite says so.
 *
 * Usage: tsx scripts/generate-migrations.ts [--check]
 *   --check  exit 1 instead of writing when the module is out of date
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMigrationsModule } from "./render-migrations";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "migrations");
const outFile = path.join(root, "src", "db", "migrations.generated.ts");

const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({ name, sql: fs.readFileSync(path.join(migrationsDir, name), "utf8") }));

const rendered = renderMigrationsModule(files);
const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : null;
const relative = path.relative(root, outFile);

if (current === rendered) {
  console.log(`${relative} is up to date (${files.length} migrations, schema ${files[files.length - 1].name}).`);
} else if (process.argv.includes("--check")) {
  console.error(`${relative} is stale. Run \`yarn migrations:bundle\` and commit the result.`);
  process.exit(1);
} else {
  fs.writeFileSync(outFile, rendered);
  console.log(`Wrote ${relative} (${files.length} migrations, schema ${files[files.length - 1].name}).`);
}
