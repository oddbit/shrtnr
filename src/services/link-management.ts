// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { LinkRepository, SlugRepository, ClickRepository, SettingRepository } from "../db";
import { DEFAULT_SLUG_LENGTH } from "../constants";
import { generateUniqueSlug, validateSlugLength, validateVanitySlug } from "../slugs";
import { ClickStats, DashboardStats, Env, LinkWithSlugs, Slug } from "../types";
import { ServiceResult, ok, fail } from "./result";

export type { ServiceResult };

export async function listLinks(env: Env): Promise<ServiceResult<LinkWithSlugs[]>> {
  return ok(await LinkRepository.list(env.DB));
}

export async function getLink(env: Env, id: number): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.getById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function getLinkBySlug(env: Env, slug: string): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.getBySlug(env.DB, slug);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function createLink(
  env: Env,
  body: { url?: string; label?: string; slug_length?: number; vanity_slug?: string; expires_at?: number; created_via?: string; created_by?: string; allow_duplicate?: boolean },
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

  if (!body.allow_duplicate) {
    const existing = await LinkRepository.findByUrl(env.DB, body.url);
    if (existing.length > 0) {
      return ok(existing[0], 200, { duplicate: true });
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

  if (body.vanity_slug) {
    const vanityErr = validateVanitySlug(body.vanity_slug);
    if (vanityErr) return fail(400, vanityErr);

    if (await SlugRepository.exists(env.DB, body.vanity_slug)) {
      return fail(409, "Vanity slug already exists");
    }
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
    vanitySlug: body.vanity_slug,
    expiresAt: body.expires_at,
    createdVia: body.created_via,
    createdBy: body.created_by,
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
  return ok(link);
}

export async function disableLink(env: Env, id: number): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await LinkRepository.disable(env.DB, id);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function addVanitySlugToLink(
  env: Env,
  linkId: number,
  body: { slug?: string },
): Promise<ServiceResult<Slug>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");

  if (!body.slug || typeof body.slug !== "string") {
    return fail(400, "slug is required");
  }

  const err = validateVanitySlug(body.slug);
  if (err) return fail(400, err);

  if (link.slugs.some((s) => s.is_vanity)) {
    return fail(409, "Link already has a vanity slug");
  }

  if (await SlugRepository.exists(env.DB, body.slug)) {
    return fail(409, "Slug already exists");
  }

  const slug = await SlugRepository.addVanity(env.DB, linkId, body.slug);
  return ok(slug, 201);
}

export async function getLinkAnalytics(env: Env, linkId: number): Promise<ServiceResult<ClickStats>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  return ok(await ClickRepository.getStats(env.DB, linkId));
}

export async function getDashboardStats(env: Env): Promise<ServiceResult<DashboardStats>> {
  return ok(await ClickRepository.getDashboardStats(env.DB));
}

export async function findSlugForRedirect(
  env: Env,
  slug: string,
): Promise<(import("../types").Slug & { url: string; expires_at: number | null }) | null> {
  return SlugRepository.findByValue(env.DB, slug);
}

export async function searchLinks(env: Env, query: string): Promise<ServiceResult<LinkWithSlugs[]>> {
  return ok(await LinkRepository.search(env.DB, query));
}

export async function recordClick(
  env: Env,
  slugId: number,
  referrer: string | null,
  country: string | null,
  deviceType: string | null,
  browser: string | null,
  channel?: string | null,
): Promise<void> {
  return ClickRepository.record(env.DB, slugId, referrer, country, deviceType, browser, channel);
}
