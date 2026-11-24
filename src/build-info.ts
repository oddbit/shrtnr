// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { BUILD } from "./build-info.generated";

/** The commit a deployment was built from, and when that commit was made. */
export interface BuildInfo {
  /** Full or abbreviated commit hash, lowercase hex. Null when the build did not record one. */
  commit: string | null;
  /** ISO 8601 instant. Null when unknown. */
  date: string | null;
}

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;

/**
 * The values come from the build environment and are written into the admin
 * script, so only a commit hash and a parseable date pass. A date without a
 * commit says nothing about the build and is dropped with it.
 */
export function sanitizeBuildInfo(raw: unknown): BuildInfo {
  if (typeof raw !== "object" || raw === null) return { commit: null, date: null };
  const { commit, date } = raw as { commit?: unknown; date?: unknown };
  if (typeof commit !== "string" || !COMMIT_PATTERN.test(commit)) return { commit: null, date: null };
  const validDate = typeof date === "string" && date !== "" && !Number.isNaN(Date.parse(date));
  return { commit, date: validDate ? date : null };
}

export const buildInfo: BuildInfo = sanitizeBuildInfo(BUILD);
