// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { LinkRepository, SlugRepository, ClickRepository, SettingRepository } from "../db";
import type { ClickFilters, LinkSort, LinkStatus } from "../db";
import { SlugCache } from "../kv";
import { DEFAULT_SLUG_LENGTH, LINKS_DEFAULT_PER_PAGE, LINKS_MAX_PER_PAGE } from "../constants";
import { generateUniqueSlug, validateSlugLength, validateCustomSlug } from "../slugs";
import { BreakdownPage, ClickData, ClickStats, DashboardStats, Env, LinkWithSlugs, Slug, TimelineData, TimelineRange } from "../types";
import { normalizeUrl } from "../normalize-url";
import { ServiceResult, ok, fail } from "./result";
import { resolveClickFilters } from "./admin-management";
import { clampBreakdownLimit, clampBreakdownOffset, parsePaginatedDimension } from "./analytics";
import { rangeToSinceTs } from "./trends";

export type { ServiceResult };

// Field validators shared by createLink and updateLink. They guard the admin
// API path, which parses raw JSON without a zod schema.
function validateLabel(label: unknown): string | null {
  if (label === undefined || label === null) return null;
  if (typeof label !== "string") return "label must be a string";
  return null;
}

function validateExpiresAt(expiresAt: unknown): string | null {
  if (expiresAt === undefined || expiresAt === null) return null;
  if (typeof expiresAt !== "number" || !Number.isInteger(expiresAt) || expiresAt < 0) {
    return "expires_at must be a nonnegative integer Unix timestamp";
  }
  return null;
}

export interface ListLinksOptions {
  /** Range used to compute delta_pct vs the previous window. Pass undefined to skip deltas. */
  withDeltaRange?: TimelineRange;
  /** Bot/self-referrer filters. Forwarded into both delta queries and the slug click_count subquery. */
  filters?: ClickFilters;
  /** Range that scopes the displayed click_count and total_clicks. Pass "all" or omit for lifetime. */
  range?: TimelineRange;
}

export async function listLinks(env: Env, opts?: ListLinksOptions): Promise<ServiceResult<LinkWithSlugs[]>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  const links = await LinkRepository.list(env.DB, { filters: opts?.filters, sinceTs });
  if (!opts?.withDeltaRange) return ok(links);
  const enriched = await ClickRepository.attachLinkDeltasBulk(env.DB, links, opts.withDeltaRange, undefined, opts.filters);
  return ok(enriched);
}

export interface ListLinksPageOptions extends ListLinksOptions {
  /** 1-based. Clamped up to 1 and down to the last populated page. */
  page?: number;
  /** Clamped to [1, LINKS_MAX_PER_PAGE]. */
  perPage?: number;
  sort?: LinkSort;
  status?: LinkStatus;
  /** Substring filter. Omit for the unsearched listing; a blank string matches nothing. */
  search?: string;
  /** Widen the search to created_by. Admin surfaces only. */
  includeOwner?: boolean;
}

/**
 * Why a rendered page has no rows, so the caller can pick the right empty copy.
 * `no-links` means the catalog itself is empty, `all-disabled` that every link
 * there is has expired, `no-matches` that the status filter selected none of
 * them, and `no-search-matches` that a search did.
 *
 * The last two are split here rather than in the page because this is where the
 * search is already trimmed. A caller re-deriving "did a search happen" from
 * the raw query can disagree with the reason it was handed.
 */
export type LinksEmptyReason = "no-links" | "all-disabled" | "no-matches" | "no-search-matches";

export interface LinksPageData {
  /** Rows for this page: already filtered, sorted and windowed by SQL. */
  links: LinkWithSlugs[];
  /** Rows matching the filters across the whole catalog. */
  total: number;
  /** Page actually served, after clamping. */
  page: number;
  perPage: number;
  totalPages: number;
  /** Set whenever `links` is empty, which is when the caller renders empty copy. */
  emptyReason?: LinksEmptyReason;
}

