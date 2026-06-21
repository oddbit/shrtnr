// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "../types";
import type { Env, TimelineRange } from "../../../types";
import { ClickRepository } from "../../../db";
import { computeDelta } from "../../../services/trends";
import { fmtNumber } from "../../../i18n/format";
import { KpiCard } from "../../../components/kpi-card";
import { parseRangeParam } from "./_range";

interface KpiData {
  range: TimelineRange;
  total_links: number;
  new_links_delta: number | undefined;
  clicked_links: number;
  clicked_links_delta: number | undefined;
  total_clicks: number;
  total_clicks_delta: number | undefined;
  clicks_per_day: number;
  clicks_per_day_delta: number | undefined;
  timeline: number[];
  timeline_links: number[];
  timeline_clicked_links: number[];
}

/**
 * KPI strip widget: renders the four dashboard headline cards (links, clicked
 * links, clicks, clicks/day) with their sparklines. The loader composes the
 * grouped ClickRepository period and sparkline queries, none of which fan out
 * per link, so the query count stays constant as the link table grows.
 */
export const kpisWidget: AdminWidget<{ range: TimelineRange }, KpiData> = {
  id: "dashboard.kpis",
  shape: "kpi",
  cache: { ttl: 30 },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<KpiData> {
    const ts = Math.floor(Date.now() / 1000);
    const [clicks, links, clickedLinks, spark, sparkLinks, sparkClicked, daySpan] = await Promise.all([
      ClickRepository.getPeriodClicks(env.DB, range, ts, undefined, ctx.filters),
      ClickRepository.getLinkCreationPeriods(env.DB, range, ts),
      ClickRepository.getClickedLinksPeriods(env.DB, range, ts, ctx.filters),
      ClickRepository.getSparkline(env.DB, range, ts, ctx.filters),
      ClickRepository.getLinksCreatedSparkline(env.DB, range, ts),
      ClickRepository.getClickedLinksSparkline(env.DB, range, ts, ctx.filters),
      ClickRepository.getDaySpan(env.DB, range, ts),
    ]);
    return {
      range,
      total_links: links.current,
      new_links_delta: computeDelta(links.current, links.previous),
      clicked_links: clickedLinks.current,
      clicked_links_delta: computeDelta(clickedLinks.current, clickedLinks.previous),
      total_clicks: clicks.current,
      total_clicks_delta: computeDelta(clicks.current, clicks.previous),
      clicks_per_day: daySpan > 0 ? Math.round(clicks.current / daySpan) : 0,
      clicks_per_day_delta: range === "all" ? undefined : computeDelta(clicks.current, clicks.previous),
      timeline: spark,
      timeline_links: sparkLinks,
      timeline_clicked_links: sparkClicked,
    };
  },
  render(d, ctx) {
    const lang = ctx.lang;
    const t = ctx.t;
    return (
      <>
        <KpiCard
          icon="link"
          label={t("dashboard.totalLinks")}
          value={fmtNumber(d.total_links, lang)}
          deltaPct={d.new_links_delta}
          lang={lang}
          sparkline={d.timeline_links}
        />
        <KpiCard
          icon="ads_click"
          label={t("dashboard.clickedLinks")}
          value={fmtNumber(d.clicked_links, lang)}
          deltaPct={d.clicked_links_delta}
          lang={lang}
          sparkline={d.timeline_clicked_links}
        />
        <KpiCard
          icon="mouse"
          label={t("dashboard.totalClicks")}
          value={fmtNumber(d.total_clicks, lang)}
          deltaPct={d.total_clicks_delta}
          lang={lang}
          sparkline={d.timeline}
        />
        <KpiCard
          icon="speed"
          label={t("dashboard.clicksPerDay")}
          value={fmtNumber(d.clicks_per_day, lang)}
          deltaPct={d.clicks_per_day_delta}
          lang={lang}
          sparkline={d.timeline}
        />
      </>
    );
  },
};
