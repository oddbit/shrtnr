// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Writes a SQL UPDATE script to ./ignore/backfill-app-referrers.sql that
// re-derives `referrer_host` from raw `referrer` for clicks whose Referer
// header was an Android or iOS app URI (e.g. `android-app://com.linkedin.android/`).
// The mapping comes from APP_PACKAGE_TO_DOMAIN in src/referrer.ts; uncurated
// and browser packages get NULL.
//
// Idempotent. Re-run after adding entries to APP_PACKAGE_TO_DOMAIN to
// retroactively attribute past clicks for the newly recognized packages.
//
// Usage:
//   yarn backfill:app-referrers
//   # then review ./ignore/backfill-app-referrers.sql and apply with:
//   wrangler d1 execute DB --local  --file=./ignore/backfill-app-referrers.sql
//   wrangler d1 execute DB --remote --file=./ignore/backfill-app-referrers.sql

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_PACKAGE_TO_DOMAIN } from "../src/referrer";

function sqlEscape(s: string): string {
  return s.replaceAll("'", "''");
}

const cases: string[] = [];
for (const [pkg, domain] of Object.entries(APP_PACKAGE_TO_DOMAIN)) {
  const p = sqlEscape(pkg);
  const d = sqlEscape(domain);
  // Match both bare `scheme://pkg` and `scheme://pkg/...`. The trailing-slash
  // form is what real Android/iOS browsers send; the bare form is defensive.
  cases.push(
    `    WHEN referrer = 'android-app://${p}' OR referrer LIKE 'android-app://${p}/%' OR referrer = 'ios-app://${p}' OR referrer LIKE 'ios-app://${p}/%' THEN '${d}'`,
  );
}

const sql = `-- One-time backfill: re-derive referrer_host from raw referrer for clicks
-- whose Referer header was an Android or iOS app URI. Idempotent.
--
-- Generated from APP_PACKAGE_TO_DOMAIN in src/referrer.ts.
-- Re-run \`yarn backfill:app-referrers\` after adding map entries to
-- regenerate this file with the expanded ruleset.

UPDATE clicks
SET referrer_host = CASE
${cases.join("\n")}
    ELSE NULL
END
WHERE referrer LIKE 'android-app://%' OR referrer LIKE 'ios-app://%';
`;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "ignore");
const outPath = resolve(outDir, "backfill-app-referrers.sql");
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, sql);
console.error(`Wrote ${outPath}`);
console.error(
  `Apply with: wrangler d1 execute DB --local  --file=./ignore/backfill-app-referrers.sql`,
);
console.error(
  `         or wrangler d1 execute DB --remote --file=./ignore/backfill-app-referrers.sql`,
);
