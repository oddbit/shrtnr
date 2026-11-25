// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Read one cookie off the raw request. Returns null when it is absent.
 *
 * The value is whatever the browser holds, so one that is not valid
 * percent-encoding counts as absent instead of failing the request. A header
 * can carry the same name twice (a parent-domain cookie beside the host's
 * own): the first value that decodes wins.
 */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1 || pair.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(eq + 1).trim());
    } catch {
      // Try the next cookie of this name.
    }
  }
  return null;
}
