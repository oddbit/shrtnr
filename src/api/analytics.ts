// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env, TimelineRange } from "../types";
import { DEFAULT_TIMELINE_RANGE, TIMELINE_RANGES } from "../constants";
import {
  getDashboardStats,
  getLinkAnalytics,
  getLinkBreakdownPage,
  getLinkTimeline,
} from "../services/link-management";
import { getBundleBreakdownPage } from "../services/bundle-management";
import { resolveClickFilters } from "../services/admin-management";
import { fromServiceResult } from "./response";

export interface BreakdownParams {
  dimension: string;
  range?: string | null;
  offset?: number;
  limit?: number;
}

const VALID_RANGES = new Set<TimelineRange>(TIMELINE_RANGES);

function parseRange(rangeParam: string | null | undefined): TimelineRange | undefined {
  return VALID_RANGES.has(rangeParam as TimelineRange) ? (rangeParam as TimelineRange) : undefined;
}

export async function handleDashboardStats(env: Env, identity: string, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = parseRange(rangeParam) ?? DEFAULT_TIMELINE_RANGE;
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
  const range: TimelineRange = parseRange(rangeParam) ?? DEFAULT_TIMELINE_RANGE;
  const filters = await resolveClickFilters(env, identity);
  return fromServiceResult(await getLinkTimeline(env, linkId, range, filters));
}

export async function handlePublicLinkTimeline(env: Env, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = parseRange(rangeParam) ?? "all";
  return fromServiceResult(await getLinkTimeline(env, linkId, range));
}

// ---- Breakdown pagination (countries, referrers, referrer_hosts) ----

export async function handlePublicLinkBreakdown(env: Env, linkId: number, p: BreakdownParams): Promise<Response> {
  const range = parseRange(p.range) ?? "all";
  return fromServiceResult(await getLinkBreakdownPage(env, linkId, p.dimension, range, p.offset ?? 0, p.limit ?? 0));
}

export async function handleAdminLinkBreakdown(env: Env, identity: string, linkId: number, p: BreakdownParams): Promise<Response> {
  const range = parseRange(p.range) ?? "all";
  const filters = await resolveClickFilters(env, identity);
  return fromServiceResult(await getLinkBreakdownPage(env, linkId, p.dimension, range, p.offset ?? 0, p.limit ?? 0, filters));
}

export async function handlePublicBundleBreakdown(env: Env, bundleId: number, p: BreakdownParams): Promise<Response> {
  const range = parseRange(p.range) ?? "all";
  return fromServiceResult(await getBundleBreakdownPage(env, bundleId, p.dimension, range, p.offset ?? 0, p.limit ?? 0));
}

export async function handleAdminBundleBreakdown(env: Env, identity: string, bundleId: number, p: BreakdownParams): Promise<Response> {
  const range = parseRange(p.range) ?? "all";
  const filters = await resolveClickFilters(env, identity);
  return fromServiceResult(await getBundleBreakdownPage(env, bundleId, p.dimension, range, p.offset ?? 0, p.limit ?? 0, { filters }));
}
