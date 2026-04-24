// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { BundleRepository, ClickRepository, LinkRepository } from "../db";
import { Bundle, BundleAccent, BundleStats, BundleWithSummary, Env, LinkWithSlugs, TimelineRange } from "../types";
import { ServiceResult, fail, ok } from "./result";
import { resolveClickFilters } from "./admin-management";

const VALID_ACCENTS: BundleAccent[] = ["orange", "red", "green", "blue", "purple"];

export interface CreateBundleBody {
  name?: string;
  description?: string | null;
  icon?: string | null;
  accent?: BundleAccent;
}

export interface UpdateBundleBody {
  name?: string;
  description?: string | null;
  icon?: string | null;
  accent?: BundleAccent;
}

export interface ListBundlesOpts {
  includeArchived?: boolean;
  archivedOnly?: boolean;
}

function validateAccent(a?: BundleAccent): string | null {
  if (a === undefined) return null;
  return VALID_ACCENTS.includes(a) ? null : `accent must be one of: ${VALID_ACCENTS.join(", ")}`;
}

export async function createBundle(
  env: Env,
  body: CreateBundleBody,
  identity: string,
  createdVia?: string,
): Promise<ServiceResult<Bundle>> {
  const name = (body.name ?? "").trim();
  if (!name) return fail(400, "name is required");
  if (name.length > 120) return fail(400, "name must be 120 characters or fewer");

  const accentErr = validateAccent(body.accent);
  if (accentErr) return fail(400, accentErr);

  const bundle = await BundleRepository.create(env.DB, {
    name,
    description: body.description ?? null,
    icon: body.icon ?? null,
    accent: body.accent ?? "orange",
    createdVia: createdVia ?? "app",
    createdBy: identity,
  });
  return ok(bundle, 201);
}

export async function listBundles(
  env: Env,
  identity: string,
  opts: ListBundlesOpts,
): Promise<ServiceResult<BundleWithSummary[]>> {
  const bundles = await BundleRepository.list(env.DB, {
    createdBy: identity,
    includeArchived: opts.includeArchived,
    archivedOnly: opts.archivedOnly,
  });
  if (bundles.length === 0) return ok([]);

  const bundleIds = bundles.map((b) => b.id);

  const filters = await resolveClickFilters(env, identity);
  const [linkCounts, summaries] = await Promise.all([
    env.DB
      .prepare(
        `SELECT bundle_id, COUNT(*) as cnt FROM bundle_links WHERE bundle_id IN (${bundleIds.map(() => "?").join(",")}) GROUP BY bundle_id`,
      )
      .bind(...bundleIds)
      .all<{ bundle_id: number; cnt: number }>(),
    ClickRepository.getBundleSummariesBulk(env.DB, bundleIds, undefined, filters),
  ]);

  const linkCountMap = new Map((linkCounts.results ?? []).map((r) => [r.bundle_id, r.cnt]));

  const enriched: BundleWithSummary[] = bundles.map((b) => {
    const s = summaries.get(b.id);
    return {
      ...b,
      link_count: linkCountMap.get(b.id) ?? 0,
      total_clicks: s?.total_clicks ?? 0,
      delta_pct: s?.delta_pct,
      sparkline: s?.sparkline ?? [],
      top_links: s?.top_links ?? [],
    };
  });
  return ok(enriched);
}

export async function getBundle(
  env: Env,
  id: number,
  identity: string,
): Promise<ServiceResult<Bundle>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  return ok(bundle);
}

export async function updateBundle(
  env: Env,
  id: number,
  patch: UpdateBundleBody,
  identity: string,
): Promise<ServiceResult<Bundle>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return fail(400, "name must not be blank");
    if (trimmed.length > 120) return fail(400, "name must be 120 characters or fewer");
    patch = { ...patch, name: trimmed };
  }
  const accentErr = validateAccent(patch.accent);
  if (accentErr) return fail(400, accentErr);

  const updated = await BundleRepository.update(env.DB, id, patch);
  return ok(updated!);
}

export async function archiveBundle(
  env: Env,
  id: number,
  identity: string,
): Promise<ServiceResult<Bundle>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  return ok((await BundleRepository.archive(env.DB, id))!);
}

export async function unarchiveBundle(
  env: Env,
  id: number,
  identity: string,
): Promise<ServiceResult<Bundle>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  return ok((await BundleRepository.unarchive(env.DB, id))!);
}

export async function deleteBundle(
  env: Env,
  id: number,
  identity: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  await BundleRepository.delete(env.DB, id);
  return ok({ deleted: true });
}

export async function addLinkToBundle(
  env: Env,
  bundleId: number,
  linkId: number,
  identity: string,
): Promise<ServiceResult<{ added: boolean }>> {
  const bundle = await BundleRepository.getById(env.DB, bundleId);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  await BundleRepository.addLink(env.DB, bundleId, linkId);
  return ok({ added: true });
}

export async function removeLinkFromBundle(
  env: Env,
  bundleId: number,
  linkId: number,
  identity: string,
): Promise<ServiceResult<{ removed: boolean }>> {
  const bundle = await BundleRepository.getById(env.DB, bundleId);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  const removed = await BundleRepository.removeLink(env.DB, bundleId, linkId);
  return ok({ removed });
}

export async function getBundleAnalytics(
  env: Env,
  id: number,
  range: TimelineRange,
  identity: string,
): Promise<ServiceResult<BundleStats>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  const filters = await resolveClickFilters(env, identity);
  const stats = await ClickRepository.getBundleStats(env.DB, id, range, undefined, filters);
  return ok(stats!);
}

export async function listBundleLinks(
  env: Env,
  id: number,
  identity: string,
): Promise<ServiceResult<LinkWithSlugs[]>> {
  const bundle = await BundleRepository.getById(env.DB, id);
  if (!bundle || bundle.created_by !== identity) return fail(404, "Bundle not found");
  return ok(await BundleRepository.listLinks(env.DB, id));
}

export async function listBundlesForLink(
  env: Env,
  linkId: number,
  identity: string,
): Promise<ServiceResult<Bundle[]>> {
  const link = await LinkRepository.getById(env.DB, linkId);
  if (!link) return fail(404, "Link not found");
  const bundles = await BundleRepository.listBundlesForLink(env.DB, linkId);
  return ok(bundles.filter((b) => b.created_by === identity));
}
