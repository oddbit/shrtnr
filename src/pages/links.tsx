// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { LinkWithSlugs } from "../types";
import type { TranslateFn } from "../i18n";

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

type Props = {
  links: LinkWithSlugs[];
  sort: string;
  page: number;
  perPage: number;
  showDisabled: boolean;
  searchQuery?: string;
  t: TranslateFn;
  lang: string;
};

export const LinksPage: FC<Props> = ({
  links,
  sort,
  page,
  perPage,
  showDisabled,
  searchQuery,
  t,
  lang,
}) => {
  const now = Math.floor(Date.now() / 1000);
  const filtered = showDisabled
    ? links
    : links.filter((l) => !l.expires_at || l.expires_at > now);

  const sorted = [...filtered].sort((a, b) =>
    sort === "popular"
      ? b.total_clicks - a.total_clicks
      : b.created_at - a.created_at,
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageLinks = sorted.slice(start, start + perPage);

  function sortUrl(s: string): string {
    const params = new URLSearchParams();
    params.set("sort", s);
    params.set("per_page", String(perPage));
    if (showDisabled) params.set("show_disabled", "1");
    return `/_/admin/links?${params}`;
  }

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("page", String(p));
    params.set("per_page", String(perPage));
    if (showDisabled) params.set("show_disabled", "1");
    return `/_/admin/links?${params}`;
  }

  function perPageUrl(n: number): string {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("per_page", String(n));
    if (showDisabled) params.set("show_disabled", "1");
    return `/_/admin/links?${params}`;
  }

  function disabledUrl(): string {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("per_page", String(perPage));
    if (!showDisabled) params.set("show_disabled", "1");
    return `/_/admin/links?${params}`;
  }

  const countKey = filtered.length !== 1 ? "links.countPlural" : "links.count";

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
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
          <span style="font-size:0.85rem;color:var(--color-text-muted)">{t("links.searchResults", { count: filtered.length })}</span>
          <a href="/_/admin/links" class="btn btn-ghost btn-sm" style="font-size:0.8rem">
            <span class="icon" style="font-size:14px">close</span> {t("links.clearSearch")}
          </a>
        </div>
      )}

      <div class="toolbar">
        <div style="display:flex;align-items:center;gap:1rem">
          <div class="toolbar-count">
            {t(countKey as any, { count: filtered.length })}
          </div>
          <div class="toolbar-sort">
            <a
              class={`sort-btn${sort === "recent" ? " active" : ""}`}
              href={sortUrl("recent")}
            >
              <span class="icon" style="font-size:16px">
                schedule
              </span>{" "}
              {t("links.recent")}
            </a>
            <a
              class={`sort-btn${sort === "popular" ? " active" : ""}`}
              href={sortUrl("popular")}
            >
              <span class="icon" style="font-size:16px">
                trending_up
              </span>{" "}
              {t("links.popular")}
            </a>
          </div>
          <a
            class={`sort-btn${showDisabled ? " active" : ""}`}
            href={disabledUrl()}
          >
            <span class="icon" style="font-size:16px">
              block
            </span>{" "}
            {t("links.showDisabled")}
          </a>
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
          {pageLinks.map((link) => {
            const orderedSlugs = [...link.slugs].sort((a, b) => {
              if (a.is_custom !== b.is_custom) return a.is_custom - b.is_custom;
              return a.created_at - b.created_at;
            });
            const disabled = !!(link.expires_at && link.expires_at < now);
            return (
              <a
                href={`/_/admin/links/${link.id}`}
                class={`link-item${disabled ? " link-disabled" : ""}`}
              >
                <div class="link-info">
                  {link.label && (
                    <div class="link-label">{link.label}</div>
                  )}
                  <div class="link-slugs">
                    {orderedSlugs.map((s) => (
                      <span
                        class={`slug-chip${s.is_custom ? " custom" : ""}${s.disabled_at ? " slug-chip-disabled" : ""}`}
                        onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(s.slug)}')`}
                        title={t("links.clickToCopy")}
                        style={s.disabled_at ? "opacity:0.4" : undefined}
                      >
                        {s.slug} <span class="icon">content_copy</span>
                      </span>
                    ))}
                    {disabled && (
                      <span class="disabled-badge">
                        <span class="icon" style="font-size:14px">
                          block
                        </span>{" "}
                        {t("links.disabled")}
                      </span>
                    )}
                  </div>
                  <div class="link-url">{link.url}</div>
                  <div class="link-date">{formatDate(link.created_at, lang)}</div>
                </div>
                <div class="link-meta">
                  <div style="text-align:center">
                    <div class="link-clicks">{link.total_clicks}</div>
                    <div class="link-clicks-label">{t("links.clicks")}</div>
                  </div>
                </div>
              </a>
            );
          })}

          {(totalPages > 1 || links.length > 25) && (
            <div class="pagination">
              <div class="pagination-pages">
                <a
                  class={`page-btn${currentPage <= 1 ? " disabled" : ""}`}
                  href={currentPage > 1 ? pageUrl(currentPage - 1) : "#"}
                >
                  <span class="icon" style="font-size:16px">
                    chevron_left
                  </span>
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
                  <span class="icon" style="font-size:16px">
                    chevron_right
                  </span>
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
