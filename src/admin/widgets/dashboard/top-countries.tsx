// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "../types";
import type { Env, TimelineRange } from "../../../types";
import { ClickRepository } from "../../../db";
import { StatBar } from "../../../components/stat-bar";
import { countryName } from "../../../country";
import { fmtNumber } from "../../../i18n/format";
import { parseRangeParam } from "./_range";

interface TopCountriesData {
  range: TimelineRange;
  rows: { name: string; count: number }[];
  num: number;
}

/**
 * Top-countries panel widget: renders the dashboard country breakdown for the
 * selected range. The loader pulls the top five origins and the distinct
 * country count in two grouped queries, so the query count stays constant as
 * the click table grows. Emits the top-countries panel's inner content only;
 * the htmx placeholder owns the surrounding bento-card shell.
 */
export const topCountriesWidget: AdminWidget<{ range: TimelineRange }, TopCountriesData> = {
  id: "dashboard.top-countries",
  shape: "list",
  cache: { ttl: 60 },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<TopCountriesData> {
    const [rows, num] = await Promise.all([
      ClickRepository.getGlobalBreakdown(env.DB, "country", range, 5, ctx.filters),
      ClickRepository.getCountryCount(env.DB, range, Math.floor(Date.now() / 1000), ctx.filters),
    ]);
    return { range, rows, num };
  },
  render(d, ctx) {
    const t = ctx.t;
    const max = d.rows.reduce((s, r) => s + r.count, 0) || 1;
    return (
      <>
        <div class="bento-head">
          <div class="bento-label">{t("dashboard.topCountries")}</div>
          <div class="bento-count">{fmtNumber(d.num, ctx.lang)}</div>
        </div>
        {d.rows.length === 0 ? (
          <div class="muted-hint">{t("dashboard.noData")}</div>
        ) : (
          d.rows.map((c) => (
            <StatBar
              name={countryName(c.name, ctx.lang)}
              flag={c.name}
              count={c.count}
              max={max}
              color="orange"
              lang={ctx.lang}
            />
          ))
        )}
      </>
    );
  },
};
