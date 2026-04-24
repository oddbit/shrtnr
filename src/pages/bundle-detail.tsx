// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { BundleStats, TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";
import { countryName } from "../country";
import { BigChart } from "../components/big-chart";
import { RangePicker } from "../components/range-picker";
import { escHtml } from "../escape";
import { formatAvgPerDay } from "../services/trends";
import { fmtNumber } from "../i18n/format";
import { ACCESS_METHOD_OPTIONS, fillMissingOptions } from "../analytics-fill";

function deviceIcon(name: string): string {
  if (name === "mobile") return "phone_android";
  if (name === "tablet") return "tablet";
  return "computer";
}

function linkModeIcon(name: string): string {
  return name === "qr" ? "qr_code_2" : "link";
}

function osIcon(name: string): string {
  if (name === "ios") return "phone_iphone";
  if (name === "macos") return "laptop_mac";
  if (name === "android") return "android";
  if (name === "windows") return "desktop_windows";
  if (name === "linux" || name === "chromeos") return "computer";
  return "devices";
}

const StatBar: FC<{
  name: string;
  count: number;
  max: number;
  color: string;
  lang: string;
  icon?: string;
  flag?: string;
  mono?: boolean;
}> = ({ name, count, max, color, lang, icon, flag, mono }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div class="stat-row">
      <div class={`name${mono ? " mono" : ""}`}>
        {flag && <span class="flag">{flag}</span>}
        {icon && <span class="icon">{icon}</span>}
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

type Props = {
  stats: BundleStats;
  identity: string;
  t: TranslateFn;
  lang: string;
  range: TimelineRange;
};

export const BundleDetailPage: FC<Props> = ({ stats, identity, t, lang, range }) => {
  const b = stats.bundle;
  const isArchived = !!b.archived_at;
  const isOwner = b.created_by === identity;
  const now = Math.floor(Date.now() / 1000);

  const timelineValues = stats.timeline.buckets.map((x) => x.count);

  const countryTotal = stats.countries.reduce((s, c) => s + c.count, 0);
  const devTotal = stats.devices.reduce((s, c) => s + c.count, 0);
  const osTotal = stats.os.reduce((s, c) => s + c.count, 0);
  const brTotal = stats.browsers.reduce((s, c) => s + c.count, 0);
  const srcTotal = stats.referrers.reduce((s, c) => s + c.count, 0);
  const hostTotal = stats.referrer_hosts.reduce((s, c) => s + c.count, 0);
  const linkModes = fillMissingOptions(stats.link_modes, ACCESS_METHOD_OPTIONS);
  const modeTotal = linkModes.reduce((s, c) => s + c.count, 0);

  const maxLinkClicks = Math.max(1, stats.total_clicks);

  return (
    <>
      <div class="detail-header">
        <a href="/_/admin/bundles" class="detail-back" aria-label={t("bundles.backToBundles")}>
          <span class="icon icon-lg">arrow_back</span>
        </a>
        <div class="page-title">{t("bundles.detailTitle")}</div>
        <RangePicker current={range} basePath={`/_/admin/bundles/${b.id}`} />
        {isOwner && (
          <div class="detail-menu-anchor">
            <button
              class="btn btn-ghost btn-sm"
              onclick="toggleDetailMenu()"
              aria-label={t("linkDetail.moreActions")}
            >
              <span class="icon icon-lg">more_vert</span>
            </button>
            <div class="detail-menu" id="detail-menu" style="display:none">
              <button class="detail-menu-item" onclick={`showEditBundleModal(${b.id})`}>
                <span class="icon">edit</span> {t("bundles.editBundle")}
              </button>
              {isArchived ? (
                <button
                  class="detail-menu-item"
                  data-bundle-action="unarchive"
                  data-bundle-id={b.id}
                >
                  <span class="icon">unarchive</span> {t("bundles.unarchive")}
                </button>
              ) : (
                <button
                  class="detail-menu-item"
                  data-bundle-action="archive"
                  data-bundle-id={b.id}
                  data-bundle-name={b.name}
                >
                  <span class="icon">archive</span> {t("bundles.archive")}
                </button>
              )}
              <div class="detail-menu-divider" />
              <button
                class="detail-menu-item detail-menu-danger"
                data-bundle-action="delete"
                data-bundle-id={b.id}
                data-bundle-name={b.name}
              >
                <span class="icon">delete</span> {t("bundles.delete")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div class="detail-hero">
        <div class="left">
          <div class="bundle-hero-headline">
            <span class={`bundle-icon-badge accent-${b.accent}`}>
              <span class="icon">{b.icon ?? "inventory_2"}</span>
            </span>
            <span class="bundle-hero-name">{b.name}</span>
          </div>
          {isArchived && <div class="disabled-badge mb-sm">{t("bundles.archived")}</div>}
          {b.description && <div class="bundle-hero-description">{b.description}</div>}
          <div class="meta-row">
            {b.created_by && b.created_by !== "anonymous" && (
              <span class="m">
                <span class="icon">person</span>
                {t("bundles.createdBy")} <strong>{b.created_by}</strong>
              </span>
            )}
            <span class="m">
              <span class="icon">schedule</span>
              {t("bundles.createdOn")}{" "}
              <strong>
                {new Date(b.created_at * 1000).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" })}
              </strong>
            </span>
            {b.created_via && (
              <span class="m">
                <span class="icon">api</span>
                {t("linkDetail.via")} <strong>{b.created_via}</strong>
              </span>
            )}
            <span class="m">
              <span class="icon">link</span>
              {stats.link_count === 1
                ? t("bundles.linksCount", { count: stats.link_count })
                : t("bundles.linksCountPlural", { count: stats.link_count })}
            </span>
            {stats.link_count > 0 && (
              <span class="m">
                <span class="icon">ads_click</span>
                {t("bundles.clickedLinksHint", { count: stats.clicked_links, total: stats.link_count })}
              </span>
            )}
          </div>
        </div>
        <div class="right">
          <div class="hero-metric accent">
            <div class="n">{fmtNumber(stats.total_clicks, lang)}</div>
            <div class="l">{t("linkDetail.totalClicks")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{formatAvgPerDay(stats.total_clicks, range, b.created_at, now)}</div>
            <div class="l">{t("linkDetail.avgPerDay")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{stats.num_countries}</div>
            <div class="l">{t("linkDetail.countries")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{stats.num_referrer_hosts}</div>
            <div class="l">{t("linkDetail.domains")}</div>
          </div>
        </div>
      </div>

      {/* Links in this bundle, parallel to the slugs card on link detail. */}
      <div class="bento-card bundle-links-card mb-lg">
        <div class="bundle-links-card-head">
          <div class="bento-label">
            {t("bundles.linksInThisBundle")} · {stats.link_count}
          </div>
          <span class="bundle-links-card-hint">{t("bundles.sortedByClicks")}</span>
        </div>
        {stats.per_link.length === 0 ? (
          <div class="muted-hint">{t("bundles.noLinks")}</div>
        ) : (
          <div class="bundle-links-table">
            {stats.per_link.map((row) => {
              const pct = maxLinkClicks > 0 ? Math.round((row.click_count / maxLinkClicks) * 100) : 0;
              return (
                <a href={`/_/admin/links/${row.link_id}`} class="bundle-link-row">
                  <div class="bundle-link-head">
                    <span class={`slug-chip accent-${b.accent}`}>
                      <span class="icon">fiber_manual_record</span>
                      {row.primary_slug}
                    </span>
                    <div class="bundle-link-count">
                      <span class="count">{fmtNumber(row.click_count, lang)}</span>
                      <span class="pct">{row.pct_of_bundle}%</span>
                    </div>
                    {isOwner && (
                      <div class="bundle-link-actions">
                        <button
                          class="btn-icon btn-icon-danger"
                          onclick={`event.preventDefault();event.stopPropagation();removeLinkFromBundle(${b.id}, ${row.link_id})`}
                          title={t("bundles.removeFromBundle")}
                        >
                          <span class="icon">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div class="bundle-link-bar">
                    <div class="bundle-link-bar-fill" style={`width:${pct}%`} />
                  </div>
                  <div class="bundle-link-url">{row.url}</div>
                </a>
              );
            })}
          </div>
        )}
        {isOwner && (
          <button
            class="bundle-add-link-btn"
            onclick={`showAddLinkToBundlePicker(${b.id},[${stats.per_link.map((r) => r.link_id).join(",")}])`}
            type="button"
          >
            <span class="icon">add</span> {t("bundles.addLinkToBundle")}
          </button>
        )}
      </div>

      {/* Analytics grid. Mirrors link-detail's layout exactly. */}
      <div class="detail-analytics">
        <div class="detail-analytics-left">
          <div class="bento-card timeline-card">
            <div class="timeline-head">
              <div class="timeline-head-main">
                <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
                <div class="timeline-total-row">
                  <span class="timeline-total">{fmtNumber(stats.total_clicks, lang)}</span>
                  <span class="timeline-total-label">{t("linkDetail.clicksInRange")}</span>
                </div>
              </div>
            </div>
            <div class="timeline-chart">
              {timelineValues.length > 0 ? (
                <BigChart values={timelineValues} range={range} t={t} id="bundle-bigchart" />
              ) : (
                <div class="empty-card-hint">{t("linkDetail.noClickData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-head">
              <div class="bento-label">{t("linkDetail.countries")}</div>
              {stats.num_countries > 0 && (
                <div class="bento-count">{fmtNumber(stats.num_countries, lang)}</div>
              )}
            </div>
            <div class="stat-card-body">
              {stats.countries.length > 0 ? (
                stats.countries.map((c) => (
                  <StatBar
                    name={countryName(c.name, lang)}
                    flag={c.name}
                    count={c.count}
                    max={countryTotal || 1}
                    color="orange"
                    lang={lang}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-head">
              <div class="bento-label">{t("linkDetail.domains")}</div>
              {stats.num_referrer_hosts > 0 && (
                <div class="bento-count">{fmtNumber(stats.num_referrer_hosts, lang)}</div>
              )}
            </div>
            <div class="stat-card-body">
              {stats.referrer_hosts.length > 0 ? (
                stats.referrer_hosts.map((r) => (
                  <StatBar
                    name={r.name}
                    count={r.count}
                    max={hostTotal || 1}
                    color="mint"
                    mono
                    lang={lang}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-head">
              <div class="bento-label">{t("linkDetail.sources")}</div>
              {stats.num_referrers > 0 && (
                <div class="bento-count">{fmtNumber(stats.num_referrers, lang)}</div>
              )}
            </div>
            <div class="stat-card-body">
              {stats.referrers.length > 0 ? (
                stats.referrers.map((r) => (
                  <StatBar
                    name={r.name}
                    count={r.count}
                    max={srcTotal || 1}
                    color="mint"
                    mono
                    lang={lang}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>
        </div>

        <div class="detail-analytics-right">
          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.linkModes")}</div>
            <div class="stat-card-body">
              {linkModes.map((m) => (
                <StatBar
                  name={m.name}
                  count={m.count}
                  max={modeTotal || 1}
                  color="orange"
                  icon={linkModeIcon(m.name)}
                  lang={lang}
                />
              ))}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.devices")}</div>
            <div class="stat-card-body">
              {stats.devices.length > 0 ? (
                stats.devices.map((d) => (
                  <StatBar
                    name={d.name}
                    count={d.count}
                    max={devTotal || 1}
                    color="orange"
                    icon={deviceIcon(d.name)}
                    lang={lang}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-head">
              <div class="bento-label">{t("linkDetail.os")}</div>
              {stats.num_os > 0 && (
                <div class="bento-count">{fmtNumber(stats.num_os, lang)}</div>
              )}
            </div>
            <div class="stat-card-body">
              {stats.os.length > 0 ? (
                stats.os.map((o) => (
                  <StatBar
                    name={o.name}
                    count={o.count}
                    max={osTotal || 1}
                    color="mint"
                    icon={osIcon(o.name)}
                    lang={lang}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-head">
              <div class="bento-label">{t("linkDetail.browsers")}</div>
              {stats.num_browsers > 0 && (
                <div class="bento-count">{fmtNumber(stats.num_browsers, lang)}</div>
              )}
            </div>
            <div class="stat-card-body">
              {stats.browsers.length > 0 ? (
                stats.browsers.map((br) => (
                  <StatBar
                    name={br.name}
                    count={br.count}
                    max={brTotal || 1}
                    color="mint"
                    lang={lang}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
