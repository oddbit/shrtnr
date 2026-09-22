// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * /_/setup: the schema diagnostic.
 *
 * GET says what is recorded against what this build bundles and changes
 * nothing. POST forgets the isolate's memo and migrates again, the manual
 * retry for a deploy whose first request hit a transient error. Neither is
 * the mechanism that creates the schema; the Worker does that on its own on
 * the first request (src/db/migrate.ts). Both are idempotent and never drop
 * or rewrite data, so exposure before Access is configured costs a schema
 * listing, and a fixed-window rate limit keeps that cheap to serve.
 */

import type { Env } from "../types";
import { verifyAccessJwt } from "../access";
import { unauthorizedResponse } from "../auth";
import { retrySchema, schemaStatus } from "../db/migrate";
import { checkRateLimit, clientKey, rateLimitedResponse } from "../rate-limit";
import { SCHEMA_DOCS_URL } from "../schema-guard";

const LIMIT = 10;
const PERIOD_SECONDS = 60;

export async function handleSetup(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  }

  const limit = checkRateLimit(`setup:${clientKey(request)}`, LIMIT, PERIOD_SECONDS);
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfter);

  // Same gate as the admin pages: with Access configured, only a verified
  // identity gets an answer. Without it there is no identity to check.
  if (env.ACCESS_AUD) {
    const user = await verifyAccessJwt(request, env);
    if (!user) return unauthorizedResponse();
  }

  const headers = { "Cache-Control": "no-store" };

  if (request.method === "POST") {
    try {
      await retrySchema(env);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const status = await schemaStatus(env).catch(() => null);
      return Response.json({ error: reason, docs: SCHEMA_DOCS_URL, ...(status ?? {}) }, { status: 503, headers });
    }
  }

  return Response.json(await schemaStatus(env), { headers });
}
