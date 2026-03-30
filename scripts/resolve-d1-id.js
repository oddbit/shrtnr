#!/usr/bin/env node

// Resolves the D1 database_id at build time by querying the Cloudflare API
// via wrangler. Keeps wrangler.toml free of hardcoded database IDs so the
// source repo works for any Cloudflare account.

const { execSync } = require("child_process");
const fs = require("fs");

const configPath = "wrangler.toml";
const toml = fs.readFileSync(configPath, "utf-8");

if (/^\s*database_id\s*=/m.test(toml)) {
  process.exit(0);
}

const nameMatch = toml.match(/database_name\s*=\s*"([^"]+)"/);
if (!nameMatch) {
  console.error("No database_name found in wrangler.toml");
  process.exit(1);
}
const dbName = nameMatch[1];

let databases;
try {
  const raw = execSync("npx wrangler d1 list --json 2>/dev/null", {
    encoding: "utf-8",
  });
  const parsed = JSON.parse(raw);
  databases = Array.isArray(parsed) ? parsed : [];
} catch {
  console.error("Could not list D1 databases. Is wrangler authenticated?");
  process.exit(1);
}

const db = databases.find((d) => d.name === dbName);
if (!db) {
  console.error(`D1 database "${dbName}" not found in this account.`);
  process.exit(1);
}

const updated = toml.replace(
  /(database_name\s*=\s*"[^"]+")/,
  `$1\ndatabase_id = "${db.uuid}"`,
);
fs.writeFileSync(configPath, updated);
console.log(`Resolved ${dbName} → ${db.uuid}`);
