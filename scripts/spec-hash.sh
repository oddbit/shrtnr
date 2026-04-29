#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
yarn -s emit-spec | shasum -a 256 | awk '{print $1}'
