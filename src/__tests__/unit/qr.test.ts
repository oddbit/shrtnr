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
  // Literal module pictures, not a re-run of the writer's index arithmetic.
  // Recomputing `size - 11 + (i % 3)` and `floor(i / 3)` in the reader would
  // assert the writer against itself: transpose the two blocks or shift them
  // by a module and the values still match. jsQR cannot close the gap either,
  // since it derives the version from the symbol's dimension and only falls
  // back to these bits.
  //
  // Each entry spells out the 6x3 block as it appears above the bottom-left
  // finder, top row first, alongside the literal columns it occupies. Values
  // are the 18-bit BCH-protected version information of ISO/IEC 18004
  // Table D.1, laid out per Figure 25: bit i sits at row floor(i / 3),
  // column offset i mod 3.
  const BLOCKS: Record<number, { size: number; colStart: number; rows: string[] }> = {
    7: { size: 45, colStart: 34, rows: ["001", "010", "010", "011", "111", "000"] },
    8: { size: 49, colStart: 38, rows: ["001", "111", "011", "010", "000", "100"] },
    9: { size: 53, colStart: 42, rows: ["100", "110", "010", "101", "100", "100"] },
    10: { size: 57, colStart: 46, rows: ["110", "010", "110", "010", "010", "100"] },
  };

  for (const ver of [7, 8, 9, 10] as const) {
    const { size, colStart, rows } = BLOCKS[ver];

    it(`version ${ver}: the top-right block sits at rows 0-5, columns ${colStart}-${colStart + 2}`, () => {
      const grid = makeQR("x".repeat(CAPACITY_L[ver - 1] + 1))!;
      expect(grid.length).toBe(size);
      const seen = Array.from({ length: 6 }, (_, r) =>
        [0, 1, 2].map((c) => (grid[r][colStart + c] ? "1" : "0")).join(""),
      );
      expect(seen).toEqual(rows);
    });

    it(`version ${ver}: the bottom-left block mirrors it at rows ${colStart}-${colStart + 2}, columns 0-5`, () => {
      const grid = makeQR("x".repeat(CAPACITY_L[ver - 1] + 1))!;
      // Transposed: the same bit that sits at [r][colStart + c] above the
      // top-right finder sits at [colStart + c][r] left of the bottom-left one.
      const seen = Array.from({ length: 6 }, (_, r) =>
        [0, 1, 2].map((c) => (grid[colStart + c][r] ? "1" : "0")).join(""),
      );
      expect(seen).toEqual(rows);
    });
  }

  it("leaves the version-info area clear below version 7", () => {
    // Version 6 reserves no version blocks, so those modules carry data.
    // Pinning the boundary keeps a future off-by-one from writing them.
    const grid = makeQR("x".repeat(CAPACITY_L[5] + 1))!;
    expect(grid.length).toBe(6 * 4 + 17);
  });
});

describe("makeQR non-ASCII payloads", () => {
  // Byte mode carries UTF-8. Reading text with charCodeAt() yields a Latin-1
  // value for é and a 16-bit value for 你, which overflows the 8-bit field
  // and desynchronizes the bit stream; sizing by text.length rather than
  // encoded byte length then undersizes the version on top of that. The
  // symbols came out undecodable while makeQR still returned a grid, so
  // callers shipped a broken image. Reachable through the MCP qr tool,
  // whose base_url passes z.string().url() and so admits IDN hosts.
  for (const text of [
    "https://s.ex/café",
    "https://s.ex/你好",
    "https://s.ex/naïve-café-münchen",
    "https://s.ex/🎯",
  ]) {
    it(`round-trips ${text}`, () => {
      const grid = makeQR(text);
      expect(grid).not.toBeNull();
      expect(decode(grid!)).toBe(text);
    });
  }

  it("sizes the version by encoded byte length, not character count", () => {
    // 60 three-byte characters: 180 bytes needs version 8, while a
    // length-based check would read 60 and pick version 3.
    const text = "好".repeat(60);
    expect(new TextEncoder().encode(text).length).toBe(180);
    const grid = makeQR(text)!;
    expect(grid.length).toBe(8 * 4 + 17);
    expect(decode(grid)).toBe(text);
  });

  it("refuses a payload whose encoded bytes exceed version-10 capacity", () => {
    // 91 three-byte characters encode to 273 bytes, past the 271 ceiling,
    // even though the string is only 91 characters long.
    expect(makeQR("好".repeat(91))).toBeNull();
    expect(makeQR("好".repeat(90))).not.toBeNull(); // 270 bytes, fits
  });
});
