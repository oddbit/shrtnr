// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { createRoute } from "@hono/zod-openapi";
import { createApiSubApp } from "./sub-app";
import { Env } from "../types";
import {
  addCustomSlugToLink,
  setSlugPrimary,
  disableSlug,
  enableSlug,
  removeSlug,
  getLinkBySlug,
} from "../services/link-management";
import { json, fromServiceResult } from "./response";
import { requireScope } from "./scope";
import { ErrorResponseSchema, LinkSchema, SlugParamSchema, paramHook } from "./schemas";
// ---- Legacy admin handlers (still consumed by admin routes in src/index.tsx) ----

export async function handleAddCustomSlug(
  request: Request,
  env: Env,
  linkId: number
): Promise<Response> {
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await addCustomSlugToLink(env, linkId, body));
}


export async function handleSetPrimarySlug(
  request: Request,
  env: Env,
  linkId: number,
  identity: string,
): Promise<Response> {
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.slug) return json({ error: "slug is required" }, 400);
  return fromServiceResult(await setSlugPrimary(env, linkId, body.slug, identity));
}

export async function handleDisableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<Response> {
  return fromServiceResult(await disableSlug(env, linkId, slug, identity));
}

export async function handleEnableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<Response> {
  return fromServiceResult(await enableSlug(env, linkId, slug, identity));
}

export async function handleRemoveSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<Response> {
  return fromServiceResult(await removeSlug(env, linkId, slug, identity));
}

// ---- OpenAPI sub-app ----

export const slugsApp = createApiSubApp();

const errorResponses = {
  401: { description: "Missing or invalid bearer token.", content: { "application/json": { schema: ErrorResponseSchema } } },
  403: { description: "Scope insufficient.", content: { "application/json": { schema: ErrorResponseSchema } } },
  404: { description: "Slug not found.", content: { "application/json": { schema: ErrorResponseSchema } } },
  500: { description: "Server error.", content: { "application/json": { schema: ErrorResponseSchema } } },
};

const getLinkBySlugRoute = createRoute({
  method: "get",
  path: "/{slug}",
  tags: ["slugs"],
  summary: "Look up a link by its slug",
  middleware: [requireScope("read")] as const,
  request: { params: SlugParamSchema },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: LinkSchema } } },
    ...errorResponses,
  },
});

slugsApp.openapi(getLinkBySlugRoute, async (c) => {
  const { slug } = c.req.valid("param") as { slug: string };
  return fromServiceResult(await getLinkBySlug(c.env, slug.toLowerCase())) as never;
}, paramHook);
