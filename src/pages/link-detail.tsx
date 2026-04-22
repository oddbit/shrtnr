// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { Bundle, LinkWithSlugs, ClickStats, TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";
import { countryName } from "../country";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const StatBar: FC<{
  name: string;
  count: number;
  max: number;
  color: string;
  icon?: string;
  flag?: string;
  mono?: boolean;
  subtitle?: string;
}> = ({ name, count, max, color, icon, flag, mono, subtitle }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div>
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
      {subtitle && <div class="stat-row-subtitle">{subtitle}</div>}
    </div>
  );
};

function avgPerDay(totalClicks: number, createdAt: number, now: number): string {
  const seconds = Math.max(1, now - createdAt);
  const days = Math.max(1, seconds / 86400);
  const avg = totalClicks / days;
  if (avg === 0) return "0";
  if (avg < 1) return avg.toFixed(2);
  if (avg < 10) return avg.toFixed(1);
  return Math.round(avg).toString();
}

function referrerHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function deviceIcon(name: string): string {
  if (name === "mobile") return "phone_android";
  if (name === "tablet") return "tablet";
  return "computer";
}

function linkModeIcon(name: string): string {
  if (name === "qr") return "qr_code_2";
  return "link";
}

function osIcon(name: string): string {
  if (name === "ios") return "phone_iphone";
  if (name === "macos") return "laptop_mac";
  if (name === "android") return "android";
  if (name === "windows") return "desktop_windows";
  if (name === "linux" || name === "chromeos") return "computer";
  return "devices";
}

type Props = {
  link: LinkWithSlugs;
  analytics: ClickStats;
  bundles?: Bundle[];
  t: TranslateFn;
  lang: string;
  identity: string;
  initialRange?: TimelineRange;
};

