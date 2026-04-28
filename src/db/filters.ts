// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Per-query filters resolved from the caller's settings. Both flags default to
 * undefined (no filter) so low-level callers and tests keep their raw
 * semantics; service-layer callers resolve them from user settings so
 * dashboards honor toggles.
 */
export type ClickFilters = {
  excludeBots?: boolean;
  excludeSelfReferrers?: boolean;
};

/**
 * SQL fragment like ` AND is_bot = 0 AND is_self_referrer = 0`, or empty.
 * Pass `alias` when the clicks table is joined with an alias.
 */
export function clickFilterSql(filters?: ClickFilters, alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  const parts: string[] = [];
  if (filters?.excludeBots) parts.push(`${prefix}is_bot = 0`);
  if (filters?.excludeSelfReferrers) parts.push(`${prefix}is_self_referrer = 0`);
  return parts.length ? " AND " + parts.join(" AND ") : "";
}

/**
 * Options for the per-slug click_count subquery used by Link, Slug and Bundle
 * repositories. Callers that want raw lifetime counts (slug deletion guards,
 * redirect resolution) pass nothing.
 */
export interface SlugClickCountOptions {
  filters?: ClickFilters;
  sinceTs?: number;
}

/**
 * SELECT-clause fragment that computes a per-slug `click_count` column,
 * optionally filtered by bot/self-referrer flags and lower-bounded by
 * `clicked_at >= sinceTs`. The fragment depends on the outer query aliasing
 * the slugs table as `s`.
 */
export function slugClickCountSql(opts?: SlugClickCountOptions): string {
  let frag = "(SELECT COUNT(*) FROM clicks c WHERE c.slug = s.slug";
  frag += clickFilterSql(opts?.filters, "c");
  if (opts?.sinceTs !== undefined) {
    frag += ` AND c.clicked_at >= ${Math.floor(opts.sinceTs)}`;
  }
  return frag + ") AS click_count";
}