/**
 * One page of the links listing. Cost scales with `perPage`, not with the
 * catalog: SQL does the filtering, sorting and windowing, and only the served
 * rows get delta enrichment. Use this for the listings page; `listLinks`
 * remains for API and MCP callers that return the full set.
 *
 * Returns the page data rather than a `ServiceResult`: every input is clamped
 * here, so there is no failure to report and no caller has to write a fallback
 * arm that restates the shape.
 */
export async function listLinksPage(env: Env, opts?: ListLinksPageOptions): Promise<LinksPageData> {
  const perPage = Math.min(
    Math.max(1, Math.floor(opts?.perPage ?? LINKS_DEFAULT_PER_PAGE) || LINKS_DEFAULT_PER_PAGE),
    LINKS_MAX_PER_PAGE,
  );
  const requestedPage = Math.max(1, Math.floor(opts?.page ?? 1) || 1);
  const status = opts?.status ?? "active";
  const sinceTs = rangeToSinceTs(opts?.range);

  const result = await LinkRepository.page(
    env.DB,
    {
      limit: perPage,
      offset: (requestedPage - 1) * perPage,
      sort: opts?.sort ?? "recent",
      status,
      search: opts?.search,
      searchOwner: opts?.includeOwner,
    },
    { filters: opts?.filters, sinceTs },
  );

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  // The repository clamps an out-of-range offset, so derive the served page
  // from what came back rather than from what was asked for.
  const page = Math.floor(result.offset / perPage) + 1;

  // Keyed off the served window, not the total: the two come from separate
  // statements, so a positive total can arrive with nothing to render and the
  // page would print a row count directly above "no links yet".
  let emptyReason: LinksEmptyReason | undefined;
  if (result.links.length === 0) {
    // One extra count, only on the empty path, and unfiltered: it is the one
    // thing the rows cannot say, whether the catalog is empty or the filters
    // emptied it.
    const catalog = await LinkRepository.count(env.DB);
    if (catalog === 0) emptyReason = "no-links";
    // A live search outranks the status filter: the query is the specific thing
    // the page can name back to the user, and it is the more likely culprit.
    else if (opts?.search?.trim()) emptyReason = "no-search-matches";
    // Nothing active in a non-empty catalog means every link has expired. Any
    // other empty result is a status filter that selected none of them, which
    // is the opposite claim.
    else if (status === "active") emptyReason = "all-disabled";
    else emptyReason = "no-matches";
  }

  const links = opts?.withDeltaRange
    ? await ClickRepository.attachLinkDeltasBulk(env.DB, result.links, opts.withDeltaRange, undefined, opts.filters)
    : result.links;

  return { links, total: result.total, page, perPage, totalPages, emptyReason };
}

export interface GetLinkOptions {
  filters?: ClickFilters;
  range?: TimelineRange;
}

export async function getLink(env: Env, id: number, opts?: GetLinkOptions): Promise<ServiceResult<LinkWithSlugs>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  const link = await LinkRepository.getById(env.DB, id, { filters: opts?.filters, sinceTs });
  if (!link) return fail(404, "Link not found");
  if (!opts?.range || opts.range === "all") return ok(link);
  const [enriched] = await ClickRepository.attachLinkDeltasBulk(env.DB, [link], opts.range, undefined, opts.filters);
  return ok(enriched);
}

