// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { LinkWithSlugs } from "../types";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", {
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
  slugLength: number;
};

export const LinksPage: FC<Props> = ({
  links,
  sort,
  page,
  perPage,
  showDisabled,
  slugLength,
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
    return `/_/links?${params}`;
  }

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("page", String(p));
    params.set("per_page", String(perPage));
    if (showDisabled) params.set("show_disabled", "1");
    return `/_/links?${params}`;
  }

  function perPageUrl(n: number): string {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("per_page", String(n));
    if (showDisabled) params.set("show_disabled", "1");
    return `/_/links?${params}`;
  }

  function disabledUrl(): string {
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("per_page", String(perPage));
    if (!showDisabled) params.set("show_disabled", "1");
    return `/_/links?${params}`;
  }

  return (
    <>
      <div class="page-header">
        <div class="page-title">Links</div>
        <div class="page-subtitle">Manage all your short links</div>
      </div>

      <input type="hidden" id="slug-length-default" value={String(slugLength)} />

      <div class="toolbar">
        <div style="display:flex;align-items:center;gap:1rem">
          <div class="toolbar-count">
            {filtered.length} link{filtered.length !== 1 ? "s" : ""}
          </div>
          <div class="toolbar-sort">
            <a
              class={`sort-btn${sort === "recent" ? " active" : ""}`}
              href={sortUrl("recent")}
            >
              <span class="icon" style="font-size:16px">
                schedule
              </span>{" "}
              Recent
            </a>
            <a
              class={`sort-btn${sort === "popular" ? " active" : ""}`}
              href={sortUrl("popular")}
            >
              <span class="icon" style="font-size:16px">
                trending_up
              </span>{" "}
              Popular
            </a>
          </div>
          <a
            class={`sort-btn${showDisabled ? " active" : ""}`}
            href={disabledUrl()}
          >
            <span class="icon" style="font-size:16px">
              block
            </span>{" "}
            Show disabled
          </a>
        </div>
        <button class="btn btn-primary" onclick="showCreateModal()">
          <span class="icon">add</span> New Link
        </button>
      </div>

      {filtered.length === 0 ? (
        <div class="empty-state">
          <span class="icon">link_off</span>
          <p>
            {links.length > 0
              ? 'All links are disabled. Toggle "Show disabled" to see them.'
              : "No links yet. Use the + New Link button above to get started."}
          </p>
        </div>
      ) : (
        <>
          {pageLinks.map((link) => {
            const primary = link.slugs.find((s) => !s.is_vanity);
            const vanity = link.slugs.filter((s) => s.is_vanity);
            const disabled = !!(link.expires_at && link.expires_at < now);
            return (
              <a
                href={`/_/links/${link.id}`}
                class={`link-item${disabled ? " link-disabled" : ""}`}
              >
                <div class="link-info">
                  <div class="link-slugs">
                    {primary && (
                      <span
                        class="slug-chip"
                        onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(primary.slug)}')`}
                        title="Click to copy"
                      >
                        /{primary.slug}{" "}
                        <span class="icon">content_copy</span>
                      </span>
                    )}
                    {vanity.map((v) => (
                      <span
                        class="slug-chip vanity"
                        onclick={`event.preventDefault();event.stopPropagation();copyUrl('${escHtml(v.slug)}')`}
                        title="Click to copy"
                      >
                        /{v.slug} <span class="icon">content_copy</span>
                      </span>
                    ))}
                    {disabled && (
                      <span class="disabled-badge">
                        <span class="icon" style="font-size:14px">
                          block
                        </span>{" "}
                        Disabled
                      </span>
                    )}
                  </div>
                  {link.label && (
                    <div class="link-label">{link.label}</div>
                  )}
                  <div class="link-url">{link.url}</div>
                  <div class="link-date">{formatDate(link.created_at)}</div>
                </div>
                <div class="link-meta">
                  <div style="text-align:center">
                    <div class="link-clicks">{link.total_clicks}</div>
                    <div class="link-clicks-label">clicks</div>
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
                Show{" "}
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
