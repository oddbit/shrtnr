#!/usr/bin/env bash
# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0
#
# Cross-SDK end-to-end test runner.
#
# Applies migrations to a local miniflare D1, seeds an API key directly
# into the api_keys table, spawns `wrangler dev`, and runs every SDK's
# e2e suite against the same running server with the same bearer token.
# Self-contained — no reliance on DEV_IDENTITY, no admin HTTP round-trip,
# no secrets. Suitable for CI.
#
# Usage:
#   scripts/test-sdks-e2e.sh            # run all SDKs
#   scripts/test-sdks-e2e.sh ts         # TypeScript only
#   scripts/test-sdks-e2e.sh python     # Python only
#   scripts/test-sdks-e2e.sh dart       # Dart only
#
# Requirements:
#   - yarn + node (wrangler dev)
#   - python3 with sdk/python/.venv created (cd sdk/python && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]')
#   - dart
#   - openssl, shasum (or sha256sum) — present on macOS and ubuntu-latest

set -euo pipefail

PORT="${SHRTNR_TEST_PORT:-8791}"
URL="http://127.0.0.1:${PORT}"
IDENTITY="e2e@shrtnr.test"

if [ "$#" -eq 0 ]; then
  SDKS=(ts python dart)
else
  SDKS=("$@")
fi

# Mint a deterministic-format raw key. Random per run to avoid any
# accidental reuse across consecutive runs leaving the same row behind.
RAW_KEY="sk_$(openssl rand -hex 24)"
PREFIX="${RAW_KEY:0:7}"

# Use whichever SHA-256 tool is on the path.
if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 | awk '{print $1}'; }
else
  echo "!! need sha256sum or shasum on PATH" >&2
  exit 1
fi

HASH=$(printf '%s' "$RAW_KEY" | sha256)
NOW=$(date +%s)

WRANGLER_LOG=$(mktemp)
WRANGLER_PID=""

cleanup() {
  if [ -n "$WRANGLER_PID" ] && kill -0 "$WRANGLER_PID" 2>/dev/null; then
    echo "==> stopping wrangler dev (pid $WRANGLER_PID)"
    kill "$WRANGLER_PID" 2>/dev/null || true
    wait "$WRANGLER_PID" 2>/dev/null || true
  fi
  rm -f "$WRANGLER_LOG"
}
trap cleanup EXIT INT TERM

echo "==> applying migrations to local D1"
npx --no-install wrangler d1 migrations apply DB --local >/dev/null

echo "==> seeding API key in local D1 (identity=$IDENTITY, scope=create,read)"
npx --no-install wrangler d1 execute DB --local --command "DELETE FROM api_keys WHERE identity = '$IDENTITY'; INSERT INTO api_keys (identity, title, key_prefix, key_hash, scope, created_at) VALUES ('$IDENTITY', 'e2e', '$PREFIX', '$HASH', 'create,read', $NOW);" >/dev/null

echo "==> starting wrangler dev on :${PORT}"
yarn dev --port "$PORT" >"$WRANGLER_LOG" 2>&1 &
WRANGLER_PID=$!

echo "==> waiting for /_/health"
for i in $(seq 1 60); do
  if curl -sf "$URL/_/health" >/dev/null 2>&1; then
    echo "==> server ready after ${i}s"
    break
  fi
  if ! kill -0 "$WRANGLER_PID" 2>/dev/null; then
    echo "!! wrangler dev exited before becoming ready" >&2
    cat "$WRANGLER_LOG" >&2
    exit 1
  fi
  sleep 1
done

if ! curl -sf "$URL/_/health" >/dev/null 2>&1; then
  echo "!! timed out waiting for /_/health" >&2
  cat "$WRANGLER_LOG" >&2
  exit 1
fi

export SHRTNR_TEST_URL="$URL"
export SHRTNR_TEST_API_KEY="$RAW_KEY"

FAILED=()

run_sdk() {
  local sdk="$1"
  local status=0
  echo
  echo "==> e2e: $sdk"
  case "$sdk" in
    ts|typescript|npm)
      (cd sdk/typescript && yarn install --frozen-lockfile --silent >/dev/null && yarn vitest run tests/e2e --passWithNoTests) || status=$?
      ;;
    python|py)
      if [ ! -x sdk/python/.venv/bin/pytest ]; then
        echo "!! sdk/python/.venv/bin/pytest missing. run: cd sdk/python && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'" >&2
        status=1
      else
        (cd sdk/python && .venv/bin/pytest -m e2e) || status=$?
      fi
      ;;
    dart|pub)
      (cd sdk/dart && dart pub get && dart test --tags e2e) || status=$?
      ;;
    *)
      echo "!! unknown sdk: $sdk" >&2
      status=2
      ;;
  esac
  if [ "$status" -ne 0 ]; then
    FAILED+=("$sdk")
  fi
}

for sdk in "${SDKS[@]}"; do
  run_sdk "$sdk"
done

echo
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "!! failing SDKs: ${FAILED[*]}" >&2
  exit 1
fi

echo "==> all selected SDKs passed"
