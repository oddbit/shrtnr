// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env, TimelineRange } from "../types";
import {
  getDashboardStats,
  getLinkAnalytics,
  getLinkTimeline,
} from "../services/link-management";
import { fromServiceResult } from "./response";

const VALID_RANGES = new Set<TimelineRange>(["24h", "7d", "30d", "90d", "1y", "all"]);

export async function handleDashboardStats(env: Env, identity: string, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = VALID_RANGES.has(rangeParam as TimelineRange) ? (rangeParam as TimelineRange) : "30d";
  return fromServiceResult(await getDashboardStats(env, range, identity));
}

export async function handleLinkAnalytics(env: Env, identity: string, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange | undefined = VALID_RANGES.has(rangeParam as TimelineRange) ? (rangeParam as TimelineRange) : undefined;
  return fromServiceResult(await getLinkAnalytics(env, linkId, range, identity));
}

export async function handleLinkTimeline(env: Env, identity: string, linkId: number, rangeParam?: string | null): Promise<Response> {
  const range: TimelineRange = VALID_RANGES.has(rangeParam as TimelineRange) ? (rangeParam as TimelineRange) : "30d";
  return fromServiceResult(await getLinkTimeline(env, linkId, range, identity));
}
