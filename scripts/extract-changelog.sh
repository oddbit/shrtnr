#!/usr/bin/env bash
# Extracts the changelog section for a given version and writes it to an output file.
#
# Usage: extract-changelog.sh <version> <changelog-file> <output-file>
#
# Matches from "## x.y.z" or "## [x.y.z]" until the next "## " heading.
# Falls back to "Release <version>" if the section is missing.

set -euo pipefail

VERSION="$1"
CHANGELOG="$2"
OUTFILE="$3"

NOTES=$(awk -v ver="$VERSION" '
  BEGIN { found=0 }
  /^## / {
    if (found) exit
    if (index($0, ver)) { found=1; next }
  }
  found { print }
' "$CHANGELOG")

if [ -z "$NOTES" ]; then
  NOTES="Release $VERSION"
fi

printf '%s\n' "$NOTES" > "$OUTFILE"
