// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Fixed set of access methods that should always render, even with zero
 * counts, so the UI consistently shows the full, bounded set of choices.
 */
export const ACCESS_METHOD_OPTIONS = ["link", "qr"] as const;

type NamedCount = { name: string; count: number };

/**
 * Returns a copy of `items` extended with zero-count entries for any name in
 * `alwaysOn` that is not already present. Existing order is preserved and the
 * missing names are appended at the end in the order given.
 */
export function fillMissingOptions<T extends NamedCount>(
  items: T[],
  alwaysOn: readonly string[],
): NamedCount[] {
  const seen = new Set(items.map((i) => i.name));
  const out: NamedCount[] = items.slice();
  for (const name of alwaysOn) {
    if (!seen.has(name)) out.push({ name, count: 0 });
  }
  return out;
}
