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

  it("returns null for non-positive or non-integer sizes", () => {
    expect(renderQrSvg("https://example.com", { size: 0 })).toBeNull();
    expect(renderQrSvg("https://example.com", { size: -5 })).toBeNull();
    expect(renderQrSvg("https://example.com", { size: 1.5 })).toBeNull();
    expect(renderQrSvg("https://example.com", { size: NaN })).toBeNull();
  });

  it("returns null for sizes above MAX_QR_SIZE (2048)", () => {
    expect(renderQrSvg("https://example.com", { size: 2049 })).toBeNull();
    expect(renderQrSvg("https://example.com", { size: 100000 })).toBeNull();
  });

  it("accepts size = 1 (smallest valid)", () => {
    const svg = renderQrSvg("https://example.com", { size: 1 });
    expect(svg).not.toBeNull();
    expect(extractSvgWidth(svg!)).toBeCloseTo(1, 0);
  });

  it("accepts size = 2048 (largest valid)", () => {
    const svg = renderQrSvg("https://example.com", { size: 2048 });
    expect(svg).not.toBeNull();
    expect(extractSvgWidth(svg!)).toBeCloseTo(2048, 0);
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

// Scannability: a real decoder (jsQR) must read back what makeQR() wrote.
// The rendering assertions above cannot see a broken error-correction
// layout or a missing version-info block; a decoder can.
import jsQR from "jsqr";

function rasterize(matrix: boolean[][], scale = 4, quiet = 4): { data: Uint8ClampedArray; width: number } {
  const modules = matrix.length + quiet * 2;
  const width = modules * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (!matrix[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = (c + quiet) * scale + dx;
          const y = (r + quiet) * scale + dy;
          const i = (y * width + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width };
}

function decode(matrix: boolean[][]): string | null {
  const { data, width } = rasterize(matrix);
  return jsQR(data, width, width)?.data ?? null;
}

// Byte-mode capacity at error-correction level L, indexed by version.
const CAPACITY_L = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];

describe("makeQR scannability", () => {
  for (let ver = 1; ver <= 10; ver++) {
    it(`version ${ver}: a payload filling the version decodes back to the same text`, () => {
      const prefix = "https://s.ex/";
      const text = prefix + "a".repeat(CAPACITY_L[ver] - prefix.length);
      const grid = makeQR(text);
      expect(grid).not.toBeNull();
      expect(grid!.length).toBe(ver * 4 + 17);
      expect(decode(grid!)).toBe(text);
    });
  }

  it("decodes a realistic short link with utm_medium=qr", () => {
    const text = "https://s.example/very-long-custom-slug-for-a-marketing-campaign?utm_medium=qr";
    expect(decode(makeQR(text)!)).toBe(text);
  });

  it("encodes exactly 271 bytes (version 10 capacity) and refuses 272", () => {
    expect(makeQR("x".repeat(271))).not.toBeNull();
    expect(makeQR("x".repeat(272))).toBeNull();
  });
});

describe("makeQR version information", () => {
  // 18-bit version information (6 data bits + 12 BCH bits), ISO/IEC 18004 Table D.1.
  const VERSION_INFO: Record<number, number> = {
    7: 0x07c94,
    8: 0x085bc,
    9: 0x09a99,
    10: 0x0a4d3,
  };

  function readVersionInfo(grid: boolean[][]): { topRight: number; bottomLeft: number } {
    const size = grid.length;
    let topRight = 0;
    let bottomLeft = 0;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      if (grid[b][a]) topRight |= 1 << i;
      if (grid[a][b]) bottomLeft |= 1 << i;
    }
    return { topRight, bottomLeft };
  }

  for (const ver of [7, 8, 9, 10]) {
    it(`version ${ver}: both version-info blocks carry the BCH-encoded version`, () => {
      const grid = makeQR("x".repeat(CAPACITY_L[ver - 1] + 1))!;
      expect(grid.length).toBe(ver * 4 + 17);
      const { topRight, bottomLeft } = readVersionInfo(grid);
      expect(topRight).toBe(VERSION_INFO[ver]);
      expect(bottomLeft).toBe(VERSION_INFO[ver]);
    });
  }
});
