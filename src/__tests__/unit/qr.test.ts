// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { makeQR } from "../../qr";

describe("makeQR", () => {
  it("returns a non-empty square boolean matrix for short input", () => {
    const grid = makeQR("hello");
    expect(grid).not.toBeNull();
    expect(grid!.length).toBeGreaterThan(0);
    expect(grid![0].length).toBe(grid!.length);
  });

  it("matrix entries are all booleans", () => {
    const grid = makeQR("test")!;
    for (const row of grid) {
      for (const cell of row) {
        expect(typeof cell).toBe("boolean");
      }
    }
  });

  it("returns null when input exceeds version-10 capacity (>271 bytes)", () => {
    const tooLong = "x".repeat(300);
    expect(makeQR(tooLong)).toBeNull();
  });
});
