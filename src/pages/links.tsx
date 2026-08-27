// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { LinkWithSlugs, TimelineRange } from "../types";
import type { TranslateFn, TranslationKey } from "../i18n";
import { Delta } from "../components/delta";
import { RangePicker } from "../components/range-picker";
import { fmtNumber } from "../i18n/format";
import { LINKS_PER_PAGE_OPTIONS } from "../constants";
import { pickPrimarySlug } from "../slugs";
import type { LinksEmptyReason } from "../services";

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

/**
 * One end of the paginator: a chevron that steps to the previous or next page.
 * The glyph is icon-font text, so `aria-hidden` keeps it out of the
 * accessibility tree and the control carries a translated name instead. At the
 * first or last page the step has nowhere to go, so it drops its href: no href
 * means no tab stop and no dead jump to "#", and aria-disabled announces why
 * it is dimmed.
 *
 * `direction` picks both the glyph and nothing else, so a chevron can never
 * point one way while its accessible name says the other.
 */
const PAGE_STEP_ICON = { prev: "chevron_left", next: "chevron_right" } as const;

const PageStep: FC<{
  direction: keyof typeof PAGE_STEP_ICON;
  label: string;
  href?: string;
}> = ({ direction, label, href }) => {
  const glyph = (
    <span class="icon icon-sm" aria-hidden="true">
      {PAGE_STEP_ICON[direction]}
    </span>
  );
  return href ? (
    <a class="page-btn" href={href} aria-label={label}>
      {glyph}
    </a>
  ) : (
    <span
      class="page-btn disabled"
      role="link"
      aria-disabled="true"
      aria-label={label}
    >
      {glyph}
    </span>
  );
};

/**
 * The page actually rendered and where its rows start, with every input
 * floored the way `paginationItems` floors its own. Clamp here rather than at
 * the call site: a caller computing `Math.ceil(0 / perPage)` hands over
 * `totalPages: 0`, which drives `currentPage` to 0 and the row range to
 * `-perPage`. The upper bound on `perPage` stays with the service, which owns
 * `LINKS_MAX_PER_PAGE`.
 */
export function pageWindow(
  page: number,
  perPage: number,
  totalPages: number,
): { currentPage: number; pageCount: number; perPage: number; start: number } {
  const rows = Math.max(1, Math.floor(perPage) || 1);
  const pageCount = Math.max(1, Math.floor(totalPages) || 1);
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { currentPage, pageCount, perPage: rows, start: (currentPage - 1) * rows };
}

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

/**
 * The chip label per status. A Record rather than a lookup over the chip list:
 * every LinksFilter has an entry by construction, so naming one needs no
 * not-found arm that can never run.
 */
const FILTER_LABEL: Record<LinksFilter, TranslationKey> = {
  active: "links.filterActive",
  disabled: "links.filterDisabled",
  all: "links.filterAll",
};

/**
 * The status chips, in the order they render. They read their labels from the
 * table above, so the chip a user clicks and the filter the empty state names
 * can never drift apart.
 */
const FILTER_CHIPS = [
  { key: "active", icon: "link" },
  { key: "disabled", icon: "block" },
  { key: "all", icon: "all_inclusive" },
] as const satisfies readonly { key: LinksFilter; icon: string }[];

/** Longest query the empty state repeats back before it gets clipped. */
const EMPTY_STATE_QUERY_MAX = 60;

/**
 * Copy for an empty result set.
 *
 * The service says why the served window came back with nothing. The page adds
 * the two things only it holds: the query to name, and the chip that may be
 * narrowing alongside it. Under `all` nothing but the search is hiding rows, so
 * there is no filter worth naming; under `active` or `disabled` both are, and
 * blaming either one alone is half the truth.
 *
 * The query is user input dropped into a centred one-paragraph block. Escaping
 * keeps it safe, and clipping keeps a pasted essay from pushing the toolbar and
 * the paginator off screen.
 */
export function emptyStateCopy(
  t: TranslateFn,
  emptyReason: LinksEmptyReason | undefined,
  searchQuery: string,
  filter: LinksFilter,
): string {
  switch (emptyReason) {
    case "all-disabled":
      return t("links.allDisabled");
    case "no-matches":
      return t("links.noMatches");
    case "no-search-matches": {
      const query = searchQuery.trim();
      // The service only raises this reason for a query that survives a trim,
      // so an empty one is unreachable. Naming it back to the user would read
      // as `No links match ""`, so fall back rather than print that.
      if (!query) return t("links.noMatches");
      // Count and cut code points, not UTF-16 units: slicing a string mid pair
      // strands half an emoji, and the response ships it as U+FFFD.
      const chars = [...query];
      const shown = chars.length > EMPTY_STATE_QUERY_MAX
        ? `${chars.slice(0, EMPTY_STATE_QUERY_MAX).join("")}…`
        : query;
      if (filter === "all") return t("links.noSearchMatches", { query: shown });
      return t("links.noSearchMatchesInFilter", { query: shown, filter: t(FILTER_LABEL[filter]) });
    }
    case "no-links":
    case undefined:
      return t("links.empty");
    default: {
      // A reason added to the union has to pick its own copy here instead of
      // inheriting the first-run message by falling through.
      const unhandled: never = emptyReason;
      return unhandled;
    }
  }
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

  const { currentPage, pageCount, perPage: rowsPerPage, start } = pageWindow(page, perPage, totalPages);

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      sort,
      page: String(currentPage),
      per_page: String(rowsPerPage),
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

  const rangeLabel = range === "all" ? t("range.long.all") : t(`range.${range}` as const);
  const preserveParams: Record<string, string | undefined> = {
    sort,
    filter,
    page: String(currentPage),
    per_page: String(rowsPerPage),
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
            {FILTER_CHIPS.map((chip) => (
              <a
                class={`filter-chip${filter === chip.key ? " active" : ""}`}
                href={filterUrl(chip.key)}
              >
                <span class="icon">{chip.icon}</span>
                <span>{t(FILTER_LABEL[chip.key])}</span>
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
          <p>{emptyStateCopy(t, emptyReason, searchQuery || "", filter)}</p>
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
                    const mainSlug = pickPrimarySlug(link.slugs);
                    const disabled = isLinkDisabled(link);
                    const href = `/_/admin/links/${link.id}`;
                    return (
                      <tr
                        class={disabled ? "disabled" : ""}
                        onclick={`if(event.target.closest('.no-row-nav'))return;location.href='${href}'`}
                      >
                        <td data-label={t("links.colLink")}>
                          <div class="col-link-label">
                            <a class="col-link-label-link no-row-nav" href={href}>
                              {link.label || link.url}
                            </a>
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
                to: Math.min(start + rowsPerPage, total),
                total,
              })}
            </div>
            {pageCount > 1 && (
              <nav class="pagination-pages" aria-label={t("pagination.landmark")}>
                <PageStep
                  direction="prev"
                  label={t("pagination.prev")}
                  href={currentPage > 1 ? pageUrl(currentPage - 1) : undefined}
                />
                {paginationItems(currentPage, pageCount).map((item) =>
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
                <PageStep
                  direction="next"
                  label={t("pagination.next")}
                  href={
                    currentPage < pageCount ? pageUrl(currentPage + 1) : undefined
                  }
                />
              </nav>
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
                    <option value={perPageUrl(n)} selected={rowsPerPage === n}>
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
