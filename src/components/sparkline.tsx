// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";

type SparklineProps = {
  values: number[];
  stroke?: string;
  id?: string;
};

const W = 140;
const H = 34;

export const Sparkline: FC<SparklineProps> = ({
  values,
  stroke = "var(--color-accent)",
  id,
}) => {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const pts = values.map((v, i): [number, number] => {
    const x = i * step;
    const y = H - ((v - min) / span) * (H - 4) - 2;
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${W.toFixed(1)},${H} L 0,${H} Z`;
  const gradId = id ? `${id}-grad` : `spark-grad-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={stroke} stop-opacity="0.35" />
          <stop offset="100%" stop-color={stroke} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={stroke} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  );
};
