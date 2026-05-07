// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_QR_SIZE, MAX_QR_SIZE, MIN_QR_SIZE } from "./constants";

/**
 * Generate a QR code matrix for the given text.
 * Returns a 2D boolean grid (true = dark module) or null if the text is too long.
 * Supports QR versions 1-10 (up to 271 bytes).
 */
export function makeQR(text: string): boolean[][] | null {
  const data: number[] = [];
  for (let i = 0; i < text.length; i++) data.push(text.charCodeAt(i));

  const caps = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  let ver = 1;
  while (ver <= 10 && caps[ver] < data.length) ver++;
  if (ver > 10) return null;

  const size = ver * 4 + 17;
  const grid = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  function setFinder(r: number, c: number) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = 1;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          grid[rr][cc] = (edge || inner) ? 1 : 0;
        }
      }
    }
  }

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = 1;
    grid[6][i] = (i % 2 === 0) ? 1 : 0;
    reserved[i][6] = 1;
    grid[i][6] = (i % 2 === 0) ? 1 : 0;
  }

  if (ver >= 2) {
    const alignTable: (number | number[])[] = [
      6, [0, 0], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    ];
    const aligns = alignTable[ver];
    if (Array.isArray(aligns)) {
      for (let ai = 0; ai < aligns.length; ai++) {
        for (let aj = 0; aj < aligns.length; aj++) {
          const ar = aligns[ai];
          const ac = aligns[aj];
          if (reserved[ar] && reserved[ar][ac]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const rr = ar + dr;
              const cc = ac + dc;
              if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
                reserved[rr][cc] = 1;
                grid[rr][cc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
              }
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    reserved[8][i] = 1;
    reserved[8][size - 1 - i] = 1;
    reserved[i][8] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  reserved[8][8] = 1;
  reserved[size - 8][8] = 1;
  grid[size - 8][8] = 1;

  const eccL = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  const totalCodewords = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const numEcc = eccL[ver];
  const numData = totalCodewords[ver] - numEcc;

  let bits = "";
  bits += "0100";
  bits += ver <= 9 ? toBin(data.length, 8) : toBin(data.length, 16);
  for (let i = 0; i < data.length; i++) bits += toBin(data[i], 8);

  const maxBits = numData * 8;
  bits += "0000".slice(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8) bits += "0";

  const pads = [0xec, 0x11];
  let pi = 0;
  while (bits.length < maxBits) {
    bits += toBin(pads[pi % 2], 8);
    pi++;
  }

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) dataBytes.push(parseInt(bits.slice(i, i + 8), 2));
  const eccBytes = rsEncode(dataBytes, numEcc);
  const allBytes = dataBytes.concat(eccBytes);

  let bitStr = "";
  for (let i = 0; i < allBytes.length; i++) bitStr += toBin(allBytes[i], 8);

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5;
    const rows: number[] = [];
    if (upward) {
      for (let i = size - 1; i >= 0; i--) rows.push(i);
    } else {
      for (let i = 0; i < size; i++) rows.push(i);
    }
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || reserved[row][c]) continue;
        grid[row][c] = bitIdx < bitStr.length ? parseInt(bitStr[bitIdx++]) : 0;
      }
    }
    upward = !upward;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) grid[r][c] ^= 1;
    }
  }

  const fmtBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 0];
  for (let i = 0; i < 6; i++) grid[8][i] = fmtBits[i];
  grid[8][7] = fmtBits[6];
  grid[8][8] = fmtBits[7];
  grid[7][8] = fmtBits[8];
  for (let i = 0; i < 6; i++) grid[5 - i][8] = fmtBits[9 + i];
  for (let i = 0; i < 7; i++) grid[size - 1 - i][8] = fmtBits[i];
  for (let i = 0; i < 8; i++) grid[8][size - 8 + i] = fmtBits[7 + i];

  const result: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    result.push(Array.from(grid[r], (v) => v === 1));
  }
  return result;
}

function toBin(n: number, len: number): string {
  return n.toString(2).padStart(len, "0");
}

function rsEncode(data: number[], numEcc: number): number[] {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];

  function gfMul(a: number, b: number): number {
    return a === 0 || b === 0 ? 0 : exp[log[a] + log[b]];
  }

  let gen = [1];
  for (let i = 0; i < numEcc; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], exp[i]);
    }
    gen = newGen;
  }

  const msg = new Uint8Array(data.length + numEcc);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
  }

  return Array.from(msg.slice(data.length));
}

/**
 * Render a QR code as an SVG string.
 * Returns null if the text cannot be encoded or the size is invalid.
 */
export function renderQrSvg(
  text: string,
  options: { size?: number; fg?: string; bg?: string } = {},
): string | null {
  if (options.size !== undefined && (!Number.isInteger(options.size) || options.size < MIN_QR_SIZE || options.size > MAX_QR_SIZE)) {
    return null;
  }

  const matrix = makeQR(text);
  if (!matrix) return null;

  const modules = matrix.length;
  const margin = 4;
  const total = modules + margin * 2;
  const cellSize = (options.size ?? DEFAULT_QR_SIZE) / total;
  const svgSize = total * cellSize;
  const fg = options.fg ?? "#001110";
  const bg = options.bg ?? "#ffffff";

  let rects = "";
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}"/>`;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}">`,
    `<rect width="${svgSize}" height="${svgSize}" fill="${bg}"/>`,
    `<g fill="${fg}">${rects}</g>`,
    `</svg>`,
  ].join("");
}
