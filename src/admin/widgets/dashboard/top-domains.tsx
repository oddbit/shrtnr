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
 * the selected range. The loader pulls the top five referrer hosts; the header
 * count uses the returned row count rather than the page's distinct-host query,
 * so the panel runs a single grouped query that stays constant as the click
 * table grows. With a five-row cap that count tracks the page exactly until a
 * sixth distinct host appears, at which point it under-reports by design.
 * Emits the top-domains panel's inner content only; the htmx placeholder owns
 * the surrounding bento-card.
 */
export const topDomainsWidget: AdminWidget<{ range: TimelineRange }, TopDomainsData> = {
  id: "dashboard.top-domains",
  shape: "list",
  cache: { ttl: 60 },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<TopDomainsData> {
    const rows = await ClickRepository.getGlobalBreakdown(env.DB, "referrer_host", range, 5, ctx.filters);
    return { range, rows, num: rows.length };
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