export async function getLinkBySlug(env: Env, slug: string, opts?: GetLinkOptions): Promise<ServiceResult<LinkWithSlugs>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  const link = await LinkRepository.getBySlug(env.DB, slug, { filters: opts?.filters, sinceTs });
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function createLink(
  env: Env,
  body: { url?: string; label?: string; slug_length?: number; expires_at?: number; created_via?: string; created_by?: string; allow_duplicate?: boolean },
): Promise<ServiceResult<LinkWithSlugs>> {
  if (!body.url || typeof body.url !== "string") {
    return fail(400, "url is required");
  }

  try {
    const parsed = new URL(body.url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fail(400, "url must use http or https");
    }
  } catch {
    return fail(400, "url must be a valid URL");
  }

  // The admin API path parses raw JSON without a schema, so the service layer
  // must reject malformed field types before they reach D1. A non-numeric
  // expires_at would otherwise be stored verbatim and break the numeric
  // expiry comparison in the redirect handler.
  const labelErr = validateLabel(body.label);
  if (labelErr) return fail(400, labelErr);
  const expiresErr = validateExpiresAt(body.expires_at);
  if (expiresErr) return fail(400, expiresErr);

  body.url = normalizeUrl(body.url);

  if (!body.allow_duplicate) {
    const existing = await LinkRepository.findByUrl(env.DB, body.url);
    if (existing.length > 0) {
      return ok(existing[0], 200, { duplicate: true, duplicate_count: existing.length });
    }
  }

  let slugLength: number;
  if (body.slug_length !== undefined) {
    slugLength = body.slug_length;
    const lengthErr = validateSlugLength(slugLength);
    if (lengthErr) return fail(400, lengthErr);
  } else {
    const identity = body.created_by ?? "anonymous";
    const dbDefault = await SettingRepository.get(env.DB, identity, "slug_default_length");
    const parsed = parseInt(dbDefault ?? String(DEFAULT_SLUG_LENGTH), 10);
    // A corrupted stored setting must not block link creation; only explicit
    // caller input gets a 400 above.
    slugLength = validateSlugLength(parsed) === null ? parsed : DEFAULT_SLUG_LENGTH;
  }

  let slug: string;
  try {
    slug = await generateUniqueSlug(env.DB, slugLength);
  } catch (e) {
    return fail(500, (e as Error).message);
  }

  const link = await LinkRepository.create(env.DB, {
    url: body.url,
    slug,
    label: body.label,
    expiresAt: body.expires_at,
    createdVia: body.created_via,
    createdBy: body.created_by,
  });

  await SlugCache.put(env.SLUG_KV, slug, {
    url: body.url,
    disabled_at: null,
    expires_at: body.expires_at ?? null,
  });

  return ok(link, 201);
}

export async function updateLink(
  env: Env,
  id: number,
  body: { url?: string; label?: string | null; expires_at?: number | null },
  identity: string,
): Promise<ServiceResult<LinkWithSlugs>> {
  const existing = await LinkRepository.getById(env.DB, id);
  if (!existing) return fail(404, "Link not found");
  if (existing.created_by !== identity) return fail(403, "Only the link owner can update this link");

  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return fail(400, "url must use http or https");
      }
    } catch {
      return fail(400, "url must be a valid URL");
    }
    body.url = normalizeUrl(body.url);
  }

  const labelErr = validateLabel(body.label);
  if (labelErr) return fail(400, labelErr);
  const expiresErr = validateExpiresAt(body.expires_at);
  if (expiresErr) return fail(400, expiresErr);

  const link = await LinkRepository.update(env.DB, id, body);
  if (!link) return fail(404, "Link not found");

  await Promise.all(
    link.slugs.map((s) =>
      SlugCache.put(env.SLUG_KV, s.slug, {
        url: link.url,
        disabled_at: s.disabled_at,
        expires_at: link.expires_at,
      }),
    ),
  );

  return ok(link);
}

export async function disableLink(env: Env, id: number, identity: string): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.getById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can disable this link");
  const disabled = await LinkRepository.disable(env.DB, id);
  if (!disabled) return fail(404, "Link not found");

  await Promise.all(
    disabled.slugs.map((s) =>
      SlugCache.put(env.SLUG_KV, s.slug, {
        url: disabled.url,
        disabled_at: s.disabled_at,
        expires_at: disabled.expires_at,
      }),
    ),
  );

  return ok(disabled);
}

export async function enableLink(env: Env, id: number, identity: string): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.getById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can enable this link");
  const enabled = await LinkRepository.enable(env.DB, id);
  // null on race: link deleted between getById and the UPDATE.
  if (!enabled) return fail(404, "Link not found");

  await Promise.all(
    enabled.slugs.map((s) =>
      SlugCache.put(env.SLUG_KV, s.slug, {
        url: enabled.url,
        disabled_at: s.disabled_at,
        expires_at: null,
      }),
    ),
  );

  return ok(enabled);
}

