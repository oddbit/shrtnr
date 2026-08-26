// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { LinkWithSlugs, TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";
import { Delta } from "../components/delta";
import { RangePicker } from "../components/range-picker";
import { fmtNumber } from "../i18n/format";
import { LINKS_PER_PAGE_OPTIONS } from "../constants";
import type { LinksEmptyReason } from "../services/link-management";

function formatDate(ts: number, lang: string): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type LinksFilter = "active" | "disabled" | "all";

export type PaginationItem = number | "ellipsis";

export function paginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  // Clamp here rather than at the call site: no caller should have to repeat
  // these guards, and the next one will be an htmx partial that does not.
  totalPages = Math.max(1, totalPages);
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

type Props = {
  /**
   * Rows for the current page only: the query already applied the filter, the
   * sort and the window, so this component never slices a catalog.
   */
  links: LinkWithSlugs[];
  /** Rows matching the filter across the whole catalog. Drives the counts. */
  total: number;
  totalPages: number;
  /** Set only when `links` is empty; picks which empty-state copy to show. */
  emptyReason?: LinksEmptyReason;
  sort: string;
  page: number;
  perPage: number;
  filter: LinksFilter;
  range: TimelineRange;
  searchQuery?: string;
  t: TranslateFn;
  lang: string;
};

