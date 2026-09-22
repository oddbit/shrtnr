#!/usr/bin/env bash
# Lists every GitHub Release whose tag carries an SDK prefix and, on request,
# deletes the release or marks it non-latest. The git tag survives in both
# modes: published package versions on npm, PyPI and pub.dev must stay
# resolvable, and `gh release delete` without `--cleanup-tag` leaves the ref
# alone. The script confirms that after every delete.
#
# Usage:
#   scripts/prune-sdk-releases.sh                 dry run, mode delete
#   scripts/prune-sdk-releases.sh --mode unlatest  dry run, mode unlatest
#   scripts/prune-sdk-releases.sh --apply          act (mode delete)
#   scripts/prune-sdk-releases.sh --mode unlatest --apply
#
# Options:
#   --mode delete|unlatest   delete removes the release object and keeps the
#                            tag; unlatest keeps the release and runs
#                            `gh release edit <tag> --latest=false`.
#                            Default: delete.
#   --apply                  perform the actions. Without it the script only
#                            prints what it would do.
#   --prefixes "a-v b-v"     space-separated tag prefixes to treat as SDK
#                            releases. Default: "npm-v py-v pub-v sdk-v".
#                            sdk-v is the retired TypeScript SDK train.
#   --repo owner/name        repository. Default: the gh default for this
#                            checkout.
#
# Requires: gh (authenticated with repo scope), jq.

set -euo pipefail

MODE="delete"
APPLY="false"
PREFIXES="npm-v py-v pub-v sdk-v"
REPO=""

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --apply)
      APPLY="true"
      shift
      ;;
    --prefixes)
      PREFIXES="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$MODE" in
  delete|unlatest) ;;
  *)
    echo "--mode must be delete or unlatest, got '$MODE'" >&2
    exit 2
    ;;
esac

for tool in gh jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool is required" >&2
    exit 2
  fi
done

if [ -z "$REPO" ]; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
fi

# Build one alternation from the prefixes: "^(npm-v|py-v|...)".
PREFIX_RE="^($(printf '%s\n' $PREFIXES | sed 's/[.[\*^$]/\\&/g' | paste -sd '|' -))"

# One call fetches the whole release list. The API caps a page at 100, so
# gh pages internally; 1000 leaves headroom over the 110 releases that exist.
RELEASES=$(gh release list --repo "$REPO" --limit 1000 \
  --json tagName,isLatest,isDraft,isPrerelease,publishedAt)

MATCHES=$(printf '%s' "$RELEASES" | jq -c --arg re "$PREFIX_RE" \
  '[.[] | select(.tagName | test($re))] | sort_by(.publishedAt) | reverse | .[]')

TOTAL=$(printf '%s' "$RELEASES" | jq 'length')
COUNT=0
if [ -n "$MATCHES" ]; then
  COUNT=$(printf '%s\n' "$MATCHES" | wc -l | tr -d ' ')
fi

if [ "$APPLY" = "true" ]; then
  echo "APPLY: mode=$MODE repo=$REPO prefixes=[$PREFIXES]"
else
  echo "DRY RUN: mode=$MODE repo=$REPO prefixes=[$PREFIXES]"
  echo "No changes will be made. Re-run with --apply to act."
fi
echo "Releases in repo: $TOTAL. Matching SDK prefixes: $COUNT."
echo

if [ "$COUNT" -eq 0 ]; then
  echo "Nothing to do."
  exit 0
fi

verb_for() {
  case "$MODE" in
    delete) echo "delete release, keep tag" ;;
    unlatest) echo "mark non-latest, keep release and tag" ;;
  esac
}

printf '%-13s %-22s %-20s %-7s %s\n' "ACTION" "TAG" "PUBLISHED" "LATEST" "NOTE"
FAILED=0
while IFS= read -r row; do
  tag=$(printf '%s' "$row" | jq -r .tagName)
  published=$(printf '%s' "$row" | jq -r .publishedAt)
  is_latest=$(printf '%s' "$row" | jq -r .isLatest)
  latest_mark="no"
  [ "$is_latest" = "true" ] && latest_mark="YES"

  if [ "$APPLY" = "true" ]; then
    action="$MODE"
  else
    action="would-$MODE"
  fi
  printf '%-13s %-22s %-20s %-7s %s\n' "$action" "$tag" "$published" "$latest_mark" "$(verb_for)"

  if [ "$APPLY" != "true" ]; then
    continue
  fi

  case "$MODE" in
    delete)
      # No --cleanup-tag: the tag ref must survive.
      if ! gh release delete "$tag" --repo "$REPO" --yes; then
        echo "  FAILED to delete release $tag" >&2
        FAILED=$((FAILED + 1))
        continue
      fi
      if gh api "repos/$REPO/git/ref/tags/$tag" >/dev/null 2>&1; then
        echo "  deleted release $tag; tag still present on origin"
      else
        echo "  WARNING: release $tag deleted but tag ref is missing on origin" >&2
        FAILED=$((FAILED + 1))
      fi
      ;;
    unlatest)
      if ! gh release edit "$tag" --repo "$REPO" --latest=false >/dev/null; then
        echo "  FAILED to edit release $tag" >&2
        FAILED=$((FAILED + 1))
        continue
      fi
      echo "  marked $tag non-latest"
      ;;
  esac
done <<< "$MATCHES"

echo
if [ "$APPLY" = "true" ]; then
  echo "Done. Failures: $FAILED."
  echo "Current Latest release:"
  gh release list --repo "$REPO" --limit 1000 --json tagName,isLatest \
    -q '.[] | select(.isLatest) | "  " + .tagName'
  [ "$FAILED" -eq 0 ] || exit 1
else
  echo "Dry run complete. $COUNT release(s) would be affected; no tags would be touched."
fi
