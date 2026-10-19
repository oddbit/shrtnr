// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { z } from "zod";

export type { ServiceResult } from "../services/result";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function fromServiceResult<T>(result: import("../services/result").ServiceResult<T>): Response {
  if (!result.ok) return json({ error: result.error }, result.status);
  if (result.meta && typeof result.data === "object" && result.data !== null) {
    return json({ ...result.data, ...result.meta }, result.status);
  }
  return json(result.data, result.status);
}

/**
 * A link response carrying the origin this deployment hands short URLs out on.
 *
 * The origin is per request, not per row: it is the deployment's SHORT_ORIGIN
 * when one is set, and the request's own origin otherwise. A client that
 * composes `${origin}/${slug}` itself has no other way to learn it, and a
 * client that assumes the host it reached the API on hands out the wrong URL on
 * a deployment that answers on several domains. List endpoints answer with the
 * link objects bare, so arrays are annotated item by item.
 */
export function fromLinkResult(result: import("../services/result").ServiceResult<unknown>, origin: string): Response {
  if (!result.ok) return fromServiceResult(result);
  const annotate = (value: unknown) =>
    typeof value === "object" && value !== null ? { ...value, short_origin: origin } : value;
  const data = Array.isArray(result.data) ? result.data.map(annotate) : annotate(result.data);
  return fromServiceResult({ ...result, data });
}

export function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "Invalid request";
  if (first.code === "unrecognized_keys") {
    return first.keys.length > 0 ? `Unknown field "${first.keys[0]}"` : "Unknown field";
  }
  const path = first.path.length > 0 ? first.path.join(".") : "request";
  return `${path}: ${first.message}`;
}
