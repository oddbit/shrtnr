// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { makeQR, renderQrSvg } from "../../qr";

function extractSvgWidth(svg: string): number {
  const m = svg.match(/width="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}

describe("renderQrSvg", () => {
  it("respects the size option: larger size produces larger SVG", () => {
    const svg200 = renderQrSvg("https://example.com", { size: 200 });
    const svg400 = renderQrSvg("https://example.com", { size: 400 });
    expect(svg200).not.toBeNull();
    expect(svg400).not.toBeNull();
    expect(extractSvgWidth(svg200!)).toBeCloseTo(200, 0);
    expect(extractSvgWidth(svg400!)).toBeCloseTo(400, 0);
  });

  it("uses 220 as default size when no size provided", () => {
    const svg = renderQrSvg("https://example.com");
    expect(svg).not.toBeNull();
    expect(extractSvgWidth(svg!)).toBeCloseTo(220, 0);
  });
});

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
