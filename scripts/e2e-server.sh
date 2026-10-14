#!/usr/bin/env bash
# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0
#
# Boots the app for the browser e2e suite (playwright.config.ts webServer).
#
# Runs wrangler dev against a throwaway local state directory, so the suite
# never reads or writes the developer's own .wrangler/state database. The
# directory is wiped on every start: the setup project seeds a known catalog
# and the specs assert exact counts against it.
#
# Identity comes from the dev_identity cookie the setup project obtains
# through /_/dev/login, not from .dev.vars. CI has no .dev.vars, so the
# server gets DEV_MODE on its command line: without it /_/dev/login answers
# 404 and the admin pages answer the access setup page.
#
# SHORT_ORIGIN is pinned to something other than the admin host so the suite
# can tell a configured origin apart from the host a page was opened on. Its
# value lives in e2e/env.ts and reaches here through playwright.config.ts.

set -euo pipefail

PORT="${E2E_PORT:-8797}"
SHORT_ORIGIN="${E2E_SHORT_ORIGIN:-}"
STATE=".wrangler/e2e-state"

rm -rf "$STATE"
mkdir -p "$STATE"

npx --no-install wrangler d1 migrations apply DB --local --persist-to "$STATE" >/dev/null

# exec so the PID Playwright tracks is wrangler itself and its shutdown
# signal reaches the server, not a shell wrapper.
VARS=(--var "DEV_MODE:true")
if [ -n "$SHORT_ORIGIN" ]; then
  VARS+=(--var "SHORT_ORIGIN:$SHORT_ORIGIN")
fi

exec npx --no-install wrangler dev --port "$PORT" --persist-to "$STATE" "${VARS[@]}"
