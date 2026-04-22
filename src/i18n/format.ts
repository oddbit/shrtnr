// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

const numberFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Locale-aware integer formatting with thousands separators.
 * Workers' default `toLocaleString()` ignores the user's language and always
 * produces en-US style (1,234,567), so every display of a count goes through
 * this helper to match the UI language (sv: "1 234 567", id: "1.234.567").
 */
export function fmtNumber(n: number, lang: string): string {
  let f = numberFormatters.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(lang);
    numberFormatters.set(lang, f);
  }
  return f.format(n);
}
