// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env, TimelineRange } from "../types";
import {
  addLinkToBundle,
  archiveBundle,
  createBundle,
  deleteBundle,
  getBundle,
  getBundleAnalytics,
  listBundleLinks,
  listBundles,
  listBundlesForLink,
  removeLinkFromBundle,
  unarchiveBundle,
  updateBundle,
} from "../services/bundle-management";
import { resolveClickFilters } from "../services/admin-management";
import { fromServiceResult, json } from "./response";

const VALID_RANGES = new Set<TimelineRange>(["24h", "7d", "30d", "90d", "1y", "all"]);

function parseRange(raw: string | undefined, fallback: TimelineRange = "30d"): TimelineRange {
  return VALID_RANGES.has(raw as TimelineRange) ? (raw as TimelineRange) : fallback;
}

function parseArchivedFilter(raw: string | undefined): { includeArchived?: boolean; archivedOnly?: boolean } {
  if (raw === "true" || raw === "1" || raw === "only") return { archivedOnly: true };
  if (raw === "all") return { includeArchived: true };
  return {};
}

export async function handleListBundles(env: Env, identity: string, opts: { archived?: string }): Promise<Response> {
  const filter = parseArchivedFilter(opts.archived);
  return fromServiceResult(await listBundles(env, identity, filter));
}

export async function handleGetBundle(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await getBundle(env, id, identity));
}

export async function handleCreateBundle(request: Request, env: Env, identity: string, createdVia?: string): Promise<Response> {
  let body: { name?: string; description?: string | null; icon?: string | null; accent?: "orange" | "red" | "green" | "blue" | "purple" };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  return fromServiceResult(await createBundle(env, body, identity, createdVia));
}

export async function handleUpdateBundle(request: Request, env: Env, id: number, identity: string): Promise<Response> {
  let body: { name?: string; description?: string | null; icon?: string | null; accent?: "orange" | "red" | "green" | "blue" | "purple" };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  return fromServiceResult(await updateBundle(env, id, body, identity));
}

export async function handleArchiveBundle(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await archiveBundle(env, id, identity));
}

export async function handleUnarchiveBundle(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await unarchiveBundle(env, id, identity));
}

export async function handleDeleteBundle(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await deleteBundle(env, id, identity));
}

/**
 * Admin-side: applies the viewer's filter preferences and falls back to "30d"
 * when no range is provided.
 */
export async function handleAdminBundleAnalytics(env: Env, id: number, rangeParam: string | undefined, identity: string): Promise<Response> {
  const range = parseRange(rangeParam, "30d");
  const filters = await resolveClickFilters(env, identity);
  return fromServiceResult(await getBundleAnalytics(env, id, range, identity, { filters }));
}

/**
 * Public API: returns raw click counts (no per-identity filter) and defaults
 * to all-time when no ?range= is provided.
 */
export async function handlePublicBundleAnalytics(env: Env, id: number, rangeParam: string | undefined, identity: string): Promise<Response> {
  const range = parseRange(rangeParam, "all");
  return fromServiceResult(await getBundleAnalytics(env, id, range, identity));
}

export async function handleBundleLinks(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await listBundleLinks(env, id, identity));
}

export async function handleAddLinkToBundle(request: Request, env: Env, bundleId: number, identity: string): Promise<Response> {
  let body: { link_id?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const linkId = Number(body.link_id);
  if (!Number.isInteger(linkId)) return json({ error: "link_id must be an integer" }, 400);
  return fromServiceResult(await addLinkToBundle(env, bundleId, linkId, identity));
}

export async function handleRemoveLinkFromBundle(env: Env, bundleId: number, linkId: number, identity: string): Promise<Response> {
  return fromServiceResult(await removeLinkFromBundle(env, bundleId, linkId, identity));
}

export async function handleListBundlesForLink(env: Env, linkId: number, identity: string): Promise<Response> {
  return fromServiceResult(await listBundlesForLink(env, linkId, identity));
}
