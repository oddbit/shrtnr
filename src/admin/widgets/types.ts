// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Context } from "hono";
import type { Env } from "../../types";
import type { ClickFilters } from "../../db/filters";
import type { TranslateFn } from "../../i18n";

export type WidgetShape = "kpi" | "chart" | "list" | "table" | "hero";

export interface WidgetCtx {
  identity: string;
  filters: ClickFilters;
  t: TranslateFn;
  lang: string;
}

export interface CachePolicy {
  ttl: number;             // seconds; 0 disables caching
  varyByRange?: boolean;   // default true
  varyByEntity?: boolean;  // default false
}

export interface AdminWidget<Params = unknown, Data = unknown> {
  id: string;                                  // "dashboard.timeline"
  shape: WidgetShape;
  params(c: Context): Params;
  load(env: Env, ctx: WidgetCtx, p: Params): Promise<Data>;
  render(data: Data, ctx: WidgetCtx): unknown; // JSX node
  cache?: CachePolicy;
}
