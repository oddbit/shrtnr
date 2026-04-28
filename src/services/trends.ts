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
 * Lower-bound timestamp for a given range. `all` returns undefined so callers
 * can drop the time filter from a SLUG_SELECT subquery and count lifetime.
 */
export function rangeToSinceTs(range: TimelineRange | undefined, now?: number): number | undefined {
  if (!range || range === "all") return undefined;
  const ts = now ?? Math.floor(Date.now() / 1000);
  return ts - RANGE_SECONDS[range];
}

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

/**
 * Days to divide by when averaging range-scoped click counts into a per-day rate.
 * Finite ranges use the window size directly so the daily average reflects the
 * selected period. Range "all" falls back to the entity's lifetime, floored at one
 * day so a brand-new entity does not produce an inflated rate.
 */
function avgPerDayDivisor(range: TimelineRange, createdAt: number, now: number): number {
  if (range !== "all") return RANGE_SECONDS[range] / 86400;
  const seconds = Math.max(1, now - createdAt);
  return Math.max(1, seconds / 86400);
}

/**
 * Display string for the avg/day hero metric on link and bundle detail pages.
 * Range-scoped `totalClicks` is divided by the selected window so the metric
 * answers "how many clicks per day in this period" rather than lifetime.
 */
export function formatAvgPerDay(
  totalClicks: number,
  range: TimelineRange,
  createdAt: number,
  now: number,
): string {
  const days = avgPerDayDivisor(range, createdAt, now);
  const avg = totalClicks / days;
  if (avg === 0) return "0";
  if (avg < 1) return avg.toFixed(2);
  if (avg < 10) return avg.toFixed(1);
  return Math.round(avg).toString();
}
