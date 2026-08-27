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
# through /_/dev/login, not from .dev.vars.

set -euo pipefail

PORT="${E2E_PORT:-8797}"
STATE=".wrangler/e2e-state"

rm -rf "$STATE"
mkdir -p "$STATE"

npx --no-install wrangler d1 migrations apply DB --local --persist-to "$STATE" >/dev/null

# exec so the PID Playwright tracks is wrangler itself and its shutdown
# signal reaches the server, not a shell wrapper.
exec npx --no-install wrangler dev --port "$PORT" --persist-to "$STATE"
