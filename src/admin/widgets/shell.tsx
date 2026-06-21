// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { FC } from "hono/jsx";
import { getWidget } from "./registry";
import { Skeleton } from "./skeleton";

/**
 * Grid child placeholder for one widget. The shell owns the outer container,
 * the htmx attributes, and the loading skeleton. htmx swaps the loader's markup
 * into this element's children (hx-swap="innerHTML"), so the element persists
 * across re-fetches: the reserved min-height and the .htmx-request shimmer
 * overlay stay attached to it while a swap is in flight.
 *
 * The container class tracks the widget's shape. The kpi strip is a flex row,
 * not a bento-card, so the kpi shape renders the strip wrapper while every other
 * shape renders a bento-card (with an optional span-<n> grid hint).
 *
 * The hx-trigger fires on load. A poll prop adds a 30s refresh for live shapes.
 * Range switching reloads the whole dashboard via RangePicker, so no body-level
 * range event is wired here.
 */
export const Widget: FC<{
  id: string;
  range?: string;
  entityId?: string | number;
  span?: number;
  poll?: boolean;
}> = ({ id, range, entityId, span, poll }) => {
  const w = getWidget(id);
  const shape = w?.shape ?? "list";

  const qs = new URLSearchParams();
  if (range) qs.set("range", range);
  if (entityId !== undefined) qs.set("id", String(entityId));
  const query = qs.toString();
  const url = `/_/admin/w/${id}${query ? `?${query}` : ""}`;

  const triggers = ["load", poll ? "every 30s" : ""].filter(Boolean).join(", ");

  // Every placeholder carries widget-slot so the error card's Retry button can
  // target "closest .widget-slot" regardless of shape. The kpi strip is a flex
  // row (not a bento-card), so without this shared marker the kpi retry button
  // would find no swap target and fail silently.
  const container =
    shape === "kpi"
      ? "widget-slot kpi-strip skel-kpi"
      : `widget-slot bento-card skel-${shape}${span ? ` span-${span}` : ""}`;

  return (
    <div
      class={container}
      hx-get={url}
      hx-trigger={triggers}
      hx-target="this"
      hx-swap="innerHTML"
      hx-indicator="this"
      aria-busy="true"
    >
      <Skeleton shape={shape} />
    </div>
  );
};
