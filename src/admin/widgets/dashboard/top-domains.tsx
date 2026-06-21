// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "../types";
import type { Env, TimelineRange } from "../../../types";
import { ClickRepository } from "../../../db";
import { StatBar } from "../../../components/stat-bar";
import { fmtNumber } from "../../../i18n/format";
import { parseRangeParam } from "./_range";

interface TopDomainsData {
  range: TimelineRange;
  rows: { name: string; count: number }[];
  num: number;
}

/**
 * Top-domains panel widget: renders the dashboard referrer-host breakdown for
 * the selected range. Lists the top five hosts and shows the exact distinct
 * host count in the header (a dedicated COUNT(DISTINCT) query), so the count
 * stays accurate past the five-row cap. Two grouped queries, both constant as
 * the click table grows. Emits the panel's inner content only; the htmx
 * placeholder owns the surrounding bento-card.
 */
export const topDomainsWidget: AdminWidget<{ range: TimelineRange }, TopDomainsData> = {
  id: "dashboard.top-domains",
  shape: "list",
  cache: { ttl: 60 },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<TopDomainsData> {
    const [rows, num] = await Promise.all([
      ClickRepository.getGlobalBreakdown(env.DB, "referrer_host", range, 5, ctx.filters),
      ClickRepository.getBreakdownDistinctCount(env.DB, "referrer_host", range, ctx.filters),
    ]);
    return { range, rows, num };
  },
  render(d, ctx) {
    const t = ctx.t;
    const max = d.rows.reduce((s, r) => s + r.count, 0) || 1;
    return (
      <>
        <div class="bento-head">
          <div class="bento-label">{t("dashboard.topDomains")}</div>
          {d.num > 0 && <div class="bento-count">{fmtNumber(d.num, ctx.lang)}</div>}
        </div>
        {d.rows.length === 0 ? (
          <div class="muted-hint">{t("dashboard.noData")}</div>
        ) : (
          d.rows.map((r) => (
            <StatBar name={r.name} count={r.count} max={max} color="mint" lang={ctx.lang} />
          ))
        )}
      </>
    );
  },
};
