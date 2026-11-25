// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Written by scripts/generate-build-info.mjs during a Workers Builds
// install. The committed copy names no build, which is what a local
// checkout and the test suites run with. Do not commit a generated copy.
export const BUILD: { commit: string | null; date: string | null } = { commit: null, date: null };
