// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { BundleStats, TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";
import { countryName } from "../country";
import { BigChart } from "../components/big-chart";
import { Delta } from "../components/delta";
import { RangePicker } from "../components/range-picker";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avgPerDay(totalClicks: number, createdAt: number, now: number): string {
  const seconds = Math.max(1, now - createdAt);
  const days = Math.max(1, seconds / 86400);
  const avg = totalClicks / days;
  if (avg === 0) return "0";
  if (avg < 1) return avg.toFixed(2);
  if (avg < 10) return avg.toFixed(1);
  return Math.round(avg).toString();
}

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
  icon?: string;
  flag?: string;
  mono?: boolean;
}> = ({ name, count, max, color, icon, flag, mono }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div class="stat-row">
      <div class={`name${mono ? " mono" : ""}`}>
        {flag && <span class="flag">{flag}</span>}
        {icon && <span class="icon">{icon}</span>}
        <span class="label">{name}</span>
      </div>
      <div class="right">
        <span class="count">{count.toLocaleString()}</span>
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
  const refTotal = stats.referrers.reduce((s, c) => s + c.count, 0);
  const modeTotal = stats.link_modes.reduce((s, c) => s + c.count, 0);

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
                <button class="detail-menu-item" onclick={`unarchiveBundle(${b.id})`}>
                  <span class="icon">unarchive</span> {t("bundles.unarchive")}
                </button>
              ) : (
                <button class="detail-menu-item" onclick={`archiveBundle(${b.id}, '${escHtml(b.name)}')`}>
                  <span class="icon">archive</span> {t("bundles.archive")}
                </button>
              )}
              <div class="detail-menu-divider" />
              <button class="detail-menu-item detail-menu-danger" onclick={`deleteBundleAction(${b.id}, '${escHtml(b.name)}')`}>
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
            <div class="n">{stats.total_clicks.toLocaleString()}</div>
            <div class="l">{t("linkDetail.totalClicks")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{avgPerDay(stats.total_clicks, b.created_at, now)}</div>
            <div class="l">{t("linkDetail.avgPerDay")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{stats.countries.length}</div>
            <div class="l">{t("linkDetail.countries")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{stats.referrers.length}</div>
            <div class="l">{t("linkDetail.referrers")}</div>
          </div>
        </div>
      </div>

      {/* Links in this bundle — parallel to the slugs card on link detail. */}
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
                <div class="bundle-link-row">
                  <span class={`slug-chip accent-${b.accent}`}>
                    <span class="icon">fiber_manual_record</span>
                    {row.primary_slug}
                  </span>
                  <div class="bundle-link-meta">
                    <a href={`/_/admin/links/${row.link_id}`} class="bundle-link-label">
                      {row.label || <span class="muted">({t("linkDetail.setLabel")})</span>}
                    </a>
                    <div class="bundle-link-url">{row.url}</div>
                  </div>
                  <div class="bundle-link-bar">
                    <div class="bundle-link-bar-fill" style={`width:${pct}%`} />
                  </div>
                  <div class="bundle-link-count">
                    <span class="count">{row.click_count.toLocaleString()}</span>
                    {row.delta_pct !== undefined && <Delta pct={row.delta_pct} />}
                  </div>
                  <div class="bundle-link-actions">
                    <button
                      class="btn-icon"
                      onclick={`event.preventDefault();copyUrl('${escHtml(row.primary_slug)}')`}
                      title={t("linkDetail.copy")}
                    >
                      <span class="icon">content_copy</span>
                    </button>
                    {isOwner && (
                      <button
                        class="btn-icon btn-icon-danger"
                        onclick={`removeLinkFromBundle(${b.id}, ${row.link_id})`}
                        title={t("bundles.removeFromBundle")}
                      >
                        <span class="icon">close</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isOwner && (
          <button
            class="bundle-add-link-btn"
            onclick={`showAddLinkToBundlePicker(${b.id})`}
            type="button"
          >
            <span class="icon">add</span> {t("bundles.addLinkToBundle")}
          </button>
        )}
      </div>

      {/* Analytics grid — mirrors link-detail's layout exactly. */}
      <div class="detail-analytics">
        <div class="detail-analytics-left">
          <div class="bento-card timeline-card">
            <div class="timeline-head">
              <div class="timeline-head-main">
                <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
                <div class="timeline-total-row">
                  <span class="timeline-total">{stats.total_clicks}</span>
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
            <div class="bento-label">{t("linkDetail.countries")}</div>
            <div class="stat-card-body">
              {stats.countries.length > 0 ? (
                stats.countries.map((c) => (
                  <StatBar
                    name={countryName(c.name, lang)}
                    flag={c.name}
                    count={c.count}
                    max={countryTotal || 1}
                    color="orange"
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.referrers")}</div>
            <div class="stat-card-body">
              {stats.referrers.length > 0 ? (
                stats.referrers.map((r) => (
                  <StatBar
                    name={r.name}
                    count={r.count}
                    max={refTotal || 1}
                    color="mint"
                    mono
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
              {stats.link_modes.length > 0 ? (
                stats.link_modes.map((m) => (
                  <StatBar
                    name={m.name}
                    count={m.count}
                    max={modeTotal || 1}
                    color="orange"
                    icon={linkModeIcon(m.name)}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
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
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.os")}</div>
            <div class="stat-card-body">
              {stats.os.length > 0 ? (
                stats.os.map((o) => (
                  <StatBar
                    name={o.name}
                    count={o.count}
                    max={osTotal || 1}
                    color="mint"
                    icon={osIcon(o.name)}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.browsers")}</div>
            <div class="stat-card-body">
              {stats.browsers.length > 0 ? (
                stats.browsers.map((br) => (
                  <StatBar
                    name={br.name}
                    count={br.count}
                    max={brTotal || 1}
                    color="mint"
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
