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
 * Trailing conditions every click-count subquery shares: the bot and
 * self-referrer filters, then the `clicked_at >= sinceTs` lower bound. Both
 * count fragments below append this one string, so the invariant that popular
 * ordering and the rendered totals count the same clicks is structural rather
 * than a pair of matching copies. Assumes the subquery aliases clicks as `c`.
 */
function clickWindowSql(opts?: SlugClickCountOptions): string {
  let frag = clickFilterSql(opts?.filters, "c");
  if (opts?.sinceTs !== undefined) {
    frag += ` AND c.clicked_at >= ${Math.floor(opts.sinceTs)}`;
  }
  return frag;
}

/**
 * SELECT-clause fragment that computes a per-slug `click_count` column,
 * optionally filtered by bot/self-referrer flags and lower-bounded by
 * `clicked_at >= sinceTs`. The fragment depends on the outer query aliasing
 * the slugs table as `s`.
 */
export function slugClickCountSql(opts?: SlugClickCountOptions): string {
  return `(SELECT COUNT(*) FROM clicks c WHERE c.slug = s.slug${clickWindowSql(opts)}) AS click_count`;
}

/**
 * Scalar subquery totalling a link's clicks across all its slugs. Shares
 * `clickWindowSql` with `slugClickCountSql`, so it counts exactly the clicks
 * the caller will render. Use it to order a link query by popularity in SQL
 * and the ranking matches the printed `total_clicks`. Pass the alias the
 * outer query gives the links table.
 */
export function linkClickCountSql(opts?: SlugClickCountOptions, linkAlias = "l"): string {
  return (
    `(SELECT COUNT(*) FROM clicks c JOIN slugs cs ON c.slug = cs.slug` +
    ` WHERE cs.link_id = ${linkAlias}.id${clickWindowSql(opts)})`
  );
}
