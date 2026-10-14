// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { createRoute } from "@hono/zod-openapi";
import { createApiSubApp } from "./sub-app";
import { ConfigSchema, ErrorResponseSchema } from "./schemas";
import { json } from "./response";
import { requireScope } from "./scope";
import { resolveShortOrigin } from "../short-origin";

/**
 * Deployment settings a client needs in order to build a short URL.
 *
 * A client that composes `${baseUrl}/${slug}` itself has no other way to learn
 * which origin the deployment hands links out on, so on a deployment that
 * answers on several domains it builds URLs on whichever host it was
 * configured with while the copy button, the QR code and the redirects use
 * SHORT_ORIGIN. Link responses carry the same value per link; this endpoint
 * answers it once, for a client that needs it before it holds a link.
 */
export const configApp = createApiSubApp();

const errorResponses = {
  401: { description: "Missing or invalid bearer token.", content: { "application/json": { schema: ErrorResponseSchema } } },
  403: { description: "Scope insufficient.", content: { "application/json": { schema: ErrorResponseSchema } } },
  500: { description: "Server error.", content: { "application/json": { schema: ErrorResponseSchema } } },
};

const getConfigRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["config"],
  summary: "Read the origin short URLs are handed out on",
  description:
    "The deployment's `SHORT_ORIGIN` when one is set, otherwise the origin of the request. Build short URLs as `${short_origin}/${slug}` so they match the copy button, the QR code and the redirects on a deployment that answers on several domains.",
  middleware: [requireScope("read")] as const,
  responses: {
    200: { description: "OK.", content: { "application/json": { schema: ConfigSchema } } },
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

configApp.openapi(getConfigRoute, async (c) => {
  return json({ short_origin: resolveShortOrigin(c.env, c.req.url) }) as never;
});
