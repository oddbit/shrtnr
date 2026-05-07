// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env, TimelineRange, BundleWithSummary } from "../types";
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
import { createRoute, z } from "@hono/zod-openapi";
import { createApiSubApp } from "./sub-app";
import { requireScope } from "./scope";
import {
  AddBundleLinkBodySchema,
  ArchivedQuerySchema,
  BundleSchema,
  BundleWithSummarySchema,
  ClickStatsSchema,
  CreateBundleBodySchema,
  ErrorResponseSchema,
  IdParamSchema,
  LinkSchema,
  RangeQuerySchema,
  TIMELINE_RANGES,
  UpdateBundleBodySchema,
  paramHook,
} from "./schemas";
const VALID_RANGES = new Set<TimelineRange>(TIMELINE_RANGES);

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

// ---- OpenAPI sub-app for /_/api/bundles/* ----

export const bundlesApp = createApiSubApp();

const errorResponses = {
  400: { description: "Validation error.", content: { "application/json": { schema: ErrorResponseSchema } } },
  401: { description: "Missing or invalid bearer token.", content: { "application/json": { schema: ErrorResponseSchema } } },
  403: { description: "Scope insufficient.", content: { "application/json": { schema: ErrorResponseSchema } } },
  404: { description: "Not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
};

// ---- GET / (list bundles) ----

const listBundlesQuery = ArchivedQuerySchema.merge(RangeQuerySchema);

const listBundlesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["bundles"],
  summary: "List bundles",
  middleware: [requireScope("read")] as const,
  request: { query: listBundlesQuery },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: z.array(BundleWithSummarySchema) } } },
    400: { description: "Validation error.", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

bundlesApp.openapi(listBundlesRoute, async (c) => {
  const { archived, range } = c.req.valid("query") as { archived?: "true" | "1" | "only" | "all"; range?: TimelineRange };
  const filter = parseArchivedFilter(archived);
  return fromServiceResult(await listBundles(c.env, c.var.auth.identity, { ...filter, range })) as never;
});

// ---- POST / (create bundle) ----

const createBundleRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["bundles"],
  summary: "Create a bundle",
  middleware: [requireScope("create")] as const,
  request: { body: { content: { "application/json": { schema: CreateBundleBodySchema } } } },
  responses: {
    201: { description: "Created.", content: { "application/json": { schema: BundleSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

bundlesApp.openapi(createBundleRoute, async (c) => {
  const body = c.req.valid("json") as { name: string; description?: string | null; icon?: string | null; accent?: "orange" | "red" | "green" | "blue" | "purple" };
  const via = c.req.header("X-Client") === "sdk" ? "sdk" : "api";
  return fromServiceResult(await createBundle(c.env, body, c.var.auth.identity, via)) as never;
});

// ---- GET /:id (get bundle) ----

const getBundleRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["bundles"],
  summary: "Get a bundle",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema, query: RangeQuerySchema },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: BundleWithSummarySchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(getBundleRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { range } = c.req.valid("query") as { range?: TimelineRange };
  return fromServiceResult(await getBundle(c.env, id, c.var.auth.identity, { range: range ?? "all" })) as never;
}, paramHook);

// ---- PUT /:id (update bundle) ----

const updateBundleRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["bundles"],
  summary: "Update a bundle",
  middleware: [requireScope("create")] as const,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateBundleBodySchema } } },
  },
  responses: {
    200: { description: "Updated.", content: { "application/json": { schema: BundleSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(updateBundleRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const body = c.req.valid("json") as { name?: string; description?: string | null; icon?: string | null; accent?: "orange" | "red" | "green" | "blue" | "purple" };
  return fromServiceResult(await updateBundle(c.env, id, body, c.var.auth.identity)) as never;
}, paramHook);

// ---- DELETE /:id ----

const deleteBundleRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["bundles"],
  summary: "Delete a bundle permanently",
  middleware: [requireScope("create")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Deleted.", content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(deleteBundleRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await deleteBundle(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/archive ----

const archiveBundleRoute = createRoute({
  method: "post",
  path: "/{id}/archive",
  tags: ["bundles"],
  summary: "Archive a bundle",
  middleware: [requireScope("create")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Archived.", content: { "application/json": { schema: BundleSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(archiveBundleRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await archiveBundle(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/unarchive ----

const unarchiveBundleRoute = createRoute({
  method: "post",
  path: "/{id}/unarchive",
  tags: ["bundles"],
  summary: "Unarchive a bundle",
  middleware: [requireScope("create")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Unarchived.", content: { "application/json": { schema: BundleSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(unarchiveBundleRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await unarchiveBundle(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- GET /:id/analytics (public defaults to all-time) ----

const bundleAnalyticsRoute = createRoute({
  method: "get",
  path: "/{id}/analytics",
  tags: ["bundles"],
  summary: "Get bundle analytics. Defaults to all-time if no range given.",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema, query: RangeQuerySchema },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: ClickStatsSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(bundleAnalyticsRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { range: rawRange } = c.req.valid("query") as { range?: TimelineRange };
  const range = parseRange(rawRange, "all");
  return fromServiceResult(await getBundleAnalytics(c.env, id, range, c.var.auth.identity)) as never;
}, paramHook);

// ---- GET /:id/links (list links in bundle) ----

const listBundleLinksRoute = createRoute({
  method: "get",
  path: "/{id}/links",
  tags: ["bundles"],
  summary: "List links in a bundle",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: z.array(LinkSchema) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(listBundleLinksRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await listBundleLinks(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/links (add link to bundle) ----

const addLinkToBundleRoute = createRoute({
  method: "post",
  path: "/{id}/links",
  tags: ["bundles"],
  summary: "Add a link to a bundle",
  middleware: [requireScope("create")] as const,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: AddBundleLinkBodySchema } } },
  },
  responses: {
    200: { description: "Added.", content: { "application/json": { schema: z.object({ added: z.boolean() }) } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(addLinkToBundleRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { link_id } = c.req.valid("json") as { link_id: number };
  return fromServiceResult(await addLinkToBundle(c.env, id, link_id, c.var.auth.identity)) as never;
}, paramHook);

// ---- DELETE /:id/links/:linkId ----

const BundleLinkParamsSchema = IdParamSchema
  .extend({ linkId: z.coerce.number().int().positive().openapi({ param: { name: "linkId", in: "path" }, example: 17 }) })
  .openapi("BundleLinkParams");

const removeLinkFromBundleRoute = createRoute({
  method: "delete",
  path: "/{id}/links/{linkId}",
  tags: ["bundles"],
  summary: "Remove a link from a bundle",
  middleware: [requireScope("create")] as const,
  request: { params: BundleLinkParamsSchema },
  responses: {
    200: { description: "Removed.", content: { "application/json": { schema: z.object({ removed: z.boolean() }) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

bundlesApp.openapi(removeLinkFromBundleRoute, async (c) => {
  const { id, linkId } = c.req.valid("param") as { id: number; linkId: number };
  return fromServiceResult(await removeLinkFromBundle(c.env, id, linkId, c.var.auth.identity)) as never;
}, paramHook);
