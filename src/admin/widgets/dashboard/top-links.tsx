// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "../types";
import type { Env, TimelineRange } from "../../../types";
import { ClickRepository, LinkRepository } from "../../../db";
import { fmtNumber } from "../../../i18n/format";
import { parseRangeParam } from "./_range";

interface TopLinksData {
  range: TimelineRange;
  rows: { link_id: number; clicks: number; url: string; label: string | null; slug: string }[];
}

/**
 * Most-clicked panel widget: renders the top five links by clicks for the
 * selected range. getTrendingLinks (one grouped query) returns no slug, so the
 * loader batch-fetches the primary slug for those link ids in a second bounded
 * query (LinkRepository.primarySlugByIds) and names each row by its slug, the
 * way the full dashboard page does. Two queries, both constant as the click
 * table grows. Emits the panel's inner content only; the htmx placeholder owns
 * the surrounding bento-card.
 */
export const topLinksWidget: AdminWidget<{ range: TimelineRange }, TopLinksData> = {
  id: "dashboard.top-links",
  shape: "list",
  cache: { ttl: 60 },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<TopLinksData> {
    const trending = await ClickRepository.getTrendingLinks(env.DB, range, 5, ctx.filters);
    const slugs = await LinkRepository.primarySlugByIds(env.DB, trending.map((r) => r.link_id));
    const rows = trending.map((r) => ({ ...r, slug: slugs.get(r.link_id) ?? "" }));
    return { range, rows };
  },
  render(d, ctx) {
    const t = ctx.t;
    const max = d.rows.reduce((s, r) => s + r.clicks, 0) || 1;
    return (
      <>
        <div class="bento-label">{t("dashboard.mostClicked")}</div>
        {d.rows.length === 0 ? (
          <div class="muted-hint">{t("dashboard.noData")}</div>
        ) : (
          d.rows.map((link) => {
            const pct = Math.round((link.clicks / max) * 100);
            return (
              <a href={`/_/admin/links/${link.link_id}`} class="top-link-row">
                <div class="stat-row">
                  <div class="name mono">
                    <span class="label">{link.slug || link.label || link.url}</span>
                  </div>
                  <div class="right">
                    <span class="count">{fmtNumber(link.clicks, ctx.lang)}</span>
                    <span class="pct">{pct}%</span>
                  </div>
                  <div class="bar"><div class="fill orange" style={`width:${pct}%`} /></div>
                </div>
                <div class="top-link-row-url">{link.url}</div>
              </a>
            );
          })
        )}
      </>
    );
  },
};
