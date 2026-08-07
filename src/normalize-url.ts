// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Strips trailing characters that serve no purpose from a URL:
 * trailing `/`, an empty `#` (no anchor), and an empty `?` (no parameters).
 *
 * The redundant characters are only stripped when they carry no content: a `/`,
 * `?`, or `#` that is part of a query value or fragment is preserved. So
 * `https://example.com/search?q=cats/` keeps its trailing slash, and
 * `https://example.com/#/spa/route/` keeps its hash-router path intact.
 */
export function normalizeUrl(url: string): string {
  let result = url;
  // Drop an empty trailing fragment ("...#") then an empty trailing query
  // ("...?"). Order matters: "path/?#" collapses to "path/" before the slash
  // strip below can run.
  if (result.endsWith("#")) result = result.slice(0, -1);
  // A trailing "?" only denotes an empty query string when a "#" hasn't
  // already opened a fragment: once a fragment is present, a "?" at the end
  // is fragment content (e.g. "#section?"), not a query separator, and must
  // be preserved.
  if (result.endsWith("?") && !result.includes("#")) result = result.slice(0, -1);
  // Trailing path slashes are redundant only when no query or fragment
  // follows; a slash inside a query value or fragment is meaningful.
  if (!result.includes("?") && !result.includes("#")) {
    result = result.replace(/\/+$/, "");
  }
  return result;
}
