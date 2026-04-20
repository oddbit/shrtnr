// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";

type BigChartProps = {
  values: number[];
  range: TimelineRange;
  t: TranslateFn;
  id?: string;
};

const W = 800;
const H = 220;
const PAD = { l: 36, r: 8, t: 10, b: 24 };

function niceStep(max: number): number {
  if (max <= 4) return 1;
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  if (norm <= 1) return pow;
  if (norm <= 2) return 2 * pow;
  if (norm <= 5) return 5 * pow;
  return 10 * pow;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function offsetLabel(range: TimelineRange, i: number, n: number): string {
  const fromEnd = n - 1 - i;
  if (range === "24h") return `-${fromEnd}h`;
  if (range === "1y" || range === "all") return `-${fromEnd}mo`;
  return `-${fromEnd}d`;
}

export const BigChart: FC<BigChartProps> = ({ values, range, t, id }) => {
  const n = values.length;
  if (n === 0) {
    return <div class="empty-card-hint">{t("linkDetail.noClickData")}</div>;
  }

  let maxVal = 0;
  for (let i = 0; i < n; i++) {
    if (values[i] > maxVal) maxVal = values[i];
  }
  if (maxVal === 0) maxVal = 1;

  const step = niceStep(maxVal);
  let gridMax = Math.ceil(maxVal / step) * step;
  if (gridMax === 0) gridMax = step;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? PAD.l + i * stepX : PAD.l + innerW / 2;
    const y = PAD.t + innerH - (values[i] / gridMax) * innerH;
    pts.push([x, y]);
  }

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lastX = n > 1 ? PAD.l + innerW : pts[0][0];
  const baseY = PAD.t + innerH;
  const area = `${line} L${lastX.toFixed(1)},${baseY} L${PAD.l},${baseY} Z`;

  const grid = [0, 0.25, 0.5, 0.75, 1];
  const dotInterval = n > 60 ? Math.ceil(n / 10) : n > 30 ? 5 : n > 14 ? 3 : 1;
  const gradId = id ? `${id}-grad` : "bigChartGrad";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.45" />
          <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g, gi) => {
        const gy = PAD.t + innerH * g;
        const val = Math.round(gridMax * (1 - g));
        return (
          <g key={gi}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={gy}
              y2={gy}
              stroke="var(--color-border)"
              stroke-opacity="0.35"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <text
              x={PAD.l - 6}
              y={gy + 3}
              font-size="9"
              fill="var(--color-text-subtle)"
              text-anchor="end"
              font-family="var(--font-family-mono)"
            >
              {fmtNum(val)}
            </text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-accent)"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      {pts.map((p, i) =>
        i % dotInterval === 0 || i === n - 1 ? (
          <circle
            key={`dot-${i}`}
            cx={p[0].toFixed(1)}
            cy={p[1].toFixed(1)}
            r="2.5"
            fill="var(--color-accent)"
            stroke="var(--color-surface-raised)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
          />
        ) : null,
      )}
      {pts.map((p, i) =>
        i % dotInterval === 0 || i === n - 1 ? (
          <text
            key={`lbl-${i}`}
            x={p[0].toFixed(1)}
            y={H - 6}
            font-size="9"
            fill="var(--color-text-subtle)"
            text-anchor="middle"
            font-family="var(--font-family-mono)"
          >
            {i === n - 1 ? t("linkDetail.today") : offsetLabel(range, i, n)}
          </text>
        ) : null,
      )}
    </svg>
  );
};
