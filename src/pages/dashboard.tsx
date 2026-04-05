// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { DashboardStats, LinkWithSlugs } from "../types";
import type { TranslateFn } from "../i18n";
import { countryName } from "../country";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const StatCard: FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div class="bento-card">
    <div class="bento-label">{label}</div>
    <div class="bento-value">{value}</div>
  </div>
);

const StatBar: FC<{
  name: string;
  count: number;
  max: number;
  color: string;
}> = ({ name, count, max, color }) => {
  const pct = max > 0 ? ((count / max) * 100).toFixed(0) : "0";
  return (
    <div class="stat-row">
      <span class="stat-name">{name}</span>
      <div class="stat-bar">
        <div class={`stat-fill ${color}`} style={`width:${pct}%`} />
      </div>
      <span class="stat-count">{count}</span>
    </div>
  );
};

function primarySlug(link: LinkWithSlugs): string {
  const p = link.slugs.find((s) => !s.is_vanity);
  return p ? p.slug : link.slugs[0]?.slug || "";
}

type Props = {
  stats: DashboardStats;
  t: TranslateFn;
  lang: string;
};

export const DashboardPage: FC<Props> = ({ stats, t, lang }) => {
  const d = stats;
  const topCountryMax = d.top_countries[0]?.count || 1;
  const topRefMax = d.top_referrers[0]?.count || 1;
  const topLinkMax = d.top_links[0]?.total_clicks || 1;

  return (
    <>
      <div class="page-header">
        <div class="page-title">{t("dashboard.title")}</div>
        <div class="page-subtitle">{t("dashboard.subtitle")}</div>
      </div>

      <div class="hero-input-wrap">
        <input
          class="hero-input"
          id="quick-url"
          type="url"
          placeholder={t("dashboard.urlPlaceholder")}
        />
        <button class="btn btn-primary btn-lg" onclick="quickShorten()">
          <span class="icon">bolt</span> {t("dashboard.shorten")}
        </button>
      </div>

      <div class="bento">
        <StatCard label={t("dashboard.totalLinks")} value={d.total_links} />
        <StatCard label={t("dashboard.totalClicks")} value={d.total_clicks} />

        <div class="bento-card">
          <div class="bento-label">{t("dashboard.topCountries")}</div>
          <div class="bento-value small">
            {d.top_countries.length === 0 && (
              <span style="color:var(--color-text-muted)">{t("dashboard.noData")}</span>
            )}
          </div>
          {d.top_countries.map((c) => (
            <StatBar
              name={countryName(c.name, lang)}
              count={c.count}
              max={topCountryMax}
              color="orange"
            />
          ))}
        </div>

        <div class="bento-card span-2">
          <div class="bento-label">{t("dashboard.recentLinks")}</div>
          {d.recent_links.length === 0 ? (
            <div style="color:var(--color-text-muted);font-size:0.875rem">
              {t("dashboard.noLinks")}
            </div>
          ) : (
            d.recent_links.map((link) => {
              const slug = primarySlug(link);
              return (
                <a
                  href={`/_/admin/links/${link.id}`}
                  style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;cursor:pointer;overflow:hidden;min-width:0;text-decoration:none;color:inherit"
                >
                  <span
                    class="slug-chip"
                    onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(slug)}')`}
                    title={t("dashboard.clickToCopy")}
                  >
                    /{slug}{" "}
                    <span class="icon" style="font-size:14px">
                      content_copy
                    </span>
                  </span>
                  <span style="flex:1;min-width:0;font-size:0.8rem;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {link.url}
                  </span>
                  <span style="font-family:var(--font-family-display);font-weight:700;color:var(--color-accent);flex-shrink:0">
                    {link.total_clicks}
                  </span>
                </a>
              );
            })
          )}
        </div>

        <div class="bento-card">
          <div class="bento-label">{t("dashboard.topSources")}</div>
          {d.top_referrers.length === 0 ? (
            <div style="color:var(--color-text-muted);font-size:0.875rem">
              {t("dashboard.noData")}
            </div>
          ) : (
            d.top_referrers.map((r) => (
              <StatBar
                name={r.name}
                count={r.count}
                max={topRefMax}
                color="mint"
              />
            ))
          )}
        </div>

        <div class="bento-card span-3">
          <div class="bento-label">{t("dashboard.mostClicked")}</div>
          {d.top_links.length === 0 ? (
            <div style="color:var(--color-text-muted);font-size:0.875rem">
              {t("dashboard.noData")}
            </div>
          ) : (
            d.top_links.map((link) => {
              const slug = primarySlug(link);
              return (
                <a
                  href={`/_/admin/links/${link.id}`}
                  style="cursor:pointer;overflow:hidden;text-decoration:none;color:inherit;display:block"
                >
                  <div class="stat-row">
                    <span
                      class="stat-name"
                      style="font-family:var(--font-family-mono)"
                    >
                      /{slug}
                    </span>
                    <div class="stat-bar">
                      <div
                        class="stat-fill orange"
                        style={`width:${((link.total_clicks / topLinkMax) * 100).toFixed(0)}%`}
                      />
                    </div>
                    <span class="stat-count">{link.total_clicks}</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--color-text-muted);margin:-0.15rem 0 0.5rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    {link.url}
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
