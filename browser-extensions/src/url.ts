// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// URL helpers shared by the popup and the options form. Both render a
// deployment or destination host next to a URL, so the parsing rule lives
// here rather than once per page.

/**
 * Host of a URL, for display next to the URL itself. A value that does not
 * parse is returned unchanged: the caller is labelling, not validating, and
 * showing the raw string beats showing an empty slot.
 */
export function hostFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
