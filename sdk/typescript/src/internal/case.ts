// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/** Convert a snake_case string to camelCase.
 *
 * Handles digit segments too: last_24h -> last24h, last_7d -> last7d.
 */
export function toCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => (/[a-z]/.test(c) ? c.toUpperCase() : c));
}

/** Convert a camelCase string to snake_case. */
export function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

/** Recursively transform all object keys from snake_case to camelCase. */
export function keysToCamel(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(keysToCamel);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toCamel(k)] = keysToCamel(v);
    }
    return out;
  }
  return value;
}

/** Recursively transform all object keys from camelCase to snake_case. */
export function keysToSnake(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(keysToSnake);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toSnake(k)] = keysToSnake(v);
    }
    return out;
  }
  return value;
}
