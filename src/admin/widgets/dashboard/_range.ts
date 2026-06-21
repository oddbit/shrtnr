// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Context } from "hono";
import type { TimelineRange } from "../../../types";
import { TIMELINE_RANGES, DEFAULT_TIMELINE_RANGE } from "../../../constants";

const VALID = new Set<TimelineRange>(TIMELINE_RANGES);

/**
 * Shared `?range=` parser for dashboard widgets. Validates the query value
 * against TIMELINE_RANGES and falls back to DEFAULT_TIMELINE_RANGE so every
 * widget resolves the selected window the same way.
 */
export function parseRangeParam(c: Context): { range: TimelineRange } {
  const r = c.req.query("range");
  return { range: VALID.has(r as TimelineRange) ? (r as TimelineRange) : DEFAULT_TIMELINE_RANGE };
}
