// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  dbAddVanitySlug,
  dbCreateLink,
  dbDisableLink,
  dbGetAllLinks,
  dbGetDashboardStats,
  dbGetLinkById,
  dbGetLinkBySlug,
  dbGetLinkClickStats,
  dbGetSetting,
  dbSlugExists,
  dbUpdateLink,
} from "../db";
import { DEFAULT_SLUG_LENGTH } from "../constants";
import { generateUniqueSlug, validateSlugLength, validateVanitySlug } from "../slugs";
import { ClickStats, DashboardStats, Env, LinkWithSlugs, Slug } from "../types";
import { ServiceResult } from "../api/response";

function ok<T>(data: T, status = 200): ServiceResult<T> {
  return { ok: true, status, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

export async function listLinks(env: Env): Promise<ServiceResult<LinkWithSlugs[]>> {
  return ok(await dbGetAllLinks(env.DB));
}

export async function getLink(env: Env, id: number): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await dbGetLinkById(env.DB, id);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function getLinkBySlug(env: Env, slug: string): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await dbGetLinkBySlug(env.DB, slug);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function createLink(
  env: Env,
  body: { url?: string; label?: string; slug_length?: number; vanity_slug?: string; expires_at?: number; created_via?: string; created_by?: string }
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

  let slugLength: number;
  if (body.slug_length !== undefined) {
    slugLength = body.slug_length;
  } else {
    const identity = body.created_by ?? "anonymous";
    const dbDefault = await dbGetSetting(env.DB, identity, "slug_default_length");
    slugLength = parseInt(dbDefault ?? String(DEFAULT_SLUG_LENGTH), 10);
  }

  const lengthErr = validateSlugLength(slugLength);
  if (lengthErr) return fail(400, lengthErr);

  if (body.vanity_slug) {
    const vanityErr = validateVanitySlug(body.vanity_slug);
    if (vanityErr) return fail(400, vanityErr);

    if (await dbSlugExists(env.DB, body.vanity_slug)) {
      return fail(409, "Vanity slug already exists");
    }
  }

  let slug: string;
  try {
    slug = await generateUniqueSlug(env.DB, slugLength);
  } catch (e) {
    return fail(500, (e as Error).message);
  }

  const link = await dbCreateLink(env.DB, body.url, slug, body.label, body.vanity_slug, body.expires_at, body.created_via, body.created_by);
  return ok(link, 201);
}

export async function updateLink(
  env: Env,
  id: number,
  body: { url?: string; label?: string | null; expires_at?: number | null }
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

  const link = await dbUpdateLink(env.DB, id, body);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function disableLink(env: Env, id: number): Promise<ServiceResult<LinkWithSlugs>> {
  const link = await dbDisableLink(env.DB, id);
  if (!link) return fail(404, "Link not found");
  return ok(link);
}

export async function addVanitySlugToLink(
  env: Env,
  linkId: number,
  body: { slug?: string }
): Promise<ServiceResult<Slug>> {
  const link = await dbGetLinkById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");

  if (!body.slug || typeof body.slug !== "string") {
    return fail(400, "slug is required");
  }

  const err = validateVanitySlug(body.slug);
  if (err) return fail(400, err);

  if (link.slugs.some((s) => s.is_vanity)) {
    return fail(409, "Link already has a vanity slug");
  }

  if (await dbSlugExists(env.DB, body.slug)) {
    return fail(409, "Slug already exists");
  }

  const slug = await dbAddVanitySlug(env.DB, linkId, body.slug);
  return ok(slug, 201);
}

export async function getLinkAnalytics(env: Env, linkId: number): Promise<ServiceResult<ClickStats>> {
  const link = await dbGetLinkById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  return ok(await dbGetLinkClickStats(env.DB, linkId));
}

export async function getDashboardStats(env: Env): Promise<ServiceResult<DashboardStats>> {
  return ok(await dbGetDashboardStats(env.DB));
}
