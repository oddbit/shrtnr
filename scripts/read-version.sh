#!/usr/bin/env bash
# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0
#
# Read the version string from an SDK manifest file.
#
# Usage: read-version.sh <manifest-file>
#
# Auto-detects format from the file's basename:
#   package.json   -> node JSON.parse(...).version
#   pubspec.yaml   -> grep ^version:
#   pyproject.toml -> grep ^version =
#
# Prints the version to stdout. Exits non-zero with an error on stderr if
# the file is missing, the format unknown, or the version empty.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <manifest-file>" >&2
  exit 2
fi

MANIFEST="$1"

if [ ! -f "$MANIFEST" ]; then
  echo "manifest not found: $MANIFEST" >&2
  exit 1
fi

case "$(basename "$MANIFEST")" in
  package.json)
    # Use node instead of jq: node is already a hard requirement (wrangler)
    # and ships with every SDK dev machine, while jq needs a separate install
    # on fresh macOS (brew) and some minimal Linux images.
    VERSION=$(node -e "
      const v = JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).version;
      if (v) process.stdout.write(v);
    ")
    ;;
  pubspec.yaml)
    VERSION=$(grep '^version:' "$MANIFEST" | head -n1 | awk '{print $2}' | tr -d '"')
    ;;
  pyproject.toml)
    VERSION=$(sed -nE 's/^version *= *"([^"]+)".*/\1/p' "$MANIFEST" | head -n1)
    ;;
  *)
    echo "unknown manifest format: $MANIFEST" >&2
    exit 1
    ;;
esac

if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  echo "could not read version from $MANIFEST" >&2
  exit 1
fi

echo "$VERSION"
