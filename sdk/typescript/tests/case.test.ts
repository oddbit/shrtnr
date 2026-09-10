// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { keysToSnake } from "../src/internal/case";

// Regression: assigning through `out["__proto__"] = v` on a plain `{}`
// target doesn't create an own property — it reassigns the object's
// prototype, because `{}` inherits the `__proto__` accessor from
// Object.prototype. A source object built from JSON.parse (unlike an
// object literal) can carry `__proto__` as a real own enumerable
// property, so a request body assembled from untrusted/dynamic JSON with
// that key silently lost it with no error. Object.create(null) has no
// such accessor to intercept the assignment.
//
// keysToCamel does not need the equivalent case here: its camelCase
// transform never maps a source key to the literal string "__proto__"
// (toCamel("__proto__") produces "_Proto__"), so the wire-response path
// cannot collide with the setter. It still uses the same null-prototype
// target as keysToSnake for symmetry and defense in depth.
describe("keysToSnake: __proto__ key handling", () => {
  it("preserves a literal __proto__ own property instead of silently dropping it", () => {
    const input = JSON.parse('{"url":"https://good.example.com","__proto__":{"label":"x"}}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(input)).toContain("__proto__");

    const out = keysToSnake(input) as Record<string, unknown>;
    expect(Object.keys(out)).toContain("__proto__");
    expect(out["__proto__"]).toEqual({ label: "x" });
    expect(out["url"]).toBe("https://good.example.com");
    // The conversion must not have polluted the *actual* prototype chain.
    expect(Object.getPrototypeOf(out)).not.toBe(input["__proto__"]);
  });
});
