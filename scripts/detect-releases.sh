#!/usr/bin/env bash
# Detects which packages have unpublished version bumps and writes a GitHub
# Actions matrix JSON to GITHUB_OUTPUT.
#
# Usage: bash scripts/detect-releases.sh
#
# For each package in sdk, checks:
#   1. The version in <package>/package.json changed since HEAD~1.
#   2. The corresponding git tag (<package>-v<version>) does not yet exist.
#
# Outputs:
#   matrix={"include":[{"package":"sdk","version":"x.y.z"},...]}'

set -euo pipefail

MATRIX='{"include":[]}'

for PKG in sdk; do
  CURRENT=$(jq -r .version "${PKG}/package.json")
  PREVIOUS=$(git show HEAD~1:"${PKG}/package.json" 2>/dev/null | jq -r .version 2>/dev/null || echo "")
  TAG="${PKG}-v${CURRENT}"

  if [ -z "$CURRENT" ] || [ "$CURRENT" = "$PREVIOUS" ]; then
    echo "No version change in ${PKG}, skipping"
    continue
  fi

  if git rev-parse "refs/tags/${TAG}" >/dev/null 2>&1; then
    echo "Tag ${TAG} already exists, skipping ${PKG}"
    continue
  fi

  echo "Queuing release: ${TAG}"
  MATRIX=$(echo "$MATRIX" | jq --arg pkg "$PKG" --arg ver "$CURRENT" \
    '.include += [{"package": $pkg, "version": $ver}]')
done

echo "matrix=$(echo "$MATRIX" | jq -c .)" >> "$GITHUB_OUTPUT"
