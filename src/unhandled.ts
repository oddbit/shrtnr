// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Last-resort handling for an exception nothing else caught.
 *
 * Workers Logs index one JSON object per line, so the log entry is a single
 * structured object rather than a message string: the path, method and
 * error message become filterable fields in the dashboard. The response
 * never echoes the error: API callers get the JSON shape the SDKs parse,
 * everyone else a plain-text 500.
 *
 * Which callers are API callers is the router's knowledge, not this
 * module's. A route group that answers JSON declares it where it is mounted
 * (`app.use(prefix, answersJson)`), and the error handler reads that
 * declaration off the context. Only a request no route claimed falls back
 * to the Accept header.
 */

import type { ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "./api/hono-env";

export type ErrorFormat = "json" | "text";

/** Declares, beside a route mount, that an unhandled exception on those routes answers JSON. */
export const answersJson: MiddlewareHandler<HonoEnv> = async (c, next) => {
  c.set("errorFormat", "json");
  await next();
};

export function logUnhandledError(err: unknown, request: Request): void {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      message: "unhandled error",
      method: request.method,
      path: new URL(request.url).pathname,
      error: error.message,
      name: error.name,
      stack: error.stack,
    }),
  );
}

/** For a request no route claimed, only the Accept header can say what the client parses. */
export function negotiatedErrorFormat(request: Request): ErrorFormat {
  const accept = request.headers.get("Accept") ?? "";
  return accept.includes("application/json") ? "json" : "text";
}

/** The 500 body in the given format. Never carries the error text. */
export function unhandledErrorResponse(format: ErrorFormat): Response {
  const headers = { "Cache-Control": "no-store" };
  if (format === "json") {
    return Response.json({ error: "Internal server error" }, { status: 500, headers });
  }
  return new Response("Internal server error", {
    status: 500,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Hono's error handler. Hono's default prints the error unstructured and
 * answers text/plain, so an API client saw a body its SDK could not parse
 * and the dashboard saw a log line it could not filter. An HTTPException
 * carries its own response.
 */
export const onUnhandledError: ErrorHandler<HonoEnv> = (err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  logUnhandledError(err, c.req.raw);
  return unhandledErrorResponse(c.get("errorFormat") ?? negotiatedErrorFormat(c.req.raw));
};
