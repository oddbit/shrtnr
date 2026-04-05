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
}> = ({ name, count, max, color, icon, mono }) => {
  const pct = max > 0 ? ((count / max) * 100).toFixed(0) : "0";
  return (
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
  );
};

function deviceIcon(name: string): string {
  if (name === "mobile") return "phone_android";
  if (name === "tablet") return "tablet";
  return "computer";
}

type Props = {
  link: LinkWithSlugs;
  analytics: ClickStats;
  t: TranslateFn;
  lang: string;
};

export const LinkDetailPage: FC<Props> = ({ link, analytics, t, lang }) => {
  const now = Math.floor(Date.now() / 1000);
  const isExpired = !!(link.expires_at && link.expires_at < now);

  // Primary slug is the one marked is_primary, falling back to first vanity, then random
  const primarySlug = link.slugs.find((s) => s.is_primary)
    || link.slugs.find((s) => s.is_vanity)
    || link.slugs[0];
  const displaySlug = primarySlug?.slug || "";
  const randomSlug = link.slugs.find((s) => !s.is_vanity);
  const vanity = link.slugs.filter((s) => s.is_vanity);
  const hasMultipleSlugs = vanity.length > 0;

  const expVal = link.expires_at
    ? new Date(link.expires_at * 1000).toISOString().slice(0, 16)
    : "";

  const maxSlugClicks = Math.max(1, ...link.slugs.map((s) => s.click_count));

  return (
    <>
      <div class="detail-header">
        <a href="/_/admin/links" class="detail-back">
          <span class="icon" style="font-size:24px">
            arrow_back
          </span>
        </a>
        <div class="page-title">{t("linkDetail.title")}</div>
        <div style="margin-left:auto;position:relative">
          <button
            class="btn btn-ghost btn-sm"
            onclick="toggleDetailMenu()"
            aria-label="More actions"
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
            <div class="detail-menu-divider" />
            {isExpired ? (
              <button class="detail-menu-item" onclick={`showEnableLinkModal(${link.id})`}>
                <span class="icon">check_circle</span> {t("linkDetail.enable")}
              </button>
            ) : (
              <button class="detail-menu-item detail-menu-danger" onclick={`showDisableLinkModal(${link.id})`}>
                <span class="icon">block</span> {t("linkDetail.disable")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div class="detail-hero detail-hero-grid">
        <div class="detail-hero-main">
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
            <div class="detail-stat-value">{analytics.total_clicks}</div>
            <div class="detail-stat-label">{t("linkDetail.totalClicks")}</div>
          </div>
          <div class="detail-info-grid">
            <div class="detail-info-item full-width">
              <label class="form-label">{t("linkDetail.label")}</label>
              <div class="inline-edit" id="label-display" onclick={`beginEditLabel(${link.id})`}>
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
            </div>
            <div class="detail-info-item">
              <label class="form-label">{t("linkDetail.createdBy")}</label>
              {link.created_via ? (
                <div style="font-size:0.9rem;color:var(--color-text)">{link.created_via}</div>
              ) : (
                <div style="font-size:0.85rem;color:var(--color-text-muted)">&mdash;</div>
              )}
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

      {/* Slugs management section */}
      <div class="bento-card" style="margin-bottom:1.4rem">
        <div class="bento-label">{t("linkDetail.slugs")}</div>
        <div class="slugs-table">
          {[...link.slugs].sort((a, b) => a.is_vanity - b.is_vanity).map((s) => {
            const isDisabled = !!s.disabled_at;
            const isPrimary = s.is_primary === 1;
            const isVanity = s.is_vanity === 1;
            const canDelete = isVanity && s.click_count === 0 && !isDisabled;
            const canDisable = isVanity && !isDisabled && s.click_count > 0;
            const canEnable = isVanity && isDisabled;
            const pct = maxSlugClicks > 0 ? ((s.click_count / maxSlugClicks) * 100).toFixed(0) : "0";

            return (
              <div class={`slugs-row${isDisabled ? " slugs-row-disabled" : ""}${isPrimary ? " slugs-row-primary" : ""}`}>
                <div class="slugs-row-actions-left">
                  {!isDisabled && (
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
                  <span style="font-family:var(--font-family-mono);font-size:0.875rem">/{s.slug}</span>
                  {isPrimary && (
                    <span class="slug-badge-primary" title={t("linkDetail.primarySlug")}>
                      <span class="icon" style="font-size:12px;vertical-align:-1px">star</span>
                    </span>
                  )}
                  {!isVanity && (
                    <span class="slug-badge-auto" title={t("linkDetail.autoGenerated")}>auto</span>
                  )}
                </div>

                <div class="slugs-row-bar-container">
                  <div class="slugs-row-bar">
                    <div
                      class="slugs-row-fill orange"
                      style={`width:${pct}%`}
                    />
                  </div>
                </div>

                <div class="slugs-row-count">{s.click_count}</div>

                <div class="slugs-row-actions-right">
                  {canDelete && (
                    <button
                      class="btn-icon btn-icon-danger"
                      onclick={`confirmDeleteSlug(${link.id}, ${s.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.deleteSlug")}
                    >
                      <span class="icon" style="font-size:18px">delete</span>
                    </button>
                  )}
                  {canDisable && (
                    <button
                      class="btn-icon btn-icon-danger"
                      onclick={`confirmDisableSlug(${link.id}, ${s.id}, '${escHtml(s.slug)}')`}
                      title={t("linkDetail.disableSlug")}
                    >
                      <span class="icon" style="font-size:18px">block</span>
                    </button>
                  )}
                  {canEnable && (
                    <button
                      class="btn-icon"
                      onclick={`confirmEnableSlug(${link.id}, ${s.id}, '${escHtml(s.slug)}')`}
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
          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.clicksOverTime")}</div>
            {analytics.clicks_over_time.length > 0 ? (
              <>
                <div class="chart-container">
                  {analytics.clicks_over_time.map((d) => {
                    const maxVal = Math.max(
                      1,
                      ...analytics.clicks_over_time.map((x) => x.count),
                    );
                    const pct = ((d.count / maxVal) * 100).toFixed(0);
                    return (
                      <div
                        class="chart-bar"
                        style={`height:${Math.max(2, Number(pct))}%`}
                        data-label={`${d.date}: ${d.count}`}
                      />
                    );
                  })}
                </div>
                <div class="chart-dates">
                  <span>{analytics.clicks_over_time[0].date}</span>
                  <span>
                    {
                      analytics.clicks_over_time[
                        analytics.clicks_over_time.length - 1
                      ].date
                    }
                  </span>
                </div>
              </>
            ) : (
              <div style="color:var(--color-text-muted);font-size:0.875rem;padding:2rem 0;text-align:center">
                {t("linkDetail.noClickData")}
              </div>
            )}
          </div>

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.sources")}</div>
            {analytics.referrers.length > 0 ? (
              analytics.referrers.map((r) => (
                <StatBar
                  name={r.name}
                  count={r.count}
                  max={analytics.referrers[0].count}
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

        <div class="detail-analytics-right">
          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.countries")}</div>
            {analytics.countries.length > 0 ? (
              analytics.countries.map((c) => (
                <StatBar
                  name={countryName(c.name, lang)}
                  count={c.count}
                  max={analytics.countries[0].count}
                  color="orange"
                />
              ))
            ) : (
              <div style="color:var(--color-text-muted);font-size:0.875rem">
                {t("linkDetail.noData")}
              </div>
            )}
          </div>

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.devices")}</div>
            {analytics.devices.length > 0 ? (
              analytics.devices.map((d) => (
                <StatBar
                  name={d.name}
                  count={d.count}
                  max={analytics.devices[0].count}
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

          <div class="bento-card">
            <div class="bento-label">{t("linkDetail.browsers")}</div>
            {analytics.browsers.length > 0 ? (
              analytics.browsers.map((b) => (
                <StatBar
                  name={b.name}
                  count={b.count}
                  max={analytics.browsers[0].count}
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
    </>
  );
};
