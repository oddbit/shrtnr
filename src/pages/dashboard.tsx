// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { DashboardStats, LinkWithSlugs, TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";
import { countryName } from "../country";
import { KpiCard } from "../components/kpi-card";
import { RangePicker } from "../components/range-picker";
import { BigChart } from "../components/big-chart";
import { escHtml } from "../escape";
import { fmtNumber } from "../i18n/format";

const StatBar: FC<{
  name: string;
  count: number;
  max: number;
  color: string;
  lang: string;
  flag?: string;
  mono?: boolean;
}> = ({ name, count, max, color, lang, flag, mono }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div class="stat-row">
      <div class={`name${mono ? " mono" : ""}`}>
        {flag && <span class="flag">{flag}</span>}
        <span class="label">{name}</span>
      </div>
      <div class="right">
        <span class="count">{fmtNumber(count, lang)}</span>
        <span class="pct">{pct}%</span>
      </div>
      <div class="bar"><div class={`fill ${color}`} style={`width:${pct}%`} /></div>
    </div>
  );
};

function primarySlug(link: LinkWithSlugs): string {
  const p = link.slugs.find((s) => !s.is_custom);
  return p ? p.slug : link.slugs[0]?.slug || "";
}

type Props = {
  stats: DashboardStats;
  t: TranslateFn;
  lang: string;
  range: TimelineRange;
};

export const DashboardPage: FC<Props> = ({ stats, t, lang, range }) => {
  const d = stats;
  const topCountryMax = d.top_countries.reduce((s, i) => s + i.count, 0) || 1;
  const topRefMax = d.top_referrers.reduce((s, i) => s + i.count, 0) || 1;
  const topLinkMax = d.top_links.reduce((s, i) => s + i.total_clicks, 0) || 1;

  return (
    <>
      <div class="page-header topbar">
        <div>
          <div class="page-title">{t("dashboard.title")}</div>
          <div class="page-subtitle">{t("dashboard.subtitle")}</div>
        </div>
        <div class="topbar-actions">
          <RangePicker current={range} basePath="/_/admin/dashboard" />
        </div>
      </div>

      <div class="hero-input-wrap">
        <input
          class="hero-input"
          id="quick-url"
          type="text"
          placeholder={t("links.inputPlaceholder")}
        />
        <button class="btn btn-primary btn-lg" id="quick-action-btn" onclick="quickShorten()">
          <span class="icon" id="quick-action-icon">bolt</span> <span id="quick-action-label">{t("dashboard.shorten")}</span>
        </button>
      </div>

      <div class="kpi-strip" id="dashboard-kpi-strip">
        <KpiCard
          id="dash-kpi-links"
          icon="link"
          label={t("dashboard.totalLinks")}
          value={fmtNumber(d.total_links, lang)}
          valueId="dash-total-links"
          deltaPct={d.new_links_delta}
          deltaId="dash-links-delta"
          sparkline={d.timeline_links}
        />
        <KpiCard
          id="dash-kpi-clicked-links"
          icon="ads_click"
          label={t("dashboard.clickedLinks")}
          value={fmtNumber(d.clicked_links, lang)}
          valueId="dash-clicked-links"
          deltaPct={d.clicked_links_delta}
          deltaId="dash-clicked-links-delta"
          sparkline={d.timeline_clicked_links}
        />
        <KpiCard
          id="dash-kpi-clicks"
          icon="mouse"
          label={t("dashboard.totalClicks")}
          value={fmtNumber(d.total_clicks, lang)}
          valueId="dash-total-clicks"
          deltaPct={d.total_clicks_delta}
          deltaId="dash-clicks-delta"
          sparkline={d.timeline}
        />
        <KpiCard
          id="dash-kpi-clicks-per-day"
          icon="speed"
          label={t("dashboard.clicksPerDay")}
          value={fmtNumber(d.clicks_per_day, lang)}
          valueId="dash-clicks-per-day"
          deltaPct={d.clicks_per_day_delta}
          deltaId="dash-clicks-per-day-delta"
          sparkline={d.timeline}
        />
      </div>

      <div class="bento" id="dashboard-bento">
        <div class="bento-card span-2 timeline-card" id="dash-timeline">
          <div class="timeline-head">
            <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
            <span class="timeline-range-pill">{t(`range.long.${range}` as const)}</span>
          </div>
          <div class="timeline-chart">
            <BigChart values={d.timeline} range={range} t={t} id="dash-bigchart" />
          </div>
        </div>

        <div class="bento-card" id="dash-top-countries">
          <div class="bento-head">
            <div class="bento-label">{t("dashboard.topCountries")}</div>
            <div class="bento-count">{fmtNumber(d.num_countries, lang)}</div>
          </div>
          {d.top_countries.length === 0 ? (
            <div class="muted-hint">{t("dashboard.noData")}</div>
          ) : (
            d.top_countries.map((c) => (
              <StatBar
                name={countryName(c.name, lang)}
                flag={c.name}
                count={c.count}
                max={topCountryMax}
                color="orange"
                lang={lang}
              />
            ))
          )}
        </div>

        <div class="bento-card span-2" id="dash-top-links">
          <div class="bento-label">{t("dashboard.mostClicked")}</div>
          {d.top_links.length === 0 ? (
            <div class="muted-hint">{t("dashboard.noData")}</div>
          ) : (
            d.top_links.map((link) => {
              const slug = primarySlug(link);
              const pct = Math.round((link.total_clicks / topLinkMax) * 100);
              return (
                <a href={`/_/admin/links/${link.id}`} class="top-link-row">
                  <div class="stat-row">
                    <div class="name mono">
                      <span class="label">{slug}</span>
                    </div>
                    <div class="right">
                      <span class="count">{fmtNumber(link.total_clicks, lang)}</span>
                      <span class="pct">{pct}%</span>
                    </div>
                    <div class="bar"><div class="fill orange" style={`width:${pct}%`} /></div>
                  </div>
                  <div class="top-link-row-url">{link.url}</div>
                </a>
              );
            })
          )}
        </div>

        <div class="bento-card" id="dash-top-sources">
          <div class="bento-head">
            <div class="bento-label">{t("dashboard.topReferrers")}</div>
          </div>
          {d.top_referrers.length === 0 ? (
            <div class="muted-hint">{t("dashboard.noData")}</div>
          ) : (
            d.top_referrers.map((r) => (
              <StatBar
                name={r.name}
                count={r.count}
                max={topRefMax}
                color="mint"
                lang={lang}
              />
            ))
          )}
        </div>

        <div class="bento-card span-3" id="dash-recent-links">
          <div class="bento-label">{t("dashboard.recentLinks")}</div>
          {d.recent_links.length === 0 ? (
            <div class="muted-hint">{t("dashboard.noLinks")}</div>
          ) : (
            d.recent_links.map((link) => {
              const slug = primarySlug(link);
              return (
                <a href={`/_/admin/links/${link.id}`} class="recent-row">
                  <span
                    class="slug-chip"
                    onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(slug)}')`}
                    title={t("dashboard.clickToCopy")}
                  >
                    {slug}{" "}
                    <span class="icon">content_copy</span>
                  </span>
                  <span class="recent-row-url">{link.url}</span>
                  <span class="recent-row-clicks">{link.total_clicks}</span>
                </a>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
