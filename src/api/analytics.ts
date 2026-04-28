// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env, TimelineRange } from "../types";
import {
  getDashboardStats,
  getLinkAnalytics,
  getLinkTimeline,
} from "../services/link-management";
import { resolveClickFilters } from "../services/admin-management";
import { fromServiceResult } from "./response";

const VALID_RANGES = new Set<TimelineRange>(["24h", "7d", "30d", "90d", "1y", "all"]);

function parseRange(rangeParam: string | null | undefined): TimelineRange | undefined {
  return VALID_RANGES.has(rangeParam as TimelineRange) ? (rangeParam as TimelineRange) : undefined;
}

export async function handleDashboardStats(env: Env, identity: string, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = parseRange(rangeParam) ?? "30d";
  return fromServiceResult(await getDashboardStats(env, range, identity));
}

/**
 * Admin-side: applies the viewer's filter preferences and falls back to
 * undefined (all-time) when no range is provided. The admin client always
 * passes a range explicitly, so this fallback is rare.
 */
export async function handleAdminLinkAnalytics(env: Env, identity: string, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range = parseRange(rangeParam);
  const filters = await resolveClickFilters(env, identity);
  return fromServiceResult(await getLinkAnalytics(env, linkId, range, filters));
}

/**
 * Public API: returns raw click counts (no per-identity filter) and defaults
 * to all-time when no ?range= is provided. SDK callers can opt in to a window
 * via the optional range query parameter.
 */
export async function handlePublicLinkAnalytics(env: Env, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range = parseRange(rangeParam) ?? "all";
  return fromServiceResult(await getLinkAnalytics(env, linkId, range));
}

export async function handleAdminLinkTimeline(env: Env, identity: string, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = parseRange(rangeParam) ?? "30d";
  const filters = await resolveClickFilters(env, identity);
  return fromServiceResult(await getLinkTimeline(env, linkId, range, filters));
}

export async function handlePublicLinkTimeline(env: Env, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = parseRange(rangeParam) ?? "all";
  return fromServiceResult(await getLinkTimeline(env, linkId, range));
}
