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
        style={mono ? "font-family:var(--font-mono)" : undefined}
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
  const primary = link.slugs.find((s) => !s.is_vanity);
  const slug = primary ? primary.slug : link.slugs[0]?.slug || "";
  const vanitySlug = link.slugs.find((s) => s.is_vanity);
  const displaySlug = vanitySlug ? vanitySlug.slug : slug;
  const vanity = link.slugs.filter((s) => s.is_vanity);
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
        <div style="margin-left:auto">
          {isExpired ? (
            <button
              class="btn btn-secondary btn-sm"
              onclick={`enableLink(${link.id})`}
            >
              <span class="icon">check_circle</span> {t("linkDetail.enable")}
            </button>
          ) : (
            <button
              class="btn btn-danger btn-sm"
              onclick={`disableLink(${link.id})`}
            >
              <span class="icon">block</span> {t("linkDetail.disable")}
            </button>
          )}
        </div>
      </div>

      <div class="detail-hero">
        {isExpired && (
          <div style="display:inline-block;background:var(--danger);color:var(--on-danger);font-size:0.7rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:var(--radius);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">
            {t("linkDetail.disabled")}
          </div>
        )}
        <div
          class="detail-short-url"
          style={isExpired ? "opacity:0.4" : undefined}
        >
          {`${displaySlug}`}
        </div>
        <div class="detail-dest">{link.url}</div>
        {link.label && (
          <div style="color:var(--secondary);font-size:0.85rem;margin-top:0.25rem">
            {link.label}
          </div>
        )}
        <div style="margin-top:0.75rem;display:flex;gap:0.5rem;align-items:center">
          <button
            class="btn btn-secondary btn-sm"
            onclick={`copyUrl('${escHtml(displaySlug)}')`}
          >
            <span class="icon">content_copy</span> {t("linkDetail.copy")}
          </button>
          <button
            class="btn btn-ghost btn-sm"
            onclick={`showQRModal('${escHtml(displaySlug)}')`}
          >
            <span class="icon">qr_code_2</span> {t("linkDetail.qr")}
          </button>
          {vanitySlug && (
            <>
              <span style="color:var(--on-bg-muted);font-size:0.75rem;margin-left:0.5rem">
                {t("linkDetail.or")}
              </span>
              <button
                class="btn btn-ghost btn-sm"
                style="font-size:0.75rem;opacity:0.7"
                onclick={`copyUrl('${escHtml(slug)}')`}
              >
                <span class="icon" style="font-size:14px">
                  content_copy
                </span>{" "}
                /{slug}
              </button>
            </>
          )}
        </div>
        <div style="margin-top:1rem;display:flex;gap:1.4rem;flex-wrap:wrap;align-items:flex-end;border-top:1px solid var(--border);padding-top:1rem">
          <div>
            <label class="form-label">{t("linkDetail.vanitySlug")}</label>
            {vanity.length > 0 ? (
              <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
                {vanity.map((v) => (
                  <span class="slug-chip vanity" style="cursor:default">
                    /{v.slug}
                  </span>
                ))}
              </div>
            ) : (
              <div style="display:flex;gap:0.5rem">
                <input
                  class="form-input"
                  id="detail-vanity"
                  placeholder="my-custom-slug"
                />
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={`addVanityFromDetail(${link.id})`}
                >
                  {t("linkDetail.add")}
                </button>
              </div>
            )}
          </div>
          <div style="margin-left:auto">
            <label class="form-label">{t("linkDetail.expiresAt")}</label>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <input
                class="form-input"
                id="detail-expires"
                type="datetime-local"
                value={expVal}
                style="width:auto"
                oninput="document.getElementById('expiry-save-btn').disabled = !this.value"
              />
              <button
                class="btn btn-ghost btn-sm"
                onclick={`clearDetailExpiry(${link.id})`}
                disabled={!link.expires_at}
              >
                {t("linkDetail.clear")}
              </button>
              <button
                class="btn btn-secondary btn-sm"
                id="expiry-save-btn"
                onclick={`saveDetailExpiry(${link.id})`}
                disabled={!expVal}
              >
                {t("linkDetail.save")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-grid">
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
            <div style="color:var(--on-bg-muted);font-size:0.875rem;padding:2rem 0;text-align:center">
              {t("linkDetail.noClickData")}
            </div>
          )}
        </div>

        <div class="bento-card">
          <div class="bento-label">{t("linkDetail.performance")}</div>
          <div style="text-align:center;padding:1rem 0">
            <div style="font-family:var(--font-display);font-size:3rem;font-weight:700;color:var(--primary)">
              {analytics.total_clicks}
            </div>
            <div style="color:var(--on-bg-muted);font-size:0.8rem">
              {t("linkDetail.totalClicks")}
            </div>
          </div>
          {link.slugs.map((s) => (
            <StatBar
              name={`/${s.slug}`}
              count={s.click_count}
              max={maxSlugClicks}
              color={s.is_vanity ? "mint" : "orange"}
              mono
            />
          ))}
        </div>

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
            <div style="color:var(--on-bg-muted);font-size:0.875rem">
              {t("linkDetail.noData")}
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
            <div style="color:var(--on-bg-muted);font-size:0.875rem">
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
            <div style="color:var(--on-bg-muted);font-size:0.875rem">
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
            <div style="color:var(--on-bg-muted);font-size:0.875rem">
              {t("linkDetail.noData")}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
