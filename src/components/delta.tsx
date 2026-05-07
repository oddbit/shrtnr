// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import { fmtNumber } from "../i18n/format";

type DeltaProps = {
  pct: number;
  lang: string;
  id?: string;
};

export const Delta: FC<DeltaProps> = ({ pct, lang, id }) => {
  // Normalize -0 to 0 so Intl.NumberFormat does not render a confusing "-0%"
  // when dir is "flat".
  const safePct = Object.is(pct, -0) ? 0 : pct;
  const dir = safePct > 0 ? "up" : safePct < 0 ? "down" : "flat";
  const icon = dir === "up" ? "trending_up" : dir === "down" ? "trending_down" : "trending_flat";
  const sign = safePct > 0 ? "+" : "";
  return (
    <span class={`delta ${dir}`} id={id} data-delta={String(safePct)}>
      <span class="icon">{icon}</span>
      <span class="delta-label">{sign}{fmtNumber(safePct, lang)}%</span>
    </span>
  );
};
