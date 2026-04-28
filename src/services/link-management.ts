// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { LinkRepository, SlugRepository, ClickRepository, SettingRepository } from "../db";
import type { ClickFilters } from "../db";
import { SlugCache } from "../kv";
import { DEFAULT_SLUG_LENGTH } from "../constants";
import { generateUniqueSlug, validateSlugLength, validateCustomSlug } from "../slugs";
import { ClickData, ClickStats, DashboardStats, Env, LinkWithSlugs, Slug, TimelineData, TimelineRange } from "../types";
import { normalizeUrl } from "../normalize-url";
import { ServiceResult, ok, fail } from "./result";
import { resolveClickFilters } from "./admin-management";
import { rangeToSinceTs } from "./trends";

export type { ServiceResult };

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

export interface GetLinkOptions {
  filters?: ClickFilters;
  range?: TimelineRange;
}

export async function getLink(env: Env, id: number, opts?: GetLinkOptions): Promise<ServiceResult<LinkWithSlugs>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  const link = await LinkRepository.getById(env.DB, id, { filters: opts?.filters, sinceTs });
  if (!link) return fail(404, "Link not found");
  return ok(link);
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
  } else {
    const identity = body.created_by ?? "anonymous";
    const dbDefault = await SettingRepository.get(env.DB, identity, "slug_default_length");
    slugLength = parseInt(dbDefault ?? String(DEFAULT_SLUG_LENGTH), 10);
  }

  const lengthErr = validateSlugLength(slugLength);
  if (lengthErr) return fail(400, lengthErr);

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
): Promise<ServiceResult<LinkWithSlugs>> {
  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return fail(400, "url must use http or https");
      }
    } catch {
      return fail(400, "url must be a valid URL");
    }
  }

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

  await Promise.all(
    disabled!.slugs.map((s) =>
      SlugCache.put(env.SLUG_KV, s.slug, {
        url: disabled!.url,
        disabled_at: s.disabled_at,
        expires_at: disabled!.expires_at,
      }),
    ),
  );

  return ok(disabled!);
}

export async function enableLink(env: Env, id: number, identity: string): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.getById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can enable this link");
  const enabled = await LinkRepository.update(env.DB, id, { expires_at: null });

  await Promise.all(
    enabled!.slugs.map((s) =>
      SlugCache.put(env.SLUG_KV, s.slug, {
        url: enabled!.url,
        disabled_at: s.disabled_at,
        expires_at: null,
      }),
    ),
  );

  return ok(enabled!);
}

export async function deleteLink(env: Env, id: number, identity: string): Promise<ServiceResult<{ deleted: boolean }>> {
  const link = await LinkRepository.getById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can delete this link");
  if (link.total_clicks > 0) return fail(400, "Cannot delete a link with clicks, disable it instead");

  const slugsToDelete = link.slugs.map((s) => s.slug);
  await LinkRepository.delete(env.DB, id);
  await Promise.all(slugsToDelete.map((s) => SlugCache.delete(env.SLUG_KV, s)));

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

  const slug = await SlugRepository.addCustom(env.DB, linkId, normalizedSlug);

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
): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");

  await SlugRepository.setPrimary(env.DB, linkId, slug);
  return ok((await LinkRepository.getById(env.DB, linkId))!);
}

export async function disableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<Slug>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can disable slugs on this link");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");
  if (!slugObj.is_custom) return fail(400, "Cannot disable the random slug");

  const disabled = await SlugRepository.disable(env.DB, slug);

  await SlugCache.put(env.SLUG_KV, slug, {
    url: link.url,
    disabled_at: disabled!.disabled_at,
    expires_at: link.expires_at,
  });

  return ok(disabled!);
}

export async function enableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<Slug>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can enable slugs on this link");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");

  const enabled = await SlugRepository.enable(env.DB, slug);

  await SlugCache.put(env.SLUG_KV, slug, {
    url: link.url,
    disabled_at: null,
    expires_at: link.expires_at,
  });

  return ok(enabled!);
}

export async function removeSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<ServiceResult<{ removed: boolean }>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  if (link.created_by !== identity) return fail(403, "Only the link owner can remove slugs on this link");

  const slugObj = link.slugs.find((s) => s.slug === slug);
  if (!slugObj) return fail(404, "Slug not found on this link");
  if (!slugObj.is_custom) return fail(400, "Cannot remove the random slug");
  if (slugObj.click_count > 0) return fail(400, "Cannot remove a slug with clicks, disable it instead");

  await SlugRepository.remove(env.DB, slug);
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

export async function listLinksByOwner(env: Env, owner: string, opts?: GetLinkOptions): Promise<ServiceResult<LinkWithSlugs[]>> {
  const sinceTs = rangeToSinceTs(opts?.range);
  return ok(await LinkRepository.findByOwner(env.DB, owner, { filters: opts?.filters, sinceTs }));
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
