#!/usr/bin/env bash
# Resolves Cloudflare resource IDs (D1 databases, KV namespaces) from the API
# and patches wrangler.jsonc with the real values before deploy or migration.
#
# Requires: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in environment,
# or an active `wrangler login` session.
#
# Usage: bash scripts/resolve-bindings.sh

set -euo pipefail

CONFIG="wrangler.jsonc"

# --- D1 database ---

# Strip JSONC comments so we can parse with node
D1_NAME=$(node -e "
  const fs = require('fs');
  const src = fs.readFileSync('./$CONFIG', 'utf8').replace(/\/\/[^\n]*/g, '');
  const cfg = JSON.parse(src);
  const d1 = cfg.d1_databases && cfg.d1_databases[0];
  if (d1 && d1.database_name) console.log(d1.database_name);
" 2>/dev/null || true)

if [ -n "$D1_NAME" ]; then
  D1_ID=$(npx wrangler d1 list --json 2>/dev/null | node -e "
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      const db = JSON.parse(d).find(x => x.name === '$D1_NAME');
      if (!db) { console.error('D1 database not found: $D1_NAME'); process.exit(1); }
      console.log(db.uuid);
    });
  ")

  # Inject database_id if not already present
  node -e "
    const fs = require('fs');
    let src = fs.readFileSync('./$CONFIG', 'utf8');
    if (!src.includes('\"database_id\"')) {
      src = src.replace(
        '\"database_name\": \"$D1_NAME\"',
        '\"database_name\": \"$D1_NAME\",\n      \"database_id\": \"$D1_ID\"'
      );
      fs.writeFileSync('./$CONFIG', src);
    }
  "
  echo "D1: $D1_NAME -> $D1_ID"
fi

# --- KV namespaces ---

# Parse all KV bindings whose id matches the binding name (placeholder convention)
KV_BINDINGS=$(node -e "
  const fs = require('fs');
  const src = fs.readFileSync('./$CONFIG', 'utf8').replace(/\/\/[^\n]*/g, '');
  const cfg = JSON.parse(src);
  const kvs = cfg.kv_namespaces || [];
  kvs.filter(ns => ns.id === ns.binding).forEach(ns => console.log(ns.binding));
" 2>/dev/null || true)

if [ -n "$KV_BINDINGS" ]; then
  KV_LIST=$(npx wrangler kv namespace list 2>/dev/null)

  for BINDING in $KV_BINDINGS; do
    KV_ID=$(echo "$KV_LIST" | node -e "
      let d = '';
      process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        const ns = JSON.parse(d).find(x => x.title === '$BINDING');
        if (!ns) { console.error('KV namespace not found: $BINDING'); process.exit(1); }
        console.log(ns.id);
      });
    ")

    # Replace the placeholder id with the real one
    node -e "
      const fs = require('fs');
      let src = fs.readFileSync('./$CONFIG', 'utf8');
      src = src.replace('\"id\": \"$BINDING\"', '\"id\": \"$KV_ID\"');
      fs.writeFileSync('./$CONFIG', src);
    "
    echo "KV: $BINDING -> $KV_ID"
  done
fi

echo "Bindings resolved."
