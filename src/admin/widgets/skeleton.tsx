// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { FC } from "hono/jsx";
import type { WidgetShape } from "./types";

// Row count per shape. List and table reserve several rows; the other shapes
// render a single solid block, so they carry zero rows.
const ROWS: Record<WidgetShape, number> = {
  kpi: 0,
  chart: 0,
  list: 5,
  table: 6,
  hero: 0,
};

// Reserves a widget's footprint and shimmers while htmx swaps in the real
// markup. The persistent .widget-slot owns aria-busy (toggled across htmx
// events in client.ts); this node only reserves space and shimmers.
export const Skeleton: FC<{ shape: WidgetShape }> = ({ shape }) => {
  const rows = ROWS[shape];
  return (
    <div class={`widget-skeleton skel-${shape}`} aria-live="polite">
      {shape === "kpi" && <div class="shimmer skel-kpi-value" />}
      {shape === "chart" && <div class="shimmer skel-chart-area" />}
      {shape === "hero" && <div class="shimmer skel-hero-block" />}
      {(shape === "list" || shape === "table") &&
        Array.from({ length: rows }).map(() => <div class="shimmer skel-row" />)}
    </div>
  );
};
