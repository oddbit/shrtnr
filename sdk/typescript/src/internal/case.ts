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

/** True for plain `{}`/`Object.create(null)` objects, false for Date, Map, and other class instances. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Recursively transform all object keys from snake_case to camelCase. */
export function keysToCamel(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(keysToCamel);
  }
  if (isPlainObject(value)) {
    // Object.create(null) rather than `{}`: assigning through `out["__proto__"]
    // = v` on a `{}` (which inherits Object.prototype's `__proto__` accessor)
    // sets the object's prototype instead of creating an own property, so a
    // source key literally named `__proto__` silently vanished from the
    // output. A null-prototype target has no such accessor to intercept it.
    const out: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
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
  if (isPlainObject(value)) {
    // See keysToCamel: a null-prototype target avoids silently dropping a
    // `__proto__` key.
    const out: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      out[toSnake(k)] = keysToSnake(v);
    }
    return out;
  }
  return value;
}
