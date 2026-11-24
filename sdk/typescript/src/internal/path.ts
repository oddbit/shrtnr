// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { ShrtnrError } from "../errors";

/**
 * A slug as one URL path segment.
 *
 * Percent-encoding keeps a slug with reserved characters inside its segment,
 * but it leaves "." untouched, and every URL parser collapses a "." or ".."
 * segment before the request is sent: `/links/5/slugs/../disable` becomes
 * `/links/5/disable`, which disables the whole link. An empty slug drops the
 * segment the same way. None of the three can name a slug, so they raise the
 * 404 the server answers for any slug that fails its path pattern, without a
 * request.
 */
export function slugSegment(slug: string): string {
  if (slug === "" || slug === "." || slug === "..") {
    throw new ShrtnrError(404, `Slug not found: ${JSON.stringify(slug)} is not a valid slug`);
  }
  return encodeURIComponent(slug);
}
