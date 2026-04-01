// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Resolve an ISO 3166-1 alpha-2 country code to its localized display name.
 * Falls back to the raw code when the runtime cannot resolve it.
 */
export function countryName(code: string, lang: string): string {
  try {
    const names = new Intl.DisplayNames([lang], { type: "region" });
    return names.of(code) || code;
  } catch {
    return code;
  }
}
