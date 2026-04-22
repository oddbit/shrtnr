#!/usr/bin/env bash
# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0
#
# Bump the version in an SDK's manifest and prepare a CHANGELOG placeholder
# so a release PR can be raised.
#
# Usage: bump-sdk-version.sh <sdk> <version>
#
# Arguments:
#   <sdk>      one of: npm | python | pub
#   <version>  new semver string, e.g. 0.7.3
#
# Side effects:
#   - Updates the manifest (sdk/typescript/package.json,
#     sdk/python/pyproject.toml, or sdk/dart/pubspec.yaml).
#   - Prepends a new section to the matching CHANGELOG.md with a placeholder
#     body ("TODO: fill in release notes.").
#   - Refreshes the lockfile if the SDK has one (yarn for npm, dart pub get
#     for pub; nothing for python — add it manually if/when a lockfile is
#     introduced).
#   - Prints a git diff and suggests the next step.
#
# Does NOT commit, tag, push, or open a PR. Raising the PR is the caller's
# job (matches existing repo convention: scripts don't touch GitHub state).

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <sdk> <version>" >&2
  echo "  sdk: npm | python | pub" >&2
  exit 2
fi

SDK="$1"
NEW_VERSION="$2"

case "$SDK" in
  npm)
    MANIFEST="sdk/typescript/package.json"
    CHANGELOG="sdk/typescript/CHANGELOG.md"
    TAG_PREFIX="npm-v"
    ;;
  python)
    MANIFEST="sdk/python/pyproject.toml"
    CHANGELOG="sdk/python/CHANGELOG.md"
    TAG_PREFIX="py-v"
    ;;
  pub)
    MANIFEST="sdk/dart/pubspec.yaml"
    CHANGELOG="sdk/dart/CHANGELOG.md"
    TAG_PREFIX="pub-v"
    ;;
  *)
    echo "unknown sdk: $SDK (expected npm | python | pub)" >&2
    exit 1
    ;;
esac

if [ ! -f "$MANIFEST" ]; then
  echo "manifest not found: $MANIFEST (run from repo root?)" >&2
  exit 1
fi

if [ ! -f "$CHANGELOG" ]; then
  echo "changelog not found: $CHANGELOG" >&2
  exit 1
fi

CURRENT_VERSION=$(bash scripts/read-version.sh "$MANIFEST")

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
  echo "version is already $NEW_VERSION, nothing to do" >&2
  exit 0
fi

echo "bumping $SDK: $CURRENT_VERSION -> $NEW_VERSION"

# Update the manifest in place. Use format-specific edits so we don't depend
# on jq/yq being present or reformat the file.
case "$(basename "$MANIFEST")" in
  package.json)
    # Match the existing "version": "X.Y.Z" line.
    python3 -c "
import json, sys
with open('$MANIFEST', 'r+') as f:
    data = json.load(f)
    data['version'] = '$NEW_VERSION'
    f.seek(0); f.truncate()
    json.dump(data, f, indent=2)
    f.write('\n')
"
    ;;
  pubspec.yaml)
    sed -i.bak -E "s/^version: .*/version: $NEW_VERSION/" "$MANIFEST"
    rm "$MANIFEST.bak"
    ;;
  pyproject.toml)
    sed -i.bak -E "s/^version *= *\"[^\"]+\"/version = \"$NEW_VERSION\"/" "$MANIFEST"
    rm "$MANIFEST.bak"
    ;;
esac

# Insert a new CHANGELOG section immediately before the first existing
# "## X.Y.Z" heading. This preserves any preamble text (e.g. the
# TypeScript CHANGELOG's "All notable changes..." line).
TMP_CHANGELOG=$(mktemp)
awk -v version="$NEW_VERSION" '
  !inserted && /^## [0-9]/ {
    print "## " version
    print ""
    print "- TODO: fill in release notes."
    print ""
    inserted = 1
  }
  { print }
' "$CHANGELOG" >"$TMP_CHANGELOG"
mv "$TMP_CHANGELOG" "$CHANGELOG"

# Refresh lockfile if the SDK has one.
case "$SDK" in
  npm)
    if command -v yarn >/dev/null 2>&1 && [ -f sdk/typescript/yarn.lock ]; then
      (cd sdk/typescript && yarn install --silent >/dev/null 2>&1 || true)
    fi
    ;;
  pub)
    if command -v dart >/dev/null 2>&1 && [ -f sdk/dart/pubspec.lock ]; then
      (cd sdk/dart && dart pub get >/dev/null 2>&1 || true)
    fi
    ;;
  python)
    # No lockfile for the Python SDK at the moment.
    :
    ;;
esac

echo
echo "--- diff ---"
git --no-pager diff -- "$MANIFEST" "$CHANGELOG" | head -60
echo
echo "next steps:"
echo "  1. edit $CHANGELOG and replace the TODO placeholder"
echo "  2. git add $MANIFEST $CHANGELOG"
echo "  3. git commit -m \"Release $SDK $NEW_VERSION: <short summary>\""
if [ "$SDK" = "pub" ]; then
  echo "  4. git tag ${TAG_PREFIX}${NEW_VERSION}"
  echo "  5. git push origin main ${TAG_PREFIX}${NEW_VERSION}"
else
  echo "  4. gh pr create  (or push to main — CI tags after publish)"
fi
