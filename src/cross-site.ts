// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Cross-site request forgery guard for routes that authenticate with a cookie.
 *
 * The admin API takes its identity from the Access session cookie, and a
 * browser attaches that cookie to a request any page triggers, whichever site
 * the page lives on. Disable, enable and archive need no body, and the JSON
 * routes read a body whatever its Content-Type, so a cross-site form reaches
 * them without a preflight. Whether the cookie rides along depends on its
 * SameSite attribute, which is an Access application setting the Worker
 * cannot see, so the Worker checks the request itself.
 *
 * Browsers label every such request: `Origin` on any non-GET fetch or form
 * post, and `Sec-Fetch-Site` on every request. A caller that sends neither is
 * not a browser (curl, a test, a script holding its own token) and has no
 * ambient cookie to abuse, so it passes.
 *
 * The public API under /_/api is not guarded: a bearer key is sent on purpose,
 * never by the browser on its own.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Whether a browser marked this state-changing request as coming from another origin. */
export function isCrossOriginWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;

  const origin = request.headers.get("Origin");
  if (origin !== null) {
    try {
      // Compared as parsed origins, so host case and a default port do not
      // matter. "null" (a sandboxed frame, a data: URL) does not parse.
      return new URL(origin).origin !== new URL(request.url).origin;
    } catch {
      return true;
    }
  }

  // No Origin: fall back to the fetch metadata. "none" is a request the user
  // made directly (address bar, bookmark), which no other site can forge.
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null) return site !== "same-origin" && site !== "none";

  return false;
}

export function crossOriginRefusedResponse(): Response {
  return Response.json(
    { error: "Cross-origin request refused: send admin API writes from the admin's own origin" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
