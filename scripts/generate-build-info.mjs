// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Records the commit a Workers Builds deployment is built from, so the
 * settings page can name the build beside the version.
 *
 * Runs as the `postinstall` script. Workers Builds installs dependencies
 * before every build and sets WORKERS_CI_COMMIT_SHA, and the install is the
 * one step a fork runs without a configured build command. Anywhere else the
 * script does nothing: a local checkout keeps the committed module, which
 * names no build.
 *
 * Plain Node with no dependencies, and it never fails: a missing commit or
 * an unwritable file costs the build line, not the install.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "build-info.generated.ts");

function commitDate(commit) {
  // The clone may be shallow or absent. The build runs minutes after the
  // push, so the build time stands in for the commit time.
  try {
    const iso = execFileSync("git", ["show", "-s", "--format=%cI", commit], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (iso && !Number.isNaN(Date.parse(iso))) return new Date(iso).toISOString();
  } catch {
    // Fall through to the build time.
  }
  return new Date().toISOString();
}

try {
  const commit = (process.env.WORKERS_CI_COMMIT_SHA ?? "").trim().toLowerCase();
  if (process.env.WORKERS_CI && /^[0-9a-f]{7,40}$/.test(commit)) {
    const build = { commit, date: commitDate(commit) };
    const source = [
      "// Copyright 2026 Oddbit (https://oddbit.id)",
      "// SPDX-License-Identifier: Apache-2.0",
      "",
      "// Written by scripts/generate-build-info.mjs during a Workers Builds",
      "// install. Do not commit a generated copy.",
      `export const BUILD: { commit: string | null; date: string | null } = ${JSON.stringify(build)};`,
      "",
    ].join("\n");
    fs.writeFileSync(outFile, source);
    console.log(`Recorded build ${commit.slice(0, 7)} (${build.date}).`);
  }
} catch (err) {
  console.warn(`Build info not recorded: ${err instanceof Error ? err.message : String(err)}`);
}
