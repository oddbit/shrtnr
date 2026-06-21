// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { AdminWidget } from "./types";
import { kpisWidget } from "./dashboard/kpis";
import { timelineWidget } from "./dashboard/timeline";
import { topCountriesWidget } from "./dashboard/top-countries";
import { topLinksWidget } from "./dashboard/top-links";
import { topDomainsWidget } from "./dashboard/top-domains";
import { recentLinksWidget } from "./dashboard/recent-links";

const all: AdminWidget[] = [
  kpisWidget,
  timelineWidget,
  topCountriesWidget,
  topLinksWidget,
  topDomainsWidget,
  recentLinksWidget,
];

export const widgets: Record<string, AdminWidget> = Object.fromEntries(
  all.map((w) => [w.id, w]),
);

export function getWidget(id: string): AdminWidget | undefined {
  return widgets[id];
}

export function widgetsForPage(page: string): AdminWidget[] {
  return all.filter((w) => w.id.startsWith(page + "."));
}
