// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { LinkWithSlugs } from "../types";
import type { TranslateFn } from "../i18n";
import { Delta } from "../components/delta";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts: number, lang: string): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type LinksFilter = "active" | "disabled" | "all";

type Props = {
  links: LinkWithSlugs[];
  sort: string;
  page: number;
  perPage: number;
  filter: LinksFilter;
  searchQuery?: string;
  t: TranslateFn;
  lang: string;
};

export const LinksPage: FC<Props> = ({
  links,
  sort,
  page,
  perPage,
  filter,
  searchQuery,
  t,
  lang,
}) => {
  const now = Math.floor(Date.now() / 1000);
  const isLinkDisabled = (l: LinkWithSlugs) =>
    !!(l.expires_at && l.expires_at < now);

  const activeLinks = links.filter((l) => !isLinkDisabled(l));
  const disabledLinks = links.filter((l) => isLinkDisabled(l));
  const filtered =
    filter === "disabled"
      ? disabledLinks
      : filter === "all"
        ? links
        : activeLinks;

  const sorted = [...filtered].sort((a, b) =>
    sort === "popular"
      ? b.total_clicks - a.total_clicks
      : b.created_at - a.created_at,
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageLinks = sorted.slice(start, start + perPage);

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      sort,
      page: String(currentPage),
      per_page: String(perPage),
      filter,
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

  const countKey = filtered.length !== 1 ? "links.countPlural" : "links.count";

  const filterChips: { key: LinksFilter; labelKey: "links.filterActive" | "links.filterDisabled" | "links.filterAll"; icon: string; count: number }[] = [
    { key: "active", labelKey: "links.filterActive", icon: "link", count: activeLinks.length },
    { key: "disabled", labelKey: "links.filterDisabled", icon: "block", count: disabledLinks.length },
    { key: "all", labelKey: "links.filterAll", icon: "all_inclusive", count: links.length },
  ];

  return (
    <>
      <div class="page-header">
        <div class="page-title">{t("links.title")}</div>
        <div class="page-subtitle">{t("links.subtitle")}</div>
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
          <span class="count">{t("links.searchResults", { count: filtered.length })}</span>
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
                <span class="count">{chip.count}</span>
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
            {t(countKey as any, { count: filtered.length })}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div class="empty-state">
          <span class="icon">link_off</span>
          <p>
            {links.length > 0
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
                    <th class="num">{t("links.colClicks")}</th>
                    <th>{t("links.colCreated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLinks.map((link) => {
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
                          {link.label && <div class="col-link-url">{link.url}</div>}
                        </td>
                        <td data-label={t("links.colShort")} class="col-short">
                          {mainSlug && (
                            <span
                              class={`col-short-chip no-row-nav${(mainSlug.disabled_at || disabled) ? " slug-chip-disabled" : ""}`}
                              onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(mainSlug.slug)}')`}
                              title={t("links.clickToCopy")}
                            >
                              {mainSlug.slug} <span class="icon">content_copy</span>
                            </span>
                          )}
                        </td>
                        <td data-label={t("links.colClicks")} class="col-clicks">
                          <span class="col-clicks-cell">
                            <span>{link.total_clicks}</span>
                            {typeof link.delta_pct === "number" && link.total_clicks > 0 && (
                              <Delta pct={link.delta_pct} />
                            )}
                          </span>
                        </td>
                        <td data-label={t("links.colCreated")} class="col-date">
                          {formatDate(link.created_at, lang)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {(totalPages > 1 || links.length > 25) && (
            <div class="pagination">
              <div class="pagination-pages">
                <a
                  class={`page-btn${currentPage <= 1 ? " disabled" : ""}`}
                  href={currentPage > 1 ? pageUrl(currentPage - 1) : "#"}
                >
                  <span class="icon icon-sm">chevron_left</span>
                </a>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <a
                      class={`page-btn${p === currentPage ? " active" : ""}`}
                      href={pageUrl(p)}
                    >
                      {p}
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
              <div class="per-page">
                {t("links.show")}{" "}
                {[25, 50, 100].map((n) => (
                  <a
                    class={`per-page-btn${perPage === n ? " active" : ""}`}
                    href={perPageUrl(n)}
                  >
                    {n}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