export const LinkDetailPage: FC<Props> = ({ link, analytics, bundles = [], t, lang, identity, initialRange = "all" }) => {
  const now = Math.floor(Date.now() / 1000);
  const isExpired = !!(link.expires_at && link.expires_at < now);
  const isOwner = identity === link.created_by;

  // Primary slug is the one marked is_primary, falling back to first custom, then random
  const primarySlug = link.slugs.find((s) => s.is_primary)
    || link.slugs.find((s) => s.is_custom)
    || link.slugs[0];
  const displaySlug = primarySlug?.slug || "";
  const randomSlug = link.slugs.find((s) => !s.is_custom);
  const custom = link.slugs.filter((s) => s.is_custom);
  const hasMultipleSlugs = custom.length > 0;

  const expVal = link.expires_at
    ? new Date(link.expires_at * 1000).toISOString().slice(0, 16)
    : "";

  const maxSlugClicks = Math.max(1, link.slugs.reduce((s, slug) => s + slug.click_count, 0));

  return (
    <>
      <div class="detail-header">
        <a href="/_/admin/links" class="detail-back">
          <span class="icon icon-lg">arrow_back</span>
        </a>
        <div class="page-title">{t("linkDetail.title")}</div>
        <div class="timeline-range-selector" id="timeline-range" data-link-id={link.id} data-initial-range={initialRange}>
          {(["24h", "7d", "30d", "90d", "1y", "all"] as const).map((r) => (
            <button
              class={`timeline-range-btn${r === initialRange ? " active" : ""}`}
              data-range={r}
              onclick={`loadAnalytics(${link.id}, '${r}')`}
            >
              {t(`range.${r}` as const)}
            </button>
          ))}
        </div>
        <div class="detail-menu-anchor">
          <button
            class="btn btn-ghost btn-sm"
            onclick="toggleDetailMenu()"
            aria-label={t("linkDetail.moreActions")}
          >
            <span class="icon icon-lg">more_vert</span>
          </button>
          <div class="detail-menu" id="detail-menu" style="display:none">
            <button class="detail-menu-item" onclick={`showAddSlugModal(${link.id})`}>
              <span class="icon">add_link</span> {t("linkDetail.addCustomSlug")}
            </button>
            <button class="detail-menu-item" onclick={`showAddToBundleModal(${link.id})`}>
              <span class="icon">inventory_2</span> {t("linkDetail.addToBundle")}
            </button>
            {hasMultipleSlugs && (
              <button class="detail-menu-item" onclick={`showChangePrimaryModal(${link.id})`}>
                <span class="icon">star</span> {t("linkDetail.changePrimary")}
              </button>
            )}
            <button class="detail-menu-item" onclick={`showDuplicateModal(${link.id}, '${escHtml(link.url)}')`}>
              <span class="icon">content_copy</span> {t("linkDetail.duplicate")}
            </button>
            {isOwner && (
              <>
                <div class="detail-menu-divider" />
                {isExpired ? (
                  <button class="detail-menu-item" onclick={`showEnableLinkModal(${link.id})`}>
                    <span class="icon">check_circle</span> {t("linkDetail.enable")}
                  </button>
                ) : link.total_clicks === 0 ? (
                  <button class="detail-menu-item detail-menu-danger" onclick={`showDeleteLinkModal(${link.id})`}>
                    <span class="icon">delete</span> {t("linkDetail.delete")}
                  </button>
                ) : (
                  <button class="detail-menu-item detail-menu-danger" onclick={`showDisableLinkModal(${link.id})`}>
                    <span class="icon">block</span> {t("linkDetail.disable")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {bundles.length > 0 && (
        <div class="bundle-chips-row">
          {bundles.map((b) => (
            <a
              href={`/_/admin/bundles/${b.id}`}
              class={`bundle-chip accent-${b.accent}`}
              title={b.description || b.name}
            >
              <span class="icon">{b.icon ?? "inventory_2"}</span>
              <span>{b.name}</span>
            </a>
          ))}
        </div>
      )}

      <div class="detail-hero">
        <div class="left">
          <div class="label" id="label-display" onclick={`beginEditLabel(${link.id})`}>
            {link.label ? (
              <span class="inline-edit-value">{link.label}</span>
            ) : (
              <span class="inline-edit-placeholder">{t("linkDetail.setLabel")}</span>
            )}
            <span class="icon inline-edit-icon">edit</span>
          </div>
          <div class="inline-edit-form" id="label-form" style="display:none">
            <input
              class="form-input form-input-sm"
              id="detail-label"
              value={link.label || ""}
              placeholder={t("linkDetail.labelPlaceholder")}
              onkeydown={`if(event.key==='Enter')saveDetailLabel(${link.id});if(event.key==='Escape')cancelEditLabel();`}
            />
            <button class="inline-edit-btn confirm" onclick={`saveDetailLabel(${link.id})`}>
              <span class="icon">check</span>
            </button>
            <button class="inline-edit-btn cancel" onclick="cancelEditLabel()">
              <span class="icon">close</span>
            </button>
          </div>
          {isExpired && (
            <div class="disabled-badge mb-sm">{t("linkDetail.disabled")}</div>
          )}
          <div class="short-url-row">
            <span
              class={`short-url${isExpired ? " dimmed" : ""}`}
              onclick={`copyUrl('${escHtml(displaySlug)}')`}
            >
              <span class="icon">link</span>{displaySlug}
            </span>
            <button
              class="btn-icon"
              onclick={`copyUrl('${escHtml(displaySlug)}')`}
              title={t("linkDetail.copy")}
            >
              <span class="icon">content_copy</span>
            </button>
            <button
              class="btn-icon"
              onclick={`showQRModal(${link.id}, '${escHtml(displaySlug)}')`}
              title={t("linkDetail.qr")}
            >
              <span class="icon">qr_code_2</span>
            </button>
          </div>
          <a class="dest" href={link.url} target="_blank" rel="noopener noreferrer">
            <span class="icon">open_in_new</span>{link.url}
          </a>
          <div class="meta-row">
            {link.created_by && link.created_by !== "anonymous" && (
              <span class="m">
                <span class="icon">person</span>
                {t("linkDetail.createdBy")} <strong>{link.created_by}</strong>
              </span>
            )}
            <span class="m">
              <span class="icon">schedule</span>
              {t("linkDetail.createdOn")}{" "}
              <strong>
                {new Date(link.created_at * 1000).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" })}
              </strong>
            </span>
            <span class="m inline-edit" id="expiry-display" onclick={`beginEditExpiry(${link.id})`}>
              <span class="icon">event_busy</span>
              {link.expires_at ? (
                <strong>
                  {new Date(link.expires_at * 1000).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" })}
                </strong>
              ) : (
                t("linkDetail.neverExpires")
              )}
              <span class="icon inline-edit-icon">edit</span>
            </span>
            <div class="inline-edit-form expiry-form" id="expiry-form" style="display:none">
              <input
                class="form-input form-input-sm"
                id="detail-expires"
                type="datetime-local"
                value={expVal}
              />
              <button class="inline-edit-btn confirm" onclick={`saveDetailExpiry(${link.id})`}>
                <span class="icon">check</span>
              </button>
              {link.expires_at && (
                <button
                  class="btn btn-ghost btn-sm"
                  onclick={`clearDetailExpiry(${link.id})`}
                >
                  {t("linkDetail.clear")}
                </button>
              )}
              <button class="inline-edit-btn cancel" onclick="cancelEditExpiry()">
                <span class="icon">close</span>
              </button>
            </div>
            {link.created_via && (
              <span class="m">
                <span class="icon">api</span>
                {t("linkDetail.via")} <strong>{link.created_via}</strong>
              </span>
            )}
          </div>
        </div>
        <div class="right">
          <div class="hero-metric accent">
            <div class="n" id="hero-total-clicks">{analytics.total_clicks}</div>
            <div class="l">{t("linkDetail.totalClicks")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{avgPerDay(analytics.total_clicks, link.created_at, now)}</div>
            <div class="l">{t("linkDetail.avgPerDay")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{analytics.countries.length}</div>
            <div class="l">{t("linkDetail.countries")}</div>
          </div>
          <div class="hero-metric">
            <div class="n">{analytics.referrer_hosts.length}</div>
            <div class="l">{t("linkDetail.referrers")}</div>
          </div>
        </div>
      </div>

      {/* Slugs management section */}
      <div class="bento-card mb-lg">
        <div class="bento-label">{t("linkDetail.slugs")}</div>
        <div class="slugs-table">
          {[...link.slugs].sort((a, b) => a.is_custom - b.is_custom).map((s) => {
            const slugDisabled = !!s.disabled_at;
            const effectivelyDisabled = slugDisabled || isExpired;
            const isPrimary = s.is_primary === 1;
            const isCustom = s.is_custom === 1;
            const canDelete = isOwner && isCustom && s.click_count === 0 && !slugDisabled;
            const canDisable = isOwner && isCustom && !slugDisabled && s.click_count > 0;
            const canEnable = isOwner && isCustom && slugDisabled;
            const pct = maxSlugClicks > 0 ? ((s.click_count / maxSlugClicks) * 100).toFixed(0) : "0";

            return (
              <div class={`slugs-row${effectivelyDisabled ? " slugs-row-disabled" : ""}${isPrimary ? " slugs-row-primary" : ""}`} data-slug-id={s.slug}>
                <div class="slugs-row-actions-left">
                  {!effectivelyDisabled && (
                    <>
                      <button
                        class="btn-icon"
                        onclick={`copyUrl('${escHtml(s.slug)}')`}
                        title={t("linkDetail.copy")}
                      >
                        <span class="icon icon-md">content_copy</span>
                      </button>
                      <button
                        class="btn-icon"
                        onclick={`showQRModal(${link.id}, '${escHtml(s.slug)}')`}
                        title={t("linkDetail.qr")}
                      >
                        <span class="icon icon-md">qr_code_2</span>
                      </button>
                    </>
                  )}
                </div>

                <div class="slugs-row-slug">
                  <span class="slug-row-text">{s.slug}</span>
                  {isPrimary && (
                    <span class="slug-badge-primary" title={t("linkDetail.primarySlug")}>
                      <span class="icon icon-xxs">star</span>
                    </span>
                  )}
                  {!isCustom && (
                    <span class="slug-badge-auto" title={t("linkDetail.autoGenerated")}>{t("linkDetail.autoGeneratedBadge")}</span>
                  )}
                </div>

                <div class="slugs-row-bar-container">
                  <div class="slugs-row-bar">
                    <div
                      class="slugs-row-fill orange"
                      data-slug-fill={s.slug}
                      style={`width:${pct}%`}
                    />
                  </div>
                </div>

                <div class="slugs-row-count" data-slug-count={s.slug}>{s.click_count}</div>

                <div class="slugs-row-actions-right">
                  {canDelete && (
                    <button
                      class="btn-icon btn-icon-danger"
                      onclick={`confirmDeleteSlug(${link.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.deleteSlug")}
                    >
                      <span class="icon icon-md">delete</span>
                    </button>
                  )}
                  {canDisable && (
                    <button
                      class="btn-icon btn-icon-danger"
                      onclick={`confirmDisableSlug(${link.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.disableSlug")}
                    >
                      <span class="icon icon-md">block</span>
                    </button>
                  )}
                  {canEnable && (
                    <button
                      class="btn-icon"
                      onclick={`confirmEnableSlug(${link.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.enableSlug")}
                    >
                      <span class="icon icon-md">check_circle</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div class="detail-analytics">
        <div class="detail-analytics-left">
          <div class="bento-card timeline-card">
            <div class="timeline-head">
              <div class="timeline-head-main">
                <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
                <div class="timeline-total-row">
                  <span class="timeline-total" id="timeline-total">{analytics.total_clicks}</span>
                  <span class="timeline-total-label">{t("linkDetail.clicksInRange")}</span>
                </div>
              </div>
            </div>
            <div class="timeline-chart" id="timeline-chart">
              <div class="empty-card-hint">{t("linkDetail.noClickData")}</div>
            </div>
          </div>

          <div class="bento-card" id="card-countries">
            <div class="bento-label">{t("linkDetail.countries")}</div>
            <div class="stat-card-body">
              {analytics.countries.length > 0 ? (
                analytics.countries.map((c) => (
                  <StatBar
                    name={countryName(c.name, lang)}
                    flag={c.name}
                    count={c.count}
                    max={analytics.countries.reduce((s, i) => s + i.count, 0)}
                    color="orange"
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card" id="card-referrers">
            <div class="bento-label">{t("linkDetail.referrers")}</div>
            <div class="stat-card-body">
              {analytics.referrer_hosts.length > 0 ? (
                analytics.referrer_hosts.map((r) => (
                  <StatBar
                    name={r.name}
                    count={r.count}
                    max={analytics.referrer_hosts.reduce((s, i) => s + i.count, 0)}
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
          <div class="bento-card" id="card-link-modes">
            <div class="bento-label">{t("linkDetail.linkModes")}</div>
            <div class="stat-card-body">
              {analytics.link_modes.length > 0 ? (
                analytics.link_modes.map((m) => (
                  <StatBar
                    name={m.name}
                    count={m.count}
                    max={analytics.link_modes.reduce((s, i) => s + i.count, 0)}
                    color="orange"
                    icon={linkModeIcon(m.name)}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card" id="card-devices">
            <div class="bento-label">{t("linkDetail.devices")}</div>
            <div class="stat-card-body">
              {analytics.devices.length > 0 ? (
                analytics.devices.map((d) => (
                  <StatBar
                    name={d.name}
                    count={d.count}
                    max={analytics.devices.reduce((s, i) => s + i.count, 0)}
                    color="orange"
                    icon={deviceIcon(d.name)}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card" id="card-os">
            <div class="bento-label">{t("linkDetail.os")}</div>
            <div class="stat-card-body">
              {analytics.os.length > 0 ? (
                analytics.os.map((o) => (
                  <StatBar
                    name={o.name}
                    count={o.count}
                    max={analytics.os.reduce((s, i) => s + i.count, 0)}
                    color="mint"
                    icon={osIcon(o.name)}
                  />
                ))
              ) : (
                <div class="muted-hint">{t("linkDetail.noData")}</div>
              )}
            </div>
          </div>

          <div class="bento-card" id="card-browsers">
            <div class="bento-label">{t("linkDetail.browsers")}</div>
            <div class="stat-card-body">
              {analytics.browsers.length > 0 ? (
                analytics.browsers.map((b) => (
                  <StatBar
                    name={b.name}
                    count={b.count}
                    max={analytics.browsers.reduce((s, i) => s + i.count, 0)}
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