export const LinksPage: FC<Props> = ({
  links,
  total,
  totalPages,
  emptyReason,
  sort,
  page,
  perPage,
  filter,
  range,
  searchQuery,
  t,
  lang,
}) => {
  const now = Math.floor(Date.now() / 1000);
  const isLinkDisabled = (l: LinkWithSlugs) =>
    l.expires_at != null && l.expires_at < now;

  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      sort,
      page: String(currentPage),
      per_page: String(perPage),
      filter,
      range,
      search: searchQuery,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
    }
    return `/_/admin/links?${params}`;
  }

  const sortUrl = (s: string) => buildUrl({ sort: s, page: "1" });
  const pageUrl = (p: number) => buildUrl({ page: String(p) });
  const perPageUrl = (n: number) => buildUrl({ per_page: String(n), page: "1" });
  const filterUrl = (f: LinksFilter) => buildUrl({ filter: f, page: "1" });

  const countKey = total !== 1 ? "links.countPlural" : "links.count";

  const filterChips: { key: LinksFilter; labelKey: "links.filterActive" | "links.filterDisabled" | "links.filterAll"; icon: string }[] = [
    { key: "active", labelKey: "links.filterActive", icon: "link" },
    { key: "disabled", labelKey: "links.filterDisabled", icon: "block" },
    { key: "all", labelKey: "links.filterAll", icon: "all_inclusive" },
  ];

  const rangeLabel = range === "all" ? t("range.long.all") : t(`range.${range}` as const);
  const preserveParams: Record<string, string | undefined> = {
    sort,
    filter,
    page: String(currentPage),
    per_page: String(perPage),
  };
  if (searchQuery) preserveParams.search = searchQuery;

  return (
    <>
      <div class="page-header topbar">
        <div>
          <div class="page-title">{t("links.title")}</div>
          <div class="page-subtitle">{t("links.subtitle")}</div>
        </div>
        <div class="topbar-actions">
          <RangePicker current={range} basePath="/_/admin/links" t={t} preserveParams={preserveParams} />
        </div>
      </div>

      <div class="hero-input-wrap">
        <input
          class="hero-input"
          id="quick-url"
          type="text"
          placeholder={t("links.inputPlaceholder")}
          value={searchQuery || ""}
        />
        <button class="btn btn-primary btn-lg" id="quick-action-btn" onclick="quickShorten()">
          <span class="icon" id="quick-action-icon">bolt</span> <span id="quick-action-label">{t("dashboard.shorten")}</span>
        </button>
      </div>

      {searchQuery && (
        <div class="search-results-bar">
          <span class="count">{t("links.searchResults", { count: total })}</span>
          <a href="/_/admin/links" class="btn btn-ghost btn-sm">
            <span class="icon icon-xs">close</span> {t("links.clearSearch")}
          </a>
        </div>
      )}

      <div class="toolbar">
        <div class="toolbar-group">
          <div class="filter-chips" role="group" aria-label={t("links.filter")}>
            {filterChips.map((chip) => (
              <a
                class={`filter-chip${filter === chip.key ? " active" : ""}`}
                href={filterUrl(chip.key)}
              >
                <span class="icon">{chip.icon}</span>
                <span>{t(chip.labelKey)}</span>
              </a>
            ))}
          </div>
          <div class="toolbar-sort">
            <a
              class={`sort-btn${sort === "recent" ? " active" : ""}`}
              href={sortUrl("recent")}
            >
              <span class="icon icon-sm">schedule</span>{" "}
              {t("links.recent")}
            </a>
            <a
              class={`sort-btn${sort === "popular" ? " active" : ""}`}
              href={sortUrl("popular")}
            >
              <span class="icon icon-sm">trending_up</span>{" "}
              {t("links.popular")}
            </a>
          </div>
          <div class="toolbar-count">
            {t(countKey as any, { count: total })}
          </div>
        </div>
      </div>

      {links.length === 0 ? (
        <div class="empty-state">
          <span class="icon">link_off</span>
          <p>
            {emptyReason === "all-filtered"
              ? t("links.allDisabled")
              : t("links.empty")}
          </p>
        </div>
      ) : (
        <>
          <div class="bento-card bento-card-flush">
            <div class="links-table-scroll">
              <table class="links-table">
                <thead>
                  <tr>
                    <th>{t("links.colLink")}</th>
                    <th>{t("links.colShort")}</th>
                    <th class="num">{t("links.colClicksRange", { range: rangeLabel })}</th>
                    <th>{t("links.colCreated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const mainSlug = link.slugs.find((s) => s.is_primary)
                      || link.slugs.find((s) => s.is_custom)
                      || link.slugs[0];
                    const disabled = isLinkDisabled(link);
                    const href = `/_/admin/links/${link.id}`;
                    return (
                      <tr
                        class={disabled ? "disabled" : ""}
                        onclick={`if(event.target.closest('.no-row-nav'))return;location.href='${href}'`}
                      >
                        <td data-label={t("links.colLink")}>
                          <div class="col-link-label">
                            {link.label || link.url}
                            {disabled && (
                              <span class="disabled-badge col-disabled-badge">
                                <span class="icon icon-xs">block</span>{" "}
                                {t("links.disabled")}
                              </span>
                            )}
                          </div>
                          {link.label && (
                            <div class="col-link-url">
                              <span class="icon icon-xs">open_in_new</span>
                              <span>{link.url}</span>
                            </div>
                          )}
                        </td>
                        <td data-label={t("links.colShort")} class="col-short">
                          {mainSlug && (
                            <span
                              class={`col-short-chip no-row-nav${(mainSlug.disabled_at || disabled) ? " slug-chip-disabled" : ""}`}
                              data-copy-slug={mainSlug.slug}
                              title={t("links.clickToCopy")}
                            >
                              <span class="col-short-chip-dot" aria-hidden="true" />
                              <span class="col-short-chip-slug">{mainSlug.slug}</span>
                              <span class="icon">content_copy</span>
                            </span>
                          )}
                        </td>
                        <td data-label={t("links.colClicksRange", { range: rangeLabel })} class="col-clicks">
                          <span class="col-clicks-cell">
                            <span class="col-clicks-value">{fmtNumber(link.total_clicks, lang)}</span>
                          </span>
                        </td>
                        <td data-label={t("links.colCreated")} class="col-date">
                          <span class="col-date-cell">
                            <span>{formatDate(link.created_at, lang)}</span>
                            {typeof link.delta_pct === "number" && link.total_clicks > 0 && (
                              <Delta pct={link.delta_pct} lang={lang} />
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div class="pagination">
            <div class="pagination-summary">
              {t("links.pageSummary", {
                from: total === 0 ? 0 : start + 1,
                to: Math.min(start + perPage, total),
                total,
              })}
            </div>
            {totalPages > 1 && (
              <div class="pagination-pages">
                <a
                  class={`page-btn${currentPage <= 1 ? " disabled" : ""}`}
                  href={currentPage > 1 ? pageUrl(currentPage - 1) : "#"}
                >
                  <span class="icon icon-sm">chevron_left</span>
                </a>
                {paginationItems(currentPage, totalPages).map((item) =>
                  item === "ellipsis" ? (
                    <span class="page-ellipsis" aria-hidden="true">…</span>
                  ) : (
                    <a
                      class={`page-btn${item === currentPage ? " active" : ""}`}
                      href={pageUrl(item)}
                      aria-current={item === currentPage ? "page" : undefined}
                    >
                      {item}
                    </a>
                  ),
                )}
                <a
                  class={`page-btn${currentPage >= totalPages ? " disabled" : ""}`}
                  href={
                    currentPage < totalPages
                      ? pageUrl(currentPage + 1)
                      : "#"
                  }
                >
                  <span class="icon icon-sm">chevron_right</span>
                </a>
              </div>
            )}
            <div class="per-page">
              <span class="per-page-label">{t("links.show")}</span>
              <div class="form-select per-page-select">
                <select
                  class="form-input form-input-sm"
                  onchange="location.href=this.value"
                  aria-label={t("links.perPageAria")}
                >
                  {LINKS_PER_PAGE_OPTIONS.map((n) => (
                    <option value={perPageUrl(n)} selected={perPage === n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <span class="per-page-label">{t("links.perPage")}</span>
            </div>
          </div>
        </>
      )}
    </>
  );
};
