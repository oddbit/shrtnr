// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { ClickRepository, LinkRepository } from "../db";
import type { BreakdownDimension } from "../db/click-repository";
import { Env, TimelineRange } from "../types";
import { ServiceResult, ok, fail } from "./result";

export type { BreakdownDimension };

export async function getTrendingLinks(
  env: Env,
  range: TimelineRange,
  limit: number,
): Promise<ServiceResult<{ link_id: number; clicks: number; url: string; label: string | null }[]>> {
  return ok(await ClickRepository.getTrendingLinks(env.DB, range, limit));
}

export async function getGlobalBreakdown(
  env: Env,
  dimension: BreakdownDimension,
  range: TimelineRange,
  limit: number,
): Promise<ServiceResult<{ name: string; count: number }[]>> {
  return ok(await ClickRepository.getGlobalBreakdown(env.DB, dimension, range, limit));
}

export async function getTotalClicks(
  env: Env,
  range: TimelineRange,
): Promise<ServiceResult<{ total_clicks: number }>> {
  const count = await ClickRepository.getTotalClicks(env.DB, range);
  return ok({ total_clicks: count });
}

export async function getLinkBreakdown(
  env: Env,
  linkId: number,
  dimension: BreakdownDimension,
  range: TimelineRange,
  limit: number,
): Promise<ServiceResult<{ name: string; count: number }[]>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  return ok(await ClickRepository.getLinkBreakdown(env.DB, linkId, dimension, range, limit));
}

export interface LinkComparison {
  link_id: number;
  url: string;
  label: string | null;
  total_clicks: number;
  top_country: string | null;
  top_referrer: string | null;
}

export async function compareLinkStats(
  env: Env,
  linkIds: number[],
  range: TimelineRange,
): Promise<ServiceResult<LinkComparison[]>> {
  const results: LinkComparison[] = [];

  for (const id of linkIds) {
    const link = await LinkRepository.getById(env.DB, id);
    if (!link) return fail(404, `Link ${id} not found`);

    const stats = await ClickRepository.compareLinkStats(env.DB, id, range);
    results.push({
      link_id: id,
      url: link.url,
      label: link.label,
      ...stats,
    });
  }

  return ok(results);
}
