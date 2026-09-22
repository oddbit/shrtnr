// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { createRoute, z } from "@hono/zod-openapi";
import { createApiSubApp } from "./sub-app";
import {
  autoLabelLink,
  createLink,
  disableLink,
  enableLink,
  deleteLink,
  getLink,
  getLinkBySlug,
  listLinks,
  listLinksByOwner,
  updateLink,
  addCustomSlugToLink,
  disableSlug,
  enableSlug,
  removeSlug,
} from "../services/link-management";
import { listBundlesForLink } from "../services/bundle-management";
import { handleLinkQr } from "./qr";
import { handlePublicLinkAnalytics, handlePublicLinkBreakdown, handlePublicLinkTimeline } from "./analytics";
import { fetchPageTitle } from "../title-fetch";
import { fromServiceResult, json } from "./response";
import { requireScope } from "./scope";
import { DEFAULT_QR_SIZE, MAX_QR_SIZE, MIN_QR_SIZE } from "../constants";
import type { Env, TimelineRange, WaitUntilContext } from "../types";
import {
  AddSlugBodySchema,
  BreakdownPageSchema,
  BreakdownQuerySchema,
  BundleSchema,
  ClickStatsSchema,
  CreateLinkBodySchema,
  ErrorResponseSchema,
  IdParamSchema,
  LinkSchema,
  RangeQuerySchema,
  SlugParamSchema,
  SlugSchema,
  TimelineDataSchema,
  UpdateLinkBodySchema,
  paramHook,
} from "./schemas";
export const linksApp = createApiSubApp();

