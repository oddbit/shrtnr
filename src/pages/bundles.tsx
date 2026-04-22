// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { BundleWithSummary } from "../types";
import type { TranslateFn } from "../i18n";
import { Sparkline } from "../components/sparkline";
import { Delta } from "../components/delta";
import { fmtNumber } from "../i18n/format";

type Props = {
  bundles: BundleWithSummary[];
  t: TranslateFn;
  lang: string;
  filter: "active" | "archived" | "all";
};

export const BundlesPage: FC<Props> = ({ bundles, t, lang, filter }) => {
  const filterLinks = [
    { id: "active", label: t("bundles.filterActive") },
    { id: "archived", label: t("bundles.filterArchived") },
    { id: "all", label: t("bundles.filterAll") },
  ] as const;

  return (
    <>
      <div class="page-header topbar">
        <div>
          <div class="page-title">{t("bundles.title")}</div>
          <div class="page-subtitle">{t("bundles.subtitle")}</div>
        </div>
      </div>

      <div class="bundle-filter-row">
        {filterLinks.map((f) => {
          const params = new URLSearchParams();
          if (f.id !== "active") params.set("filter", f.id);
          const href = `/_/admin/bundles${params.toString() ? "?" + params.toString() : ""}`;
          const active = filter === f.id;
          return (
            <a class={`bundle-filter-chip${active ? " active" : ""}`} href={href}>
              {f.label}
            </a>
          );
        })}
      </div>

      {bundles.length === 0 ? (
        <div class="bento-card bundle-empty">
          <span class="icon icon-lg">inventory_2</span>
          <div class="bundle-empty-title">{t("bundles.emptyTitle")}</div>
          <div class="bundle-empty-body">{t("bundles.emptyBody")}</div>
          <button class="btn btn-primary" onclick="showCreateBundleModal()">
            <span class="icon">add</span> {t("bundles.newBundle")}
          </button>
        </div>
      ) : (
        <div class="bundle-grid">
          {bundles.map((b) => (
            <a href={`/_/admin/bundles/${b.id}`} class={`bundle-card accent-${b.accent}`}>
              <div class="bundle-card-head">
                <span class="bundle-icon-badge">
                  <span class="icon">{b.icon ?? "inventory_2"}</span>
                </span>
                <div class="bundle-card-title">{b.name}</div>
                {b.archived_at && <span class="bundle-archived-badge">{t("bundles.archived")}</span>}
                {b.delta_pct !== undefined && (
                  <span class="bundle-card-delta">
                    <Delta pct={b.delta_pct} />
                  </span>
                )}
              </div>
              {b.description && <div class="bundle-card-desc">{b.description}</div>}
              <div class="bundle-card-stats">
                <div class="bundle-card-stat">
                  <div class="bundle-card-stat-value">{fmtNumber(b.total_clicks, lang)}</div>
                  <div class="bundle-card-stat-label">{t("bundles.totalClicks")}</div>
                </div>
                <div class="bundle-card-stat">
                  <div class="bundle-card-stat-value">{b.link_count}</div>
                  <div class="bundle-card-stat-label">{t("bundles.links")}</div>
                </div>
              </div>
              {b.sparkline.length > 0 && (
                <div class="bundle-card-spark">
                  <Sparkline values={b.sparkline} />
                </div>
              )}
            </a>
          ))}
          <button class="bundle-card bundle-card-new" onclick="showCreateBundleModal()" type="button">
            <span class="icon icon-lg">add</span>
            <div class="bundle-card-new-title">{t("bundles.newBundle")}</div>
            <div class="bundle-card-new-body">{t("bundles.emptyBody")}</div>
          </button>
        </div>
      )}
    </>
  );
};
