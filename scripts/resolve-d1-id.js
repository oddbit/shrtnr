#!/usr/bin/env node

// Resolves deployment-specific resource IDs at build time by querying the
// Cloudflare API via wrangler. Keeps wrangler.toml free of hardcoded IDs so
// the source repo works for any Cloudflare account.
//
// Handles:
//   - D1 database_id (looked up by database_name)
//   - KV namespace id (looked up by binding title, created if missing)

const { execSync } = require("child_process");
const fs = require("fs");

const configPath = "wrangler.toml";
let toml = fs.readFileSync(configPath, "utf-8");
let changed = false;

// ---- D1 database ----

if (!/^\s*database_id\s*=/m.test(toml)) {
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

  toml = toml.replace(
    /(database_name\s*=\s*"[^"]+")/,
    `$1\ndatabase_id = "${db.uuid}"`,
  );
  changed = true;
  console.log(`Resolved D1 ${dbName} → ${db.uuid}`);
}

// ---- KV namespace ----

const kvBindingMatch = toml.match(
  /\[\[kv_namespaces\]\][^[]*binding\s*=\s*"([^"]+)"/,
);
if (kvBindingMatch) {
  const kvBinding = kvBindingMatch[0];
  const bindingName = kvBindingMatch[1];

  // Check if we already have a real id (not the placeholder)
  const idMatch = kvBinding.match(/id\s*=\s*"([^"]+)"/);
  const needsResolve =
    !idMatch || idMatch[1].startsWith("PLACEHOLDER");

  if (needsResolve) {
    const workerName = toml.match(/^name\s*=\s*"([^"]+)"/m)?.[1] || "shrtnr";
    const kvTitle = `${workerName}-${bindingName}`;

    let namespaces;
    try {
      const raw = execSync("npx wrangler kv namespace list --json 2>/dev/null", {
        encoding: "utf-8",
      });
      namespaces = JSON.parse(raw);
    } catch {
      console.error("Could not list KV namespaces. Is wrangler authenticated?");
      process.exit(1);
    }

    let ns = namespaces.find((n) => n.title === kvTitle);

    if (!ns) {
      console.log(`KV namespace "${kvTitle}" not found. Creating it...`);
      try {
        const raw = execSync(
          `npx wrangler kv namespace create ${bindingName} --json 2>/dev/null`,
          { encoding: "utf-8" },
        );
        ns = JSON.parse(raw);
      } catch (e) {
        console.error(`Could not create KV namespace "${bindingName}".`);
        process.exit(1);
      }
    }

    const kvId = ns.id;

    if (idMatch) {
      // Replace placeholder id
      toml = toml.replace(
        new RegExp(
          `(\\[\\[kv_namespaces\\]\\][^[]*binding\\s*=\\s*"${bindingName}"[^[]*?)id\\s*=\\s*"[^"]+"`
        ),
        `$1id = "${kvId}"`,
      );
    } else {
      // Insert id after binding line
      toml = toml.replace(
        new RegExp(`(binding\\s*=\\s*"${bindingName}")`),
        `$1\nid = "${kvId}"`,
      );
    }
    changed = true;
    console.log(`Resolved KV ${bindingName} → ${kvId}`);
  }
}

if (changed) {
  fs.writeFileSync(configPath, toml);
}
