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
 */

const API_PREFIXES = ["/_/api/", "/_/admin/api/", "/_/admin/w/"];

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

/** JSON for API routes and JSON-accepting clients, plain text for pages and everything else. */
export function unhandledErrorResponse(request: Request): Response {
  const path = new URL(request.url).pathname;
  const accept = request.headers.get("Accept") ?? "";
  const wantsJson = API_PREFIXES.some((p) => path.startsWith(p)) || accept.includes("application/json");
  const headers = { "Cache-Control": "no-store" };
  if (wantsJson) {
    return Response.json({ error: "Internal server error" }, { status: 500, headers });
  }
  return new Response("Internal server error", {
    status: 500,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}
