// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { LinkWithSlugs, ClickStats } from "../types";
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
  mono?: boolean;
  subtitle?: string;
}> = ({ name, count, max, color, icon, mono, subtitle }) => {
  const pct = max > 0 ? ((count / max) * 100).toFixed(0) : "0";
  return (
    <div>
      <div class="stat-row">
        <span
          class="stat-name"
          style={mono ? "font-family:var(--font-family-mono)" : undefined}
        >
          {icon && (
            <span class="icon" style="font-size:16px;vertical-align:text-bottom">
              {icon}
            </span>
          )}{" "}
          {name}
        </span>
        <div class="stat-bar">
          <div class={`stat-fill ${color}`} style={`width:${pct}%`} />
        </div>
        <span class="stat-count">{count}</span>
      </div>
      {subtitle && (
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin:-0.15rem 0 0.5rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-family-mono)">
          {subtitle}
        </div>
      )}
    </div>
  );
};

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
  t: TranslateFn;
  lang: string;
  identity: string;
};

export const LinkDetailPage: FC<Props> = ({ link, analytics, t, lang, identity }) => {
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
          <span class="icon" style="font-size:24px">
            arrow_back
          </span>
        </a>
        <div class="page-title">{t("linkDetail.title")}</div>
        <div class="timeline-range-selector" id="timeline-range" data-link-id={link.id}>
          {(["24h", "7d", "30d", "90d", "1y", "all"] as const).map((r) => (
            <button
              class={`timeline-range-btn${r === "all" ? " active" : ""}`}
              data-range={r}
              onclick={`loadAnalytics(${link.id}, '${r}')`}
            >
              {t(`range.${r}` as const)}
            </button>
          ))}
        </div>
        <div style="position:relative">
          <button
            class="btn btn-ghost btn-sm"
            onclick="toggleDetailMenu()"
            aria-label={t("linkDetail.moreActions")}
          >
            <span class="icon" style="font-size:24px">more_vert</span>
          </button>
          <div class="detail-menu" id="detail-menu" style="display:none">
            <button class="detail-menu-item" onclick={`showAddSlugModal(${link.id})`}>
              <span class="icon">add_link</span> {t("linkDetail.addCustomSlug")}
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

      <div class="detail-hero">
        <div class="detail-hero-grid">
          <div class="detail-hero-main">
            <div class="detail-hero-label" id="label-display" onclick={`beginEditLabel(${link.id})`}>
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
              <div style="display:inline-block;background:var(--color-danger);color:var(--color-danger-foreground);font-size:0.7rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:var(--radius-md);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">
                {t("linkDetail.disabled")}
              </div>
            )}
            <div
              class="detail-short-url"
              style={isExpired ? "opacity:0.4" : undefined}
            >
              {displaySlug}
            </div>
            <div class="detail-dest">{link.url}</div>
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;align-items:center">
              <button
                class="btn btn-secondary btn-sm"
                onclick={`copyUrl('${escHtml(displaySlug)}')`}
              >
                <span class="icon">content_copy</span> {t("linkDetail.copy")}
              </button>
              <button
                class="btn btn-ghost btn-sm"
                onclick={`showQRModal(${link.id}, '${escHtml(displaySlug)}')`}
              >
                <span class="icon">qr_code_2</span> {t("linkDetail.qr")}
              </button>
            </div>
          </div>

          <div class="detail-hero-side">
            <div class="detail-stats">
              <div class="detail-stat-value" id="hero-total-clicks">{analytics.total_clicks}</div>
              <div class="detail-stat-label">{t("linkDetail.totalClicks")}</div>
            </div>
            <div class="detail-info-grid">
              <div class="detail-info-item">
                <label class="form-label">{t("linkDetail.createdBy")}</label>
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
                  {link.created_by && link.created_by !== "anonymous" ? (
                    <span style="font-size:0.85rem;color:var(--color-text);font-family:var(--font-family-mono)">{link.created_by}</span>
                  ) : (
                    <span style="font-size:0.85rem;color:var(--color-text-muted)">&mdash;</span>
                  )}
                  {link.created_via && (
                    <span class="slug-badge-auto">{link.created_via}</span>
                  )}
                </div>
              </div>
              <div class="detail-info-item">
                <label class="form-label">{t("linkDetail.expiresAt")}</label>
                <div class="inline-edit" id="expiry-display" onclick={`beginEditExpiry(${link.id})`}>
                  {link.expires_at ? (
                    <span class="inline-edit-value">
                      {new Date(link.expires_at * 1000).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" })}
                      {", "}
                      {new Date(link.expires_at * 1000).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : (
                    <span class="inline-edit-placeholder">{t("linkDetail.noExpiry")}</span>
                  )}
                  <span class="icon inline-edit-icon">edit</span>
                </div>
                <div class="inline-edit-form" id="expiry-form" style="display:none">
                  <input
                    class="form-input form-input-sm"
                    id="detail-expires"
                    type="datetime-local"
                    value={expVal}
                    style="width:auto"
                  />
                  <button class="inline-edit-btn confirm" onclick={`saveDetailExpiry(${link.id})`}>
                    <span class="icon">check</span>
                  </button>
                  {link.expires_at && (
                    <button
                      class="btn btn-ghost btn-sm"
                      style="font-size:0.75rem"
                      onclick={`clearDetailExpiry(${link.id})`}
                    >
                      {t("linkDetail.clear")}
                    </button>
                  )}
                  <button class="inline-edit-btn cancel" onclick="cancelEditExpiry()">
                    <span class="icon">close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slugs management section */}
      <div class="bento-card" style="margin-bottom:1.4rem">
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
                        <span class="icon" style="font-size:18px">content_copy</span>
                      </button>
                      <button
                        class="btn-icon"
                        onclick={`showQRModal(${link.id}, '${escHtml(s.slug)}')`}
                        title={t("linkDetail.qr")}
                      >
                        <span class="icon" style="font-size:18px">qr_code_2</span>
                      </button>
                    </>
                  )}
                </div>

                <div class="slugs-row-slug">
                  <span style="font-family:var(--font-family-mono);font-size:0.875rem">{s.slug}</span>
                  {isPrimary && (
                    <span class="slug-badge-primary" title={t("linkDetail.primarySlug")}>
                      <span class="icon" style="font-size:12px;vertical-align:-1px">star</span>
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
                      <span class="icon" style="font-size:18px">delete</span>
                    </button>
                  )}
                  {canDisable && (
                    <button
                      class="btn-icon btn-icon-danger"
                      onclick={`confirmDisableSlug(${link.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.disableSlug")}
                    >
                      <span class="icon" style="font-size:18px">block</span>
                    </button>
                  )}
                  {canEnable && (
                    <button
                      class="btn-icon"
                      onclick={`confirmEnableSlug(${link.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.enableSlug")}
                    >
                      <span class="icon" style="font-size:18px">check_circle</span>
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
            <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
            <div class="timeline-chart" id="timeline-chart">
              <div style="color:var(--color-text-muted);font-size:0.875rem;padding:2rem 0;text-align:center">
                {t("linkDetail.noClickData")}
              </div>
            </div>
          </div>

          <div class="bento-card" id="card-countries">
            <div class="bento-label">{t("linkDetail.countries")}</div>
            <div class="stat-card-body">
              {analytics.countries.length > 0 ? (
                analytics.countries.map((c) => (
                  <StatBar
                    name={countryName(c.name, lang)}
                    count={c.count}
                    max={analytics.countries.reduce((s, i) => s + i.count, 0)}
                    color="orange"
                  />
                ))
              ) : (
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
              )}
            </div>
          </div>

          <div class="bento-card" id="card-referrer-hosts">
            <div class="bento-label">{t("linkDetail.referrerHosts")}</div>
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
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
              )}
            </div>
          </div>

          <div class="bento-card" id="card-referrers">
            <div class="bento-label">{t("linkDetail.sources")}</div>
            <div class="stat-card-body">
              {analytics.referrers.length > 0 ? (
                analytics.referrers.map((r) => (
                  <StatBar
                    name={referrerHost(r.name)}
                    count={r.count}
                    max={analytics.referrers.reduce((s, i) => s + i.count, 0)}
                    color="mint"
                    mono
                    subtitle={r.name}
                  />
                ))
              ) : (
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
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
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
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
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
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
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
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
                <div style="color:var(--color-text-muted);font-size:0.875rem">
                  {t("linkDetail.noData")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
