// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "../types";
import type { Env, TimelineRange, LinkWithSlugs } from "../../../types";
import { LinkRepository } from "../../../db";
import { parseRangeParam } from "./_range";

interface RecentLinksData {
  range: TimelineRange;
  links: LinkWithSlugs[];
}

/**
 * Mirrors the primary-slug pick on the dashboard page: the first
 * auto-generated slug, falling back to the first slug of any kind.
 */
function primarySlug(link: LinkWithSlugs): string {
  const p = link.slugs.find((s) => !s.is_custom);
  return p ? p.slug : link.slugs[0]?.slug || "";
}

/**
 * Recent-links panel widget: the five newest links by created_at, each row
 * showing the primary slug-chip (data-copy-slug, copied by a delegated
 * handler), destination url, and
 * total clicks. The loader uses LinkRepository.recent, a bounded two-query
 * fetch, so the query count stays constant as the catalog grows rather than
 * loading the whole table the way list() does. Emits the recent-links panel's
 * inner content only; the htmx placeholder owns the surrounding bento-card.
 */
export const recentLinksWidget: AdminWidget<{ range: TimelineRange }, RecentLinksData> = {
  id: "dashboard.recent-links",
  shape: "list",
  // The loader ignores range (always the five newest links), so do not vary
  // the cache by range: one shared entry, no re-query when the user switches.
  cache: { ttl: 60, varyByRange: false },
  params: parseRangeParam,
  async load(env: Env, ctx, { range }): Promise<RecentLinksData> {
    const links = await LinkRepository.recent(env.DB, 5, { filters: ctx.filters });
    return { range, links };
  },
  render(d, ctx) {
    const t = ctx.t;
    return (
      <>
        <div class="bento-label">{t("dashboard.recentLinks")}</div>
        {d.links.length === 0 ? (
          <div class="muted-hint">{t("dashboard.noLinks")}</div>
        ) : (
          d.links.map((link) => {
            const slug = primarySlug(link);
            return (
              <a href={`/_/admin/links/${link.id}`} class="recent-row">
                <span
                  class="slug-chip"
                  data-copy-slug={slug}
                  title={t("dashboard.clickToCopy")}
                >
                  {slug}{" "}
                  <span class="icon">content_copy</span>
                </span>
                <span class="recent-row-url">{link.url}</span>
                <span class="recent-row-clicks">{link.total_clicks}</span>
              </a>
            );
          })
        )}
      </>
    );
  },
};