const errorResponses = {
  400: { description: "Validation error.", content: { "application/json": { schema: ErrorResponseSchema } } },
  401: { description: "Missing or invalid bearer token.", content: { "application/json": { schema: ErrorResponseSchema } } },
  403: { description: "Scope insufficient.", content: { "application/json": { schema: ErrorResponseSchema } } },
  404: { description: "Not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
  409: { description: "Conflict.", content: { "application/json": { schema: ErrorResponseSchema } } },
  500: { description: "Server error.", content: { "application/json": { schema: ErrorResponseSchema } } },
};

// ---- Permission responses ----
//
// The owner gate and the zero-click rule live in the service layer
// (src/services/link-management.ts), so the admin UI, this API and the MCP
// tools all meet the same answers. Spelled out per route rather than folded
// into the shared map above, so the generated SDK docs and /_/api/docs carry
// the rule and not just the status code.

/** 403 on an owner-gated route: scope gate first, then the ownership check. */
const forbiddenOwner = {
  description:
    "Refused. Either the key lacks the `create` scope, or the caller is not the link owner. Ownership is fixed at creation and is not transferable: only the identity that created a link can change it. Reading is open to every authenticated key.",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

/** 400 on a delete route, where the click rule is the likely cause. */
const clickRuleDelete = {
  description:
    "Refused. The link has recorded at least one click, so it cannot be deleted: `Cannot delete a link with clicks, disable it instead`. A clicked short link is already in circulation, in email, in print and in QR codes, and deleting it frees the slug for reuse. Call `POST /links/{id}/disable` instead, which stops the redirect and keeps the history. The lifetime count is unfiltered, so a single bot click is enough. Also returned for a malformed request.",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

/** 400 on slug removal: click rule, plus the system-slug rule. */
const clickRuleRemoveSlug = {
  description:
    "Refused. Either the slug has recorded at least one click (`Cannot remove a slug with clicks, disable it instead`), or it is the link's system-generated slug, which can never be removed. Disable the slug instead to stop it resolving while keeping its click history.",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

/** 400 on slug disable: the system slug is not disableable either. */
const systemSlugRule = {
  description:
    "Refused. The system-generated slug cannot be disabled, only custom slugs can. Disable the whole link instead.",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

// ---- POST / (create link) ----

const createLinkRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["links"],
  summary: "Create a short link",
  middleware: [requireScope("create")] as const,
  request: {
    body: { content: { "application/json": { schema: CreateLinkBodySchema } } },
  },
  responses: {
    200: { description: "Existing link returned (duplicate URL).", content: { "application/json": { schema: LinkSchema } } },
    201: { description: "Created.", content: { "application/json": { schema: LinkSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

linksApp.openapi(createLinkRoute, async (c) => {
  const body = c.req.valid("json") as { url: string; label?: string; slug_length?: number; expires_at?: number; allow_duplicate?: boolean };
  const via = c.req.header("X-Client") === "sdk" ? "sdk" : "api";
  const result = await createLink(c.env, { ...body, created_via: via, created_by: c.var.auth.identity });
  if (result.ok && result.status === 201 && !body.label) {
    c.executionCtx.waitUntil(autoLabelLink(c.env.DB, result.data.id, result.data.url, fetchPageTitle));
  }
  return fromServiceResult(result) as never;
});

// ---- GET / (list links) ----

const listLinksQuery = z.object({
  owner: z.string().optional().openapi({ description: "Filter to links created by this owner identity." }),
}).merge(RangeQuerySchema);

const listLinksRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["links"],
  summary: "List all short links",
  middleware: [requireScope("read")] as const,
  request: { query: listLinksQuery },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: z.array(LinkSchema) } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

linksApp.openapi(listLinksRoute, async (c) => {
  const { owner, range } = c.req.valid("query") as { owner?: string; range?: TimelineRange };
  const opts = range ? { range, withDeltaRange: range } : undefined;
  const result = owner ? await listLinksByOwner(c.env, owner, opts) : await listLinks(c.env, opts);
  return fromServiceResult(result) as never;
});

// ---- GET /:id (get link) ----

const getLinkRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["links"],
  summary: "Get a link with click stats",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema, query: RangeQuerySchema },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: LinkSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

linksApp.openapi(getLinkRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { range } = c.req.valid("query") as { range?: TimelineRange };
  return fromServiceResult(await getLink(c.env, id, range ? { range } : undefined)) as never;
}, paramHook);

// ---- PUT /:id (update link) ----

const updateLinkRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["links"],
  summary: "Update a link's URL, label, or expiry",
  description:
    "Owner only. The identity behind the API key must be the link's `created_by`, otherwise the call is refused with 403.",
  middleware: [requireScope("create")] as const,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateLinkBodySchema } } },
  },
  responses: {
    200: { description: "Updated.", content: { "application/json": { schema: LinkSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(updateLinkRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const body = c.req.valid("json") as { url?: string; label?: string | null; expires_at?: number | null };
  return fromServiceResult(await updateLink(c.env, id, body, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/disable ----

const disableLinkRoute = createRoute({
  method: "post",
  path: "/{id}/disable",
  tags: ["links"],
  summary: "Disable a link",
  description:
    "Owner only. Stops every slug on the link from redirecting while keeping the link and its click history. This is the correct operation for a link that is already in circulation, and the only one available once the link has recorded a click.",
  middleware: [requireScope("create")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Disabled.", content: { "application/json": { schema: LinkSchema } } },
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(disableLinkRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await disableLink(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/enable ----

const enableLinkRoute = createRoute({
  method: "post",
  path: "/{id}/enable",
  tags: ["links"],
  summary: "Re-enable a disabled link",
  description: "Owner only. Clears the expiry set by disable so the link resolves again.",
  middleware: [requireScope("create")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Enabled.", content: { "application/json": { schema: LinkSchema } } },
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(enableLinkRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await enableLink(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- DELETE /:id ----

const deleteLinkRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["links"],
  summary: "Delete a link permanently",
  description:
    "Owner only, and only while the link has recorded zero clicks. Once any click exists the link is permanent and this call returns 400; disable it instead. Deleting removes the link, its slugs, and frees those slugs for reuse by anyone.",
  middleware: [requireScope("create")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Deleted.", content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } } },
    400: clickRuleDelete,
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(deleteLinkRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await deleteLink(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/slugs (add custom slug) ----

const addSlugRoute = createRoute({
  method: "post",
  path: "/{id}/slugs",
  tags: ["slugs"],
  summary: "Add a custom slug to a link",
  description:
    "Open to any authenticated caller with the `create` scope, including on a link owned by someone else. Adding a slug creates an additional address for the existing destination; it cannot change, disable or delete anything. Removing or disabling that slug afterwards is owner-gated.",
  middleware: [requireScope("create")] as const,
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: AddSlugBodySchema } } },
  },
  responses: {
    201: { description: "Slug added.", content: { "application/json": { schema: SlugSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

linksApp.openapi(addSlugRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { slug } = c.req.valid("json") as { slug: string };
  return fromServiceResult(await addCustomSlugToLink(c.env, id, { slug })) as never;
}, paramHook);

// ---- Slug-scoped param schema ----

const LinkSlugParamsSchema = IdParamSchema
  .extend({ slug: SlugParamSchema.shape.slug })
  .openapi("LinkSlugParams");

// ---- POST /:id/slugs/:slug/disable ----

const disableSlugRoute = createRoute({
  method: "post",
  path: "/{id}/slugs/{slug}/disable",
  tags: ["slugs"],
  summary: "Disable a specific slug on a link",
  description:
    "Owner of the parent link only. Custom slugs only: the system-generated slug cannot be disabled. The slug stops resolving and keeps its click history.",
  middleware: [requireScope("create")] as const,
  request: { params: LinkSlugParamsSchema },
  responses: {
    200: { description: "Disabled.", content: { "application/json": { schema: SlugSchema } } },
    400: systemSlugRule,
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(disableSlugRoute, async (c) => {
  const { id, slug } = c.req.valid("param") as { id: number; slug: string };
  return fromServiceResult(await disableSlug(c.env, id, slug, c.var.auth.identity)) as never;
}, paramHook);

// ---- POST /:id/slugs/:slug/enable ----

const enableSlugRoute = createRoute({
  method: "post",
  path: "/{id}/slugs/{slug}/enable",
  tags: ["slugs"],
  summary: "Re-enable a disabled slug on a link",
  description: "Owner of the parent link only.",
  middleware: [requireScope("create")] as const,
  request: { params: LinkSlugParamsSchema },
  responses: {
    200: { description: "Enabled.", content: { "application/json": { schema: SlugSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(enableSlugRoute, async (c) => {
  const { id, slug } = c.req.valid("param") as { id: number; slug: string };
  return fromServiceResult(await enableSlug(c.env, id, slug, c.var.auth.identity)) as never;
}, paramHook);

// ---- DELETE /:id/slugs/:slug ----

const removeSlugRoute = createRoute({
  method: "delete",
  path: "/{id}/slugs/{slug}",
  tags: ["slugs"],
  summary: "Remove a custom slug from a link",
  description:
    "Owner of the parent link only, custom slugs only, and only while the slug has recorded zero clicks. Once any click exists the slug is permanent and this call returns 400; disable it instead.",
  middleware: [requireScope("create")] as const,
  request: { params: LinkSlugParamsSchema },
  responses: {
    200: { description: "Removed.", content: { "application/json": { schema: z.object({ removed: z.boolean() }) } } },
    400: clickRuleRemoveSlug,
    401: errorResponses[401],
    403: forbiddenOwner,
    404: errorResponses[404],
  },
});

linksApp.openapi(removeSlugRoute, async (c) => {
  const { id, slug } = c.req.valid("param") as { id: number; slug: string };
  return fromServiceResult(await removeSlug(c.env, id, slug, c.var.auth.identity)) as never;
}, paramHook);

// ---- GET /:id/qr ----

const linkQrRoute = createRoute({
  method: "get",
  path: "/{id}/qr",
  tags: ["qr"],
  summary: "Get a QR code SVG for a link",
  middleware: [requireScope("read")] as const,
  request: {
    params: IdParamSchema,
    query: z.object({
      slug: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()
        .openapi({ description: "Optional specific slug. Defaults to the link's primary slug." }),
      size: z.coerce.number().int().min(MIN_QR_SIZE).max(MAX_QR_SIZE).optional()
        .openapi({ description: `QR pixel dimensions (square). Integer ${MIN_QR_SIZE}-${MAX_QR_SIZE}; defaults to ${DEFAULT_QR_SIZE}.` }),
    }),
  },
  responses: {
    200: {
      description: "SVG image",
      content: { "image/svg+xml": { schema: z.string() } },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

linksApp.openapi(linkQrRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return (await handleLinkQr(c.req.raw, c.env, id)) as never;
}, paramHook);

// ---- GET /:id/bundles (list bundles a link belongs to) ----

const listLinkBundlesRoute = createRoute({
  method: "get",
  path: "/{id}/bundles",
  tags: ["links", "bundles"],
  summary: "List bundles a link belongs to",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: z.array(BundleSchema) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

linksApp.openapi(listLinkBundlesRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  return fromServiceResult(await listBundlesForLink(c.env, id, c.var.auth.identity)) as never;
}, paramHook);

// ---- GET /:id/analytics ----

const linkAnalyticsRoute = createRoute({
  method: "get",
  path: "/{id}/analytics",
  tags: ["links", "analytics"],
  summary: "Get analytics for a link (defaults to all-time)",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema, query: RangeQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: ClickStatsSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

linksApp.openapi(linkAnalyticsRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { range } = c.req.valid("query") as { range?: string };
  return (await handlePublicLinkAnalytics(c.env, id, range)) as never;
}, paramHook);

// ---- GET /:id/timeline ----

const linkTimelineRoute = createRoute({
  method: "get",
  path: "/{id}/timeline",
  tags: ["links", "analytics"],
  summary: "Get click timeline for a link (defaults to all-time)",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema, query: RangeQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: TimelineDataSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

linksApp.openapi(linkTimelineRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { range } = c.req.valid("query") as { range?: string };
  return (await handlePublicLinkTimeline(c.env, id, range)) as never;
}, paramHook);

// ---- GET /:id/breakdown ----

const linkBreakdownRoute = createRoute({
  method: "get",
  path: "/{id}/breakdown",
  tags: ["links", "analytics"],
  summary: "Page through a link's countries, sources, or domains breakdown",
  middleware: [requireScope("read")] as const,
  request: { params: IdParamSchema, query: BreakdownQuerySchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: BreakdownPageSchema } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

linksApp.openapi(linkBreakdownRoute, async (c) => {
  const { id } = c.req.valid("param") as { id: number };
  const { dimension, range, offset, limit } = c.req.valid("query") as {
    dimension: string; range?: string; offset?: number; limit?: number;
  };
  return (await handlePublicLinkBreakdown(c.env, id, { dimension, range, offset, limit })) as never;
}, paramHook);

// ---- Named exports consumed by admin routes in index.tsx (pending migration in later tasks) ----

export async function handleGetLinkBySlug(env: Env, slug: string): Promise<Response> {
  return fromServiceResult(await getLinkBySlug(env, slug.toLowerCase()));
}

export async function handleListLinks(env: Env, owner?: string): Promise<Response> {
  if (owner) return fromServiceResult(await listLinksByOwner(env, owner));
  return fromServiceResult(await listLinks(env));
}

export async function handleGetLink(env: Env, id: number): Promise<Response> {
  return fromServiceResult(await getLink(env, id));
}

export async function handleCreateLink(request: Request, env: Env, createdVia?: string, createdBy?: string, ctx?: WaitUntilContext): Promise<Response> {
  let body: {
    url?: string;
    label?: string;
    slug_length?: number;
    expires_at?: number;
    allow_duplicate?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const result = await createLink(env, { ...body, created_via: createdVia, created_by: createdBy });

  if (result.ok && result.status === 201 && !body.label && ctx) {
    ctx.waitUntil(autoLabelLink(env.DB, result.data.id, result.data.url, fetchPageTitle));
  }

  return fromServiceResult(result);
}

export async function handleUpdateLink(request: Request, env: Env, id: number, identity: string): Promise<Response> {
  let body: { url?: string; label?: string | null; expires_at?: number | null };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await updateLink(env, id, body, identity));
}

export async function handleDisableLink(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await disableLink(env, id, identity));
}

export async function handleEnableLink(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await enableLink(env, id, identity));
}

export async function handleDeleteLink(env: Env, id: number, identity: string): Promise<Response> {
  return fromServiceResult(await deleteLink(env, id, identity));
}