export async function deleteLink(env: Env, id: number, identity: string): Promise<ServiceResult<{ deleted: boolean }>> {
  const link = await LinkRepository.getById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can delete this link");
  if (link.total_clicks > 0) return fail(400, "Cannot delete a link with clicks, disable it instead");

  const deletedSlugs = await LinkRepository.delete(env.DB, id);
  if (!deletedSlugs) {
    // delete() returns false for two reasons: a concurrent request removed the
    // link, or a concurrent click pushed total_clicks past the lifetime guard.
    // A cheap existence check disambiguates: 404 for a vanished link, 400 otherwise.
    if (!(await LinkRepository.exists(env.DB, id))) return fail(404, "Link not found");
    return fail(400, "Cannot delete a link with clicks, disable it instead");
  }
  // Evict the slug set the repository removed at delete time, not the slugs from
  // the read above, so a custom slug added in between is not orphaned in KV.
  await Promise.all(deletedSlugs.map((s) => SlugCache.delete(env.SLUG_KV, s)));

  return ok({ deleted: true });
}

export async function addCustomSlugToLink(
  env: Env,
  linkId: number,
  body: { slug?: string },
): Promise<ServiceResult<Slug>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");

  if (!body.slug || typeof body.slug !== "string") {
    return fail(400, "slug is required");
  }

  const normalizedSlug = body.slug.toLowerCase();

  const err = validateCustomSlug(normalizedSlug);
  if (err) return fail(400, err);

  if (await SlugRepository.exists(env.DB, normalizedSlug)) {
    return fail(409, "Slug already exists");
  }

  let slug: Slug;
  try {
    slug = await SlugRepository.addCustom(env.DB, linkId, normalizedSlug);
  } catch (e) {
    // A concurrent request may claim the same slug between the exists() check
    // and the INSERT, hitting the UNIQUE constraint. Surface it as 409.
    if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
      return fail(409, "Slug already exists");
    }
    throw e;
  }

  await SlugCache.put(env.SLUG_KV, normalizedSlug, {
    url: link.url,
    disabled_at: null,
    expires_at: link.expires_at,
  });

  return ok(slug, 201);
}


export async function setSlugPrimary(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<LinkWithSlugs>> {
  slug = slug.toLowerCase();
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can change the primary slug");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");

  await SlugRepository.setPrimary(env.DB, linkId, slug);
  const updated = await LinkRepository.getById(env.DB, linkId);
  if (!updated) return fail(404, "Link not found");
  return ok(updated);
}

export async function disableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<Slug>> {
  slug = slug.toLowerCase();
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can disable slugs on this link");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");
  if (!slugObj.is_custom) return fail(400, "Cannot disable the system-generated slug; only custom slugs can be disabled. Disable the whole link instead.");

  const disabled = await SlugRepository.disable(env.DB, slug);
  if (!disabled) return fail(404, "Slug not found");

  await SlugCache.put(env.SLUG_KV, slug, {
    url: link.url,
    disabled_at: disabled.disabled_at,
    expires_at: link.expires_at,
  });

  return ok(disabled);
}

export async function enableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<Slug>> {
  slug = slug.toLowerCase();
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can enable slugs on this link");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");

  const enabled = await SlugRepository.enable(env.DB, slug);
  if (!enabled) return fail(404, "Slug not found");

  await SlugCache.put(env.SLUG_KV, slug, {
    url: link.url,
    disabled_at: null,
    expires_at: link.expires_at,
  });

  return ok(enabled);
}

