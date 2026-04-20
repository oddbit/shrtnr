// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { TimelineRange } from "../types";

export const RANGE_SECONDS: Record<Exclude<TimelineRange, "all">, number> = {
  "24h": 86400,
  "7d": 7 * 86400,
  "30d": 30 * 86400,
  "90d": 90 * 86400,
  "1y": 365 * 86400,
};

/**
 * Percent change from previous to current, rounded to nearest integer.
 * Returns `undefined` when there is no baseline to compare against (previous is 0),
 * which callers use to suppress the trend pill.
 */
export function computeDelta(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  if (current === previous) return 0;
  return Math.round(((current - previous) / previous) * 100);
}
