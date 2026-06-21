// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "../types";
import type { Env, TimelineRange } from "../../../types";
import { ClickRepository } from "../../../db";
import { BigChart } from "../../../components/big-chart";
import { parseRangeParam } from "./_range";

interface TimelineData {
  range: TimelineRange;
  values: number[];
}

/**
 * Timeline card widget: renders the dashboard "clicks over time" chart for the
 * selected range. The loader pulls the single range-bucketed sparkline series
 * from ClickRepository.getSparkline, so the query count stays constant as the
 * link table grows. Renders the timeline card's inner content only; the htmx
 * placeholder owns the surrounding bento-card.
 */
export const timelineWidget: AdminWidget<{ range: TimelineRange }, TimelineData> = {
  id: "dashboard.timeline",
  shape: "chart",
  cache: { ttl: 30 },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<TimelineData> {
    const values = await ClickRepository.getSparkline(
      env.DB,
      range,
      Math.floor(Date.now() / 1000),
      ctx.filters,
    );
    return { range, values };
  },
  render(d, ctx) {
    const t = ctx.t;
    return (
      <>
        <div class="timeline-head">
          <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
          <span class="timeline-range-pill">{t(`range.long.${d.range}` as const)}</span>
        </div>
        <div class="timeline-chart">
          <BigChart values={d.values} range={d.range} t={t} id="dash-bigchart" />
        </div>
      </>
    );
  },
};