export async function removeSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<{ removed: boolean }>> {
  slug = slug.toLowerCase();
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can remove slugs on this link");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");
  if (!slugObj.is_custom) return fail(400, "Cannot remove the system-generated slug; only custom slugs can be removed.");
  if (slugObj.click_count > 0) return fail(400, "Cannot remove a slug with clicks, disable it instead");

  const removed = await SlugRepository.remove(env.DB, slug);
  if (!removed) {
    // remove() returns false for two reasons: a concurrent request already
    // removed the slug from this link, or a click landed between the pre-read
    // above and the transactional delete (the NOT EXISTS guard then blocks it).
    // Re-read to disambiguate by membership: slug values are globally unique
    // and can be re-claimed by another link once freed, so a global existence
    // check could misattribute a re-claimed slug. 404 when the slug no longer
    // belongs to this link, 400 (still here, has clicks) otherwise.
    const current = await SlugRepository.findByValue(env.DB, slug);
    if (!current || current.link_id !== linkId) return fail(404, "Slug not found on this link");
    return fail(400, "Cannot remove a slug with clicks, disable it instead");
  }
  // Evict only after a confirmed delete, so a blocked delete does not drop the
  // cache entry for a slug that is still resolving.
  await SlugCache.delete(env.SLUG_KV, slug);

  return ok({ removed: true });
}

export async function getLinkTimeline(env: Env, linkId: number, range: TimelineRange, filters?: ClickFilters): Promise<ServiceResult<TimelineData>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  return ok(await ClickRepository.getTimeline(env.DB, linkId, range, undefined, filters));
}

export async function getLinkAnalytics(env: Env, linkId: number, range: TimelineRange | undefined, filters?: ClickFilters): Promise<ServiceResult<ClickStats>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  return ok(await ClickRepository.getStats(env.DB, linkId, range, filters));
}

export async function getLinkBreakdownPage(
  env: Env,
  linkId: number,
  dimension: string,
  range: TimelineRange | undefined,
  offset: number,
  limit: number,
  filters?: ClickFilters,
): Promise<ServiceResult<BreakdownPage>> {
  const dim = parsePaginatedDimension(dimension);
  if (!dim) return fail(400, `Unknown breakdown dimension: ${dimension}`);
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  const page = await ClickRepository.getLinkBreakdownPage(
    env.DB, linkId, dim, range, clampBreakdownOffset(offset), clampBreakdownLimit(limit), filters,
  );
  return ok(page);
}

export async function getDashboardStats(
  env: Env,
  range: TimelineRange,
  identity: string,
): Promise<ServiceResult<DashboardStats>> {
  const filters = await resolveClickFilters(env, identity);
  return ok(await ClickRepository.getDashboardStats(env.DB, range, undefined, filters));
}

export async function findSlugForRedirect(
  env: Env,
  slug: string,
): Promise<(import("../types").Slug & { url: string; expires_at: number | null }) | null> {
  return SlugRepository.findByValue(env.DB, slug);
}

export interface SearchLinksOptions extends ListLinksOptions {
  includeOwner?: boolean;
}

export async function searchLinks(
  env: Env,
  query: string,
  opts?: SearchLinksOptions,
): Promise<ServiceResult<LinkWithSlugs[]>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  const links = await LinkRepository.search(env.DB, query, {
    includeOwner: opts?.includeOwner,
    filters: opts?.filters,
    sinceTs,
  });
  if (!opts?.withDeltaRange) return ok(links);
  const enriched = await ClickRepository.attachLinkDeltasBulk(env.DB, links, opts.withDeltaRange, undefined, opts.filters);
  return ok(enriched);
}

export async function listLinksByOwner(env: Env, owner: string, opts?: ListLinksOptions): Promise<ServiceResult<LinkWithSlugs[]>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  const links = await LinkRepository.findByOwner(env.DB, owner, { filters: opts?.filters, sinceTs });
  if (!opts?.withDeltaRange) return ok(links);
  const enriched = await ClickRepository.attachLinkDeltasBulk(env.DB, links, opts.withDeltaRange, undefined, opts.filters);
  return ok(enriched);
}

export async function autoLabelLink(
  db: D1Database,
  linkId: number,
  url: string,
  titleFetcher: (url: string) => Promise<string | null>,
): Promise<void> {
  const link = await LinkRepository.getById(db, linkId);
  if (!link || link.label) return;

  const title = await titleFetcher(url);
  if (!title) return;

  await LinkRepository.update(db, linkId, { label: title });
}

export async function recordClick(
  env: Env,
  slug: string,
  data: ClickData,
): Promise<void> {
  return ClickRepository.record(env.DB, slug, data);
}
