// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import { Delta } from "./delta";
import { Sparkline } from "./sparkline";

type KpiCardProps = {
  id?: string;
  icon?: string;
  label: string;
  value: number | string;
  valueId?: string;
  deltaPct?: number | null;
  deltaId?: string;
  lang: string;
  hint?: string;
  sparkline?: number[];
  span?: 1 | 2 | 3;
};

export const KpiCard: FC<KpiCardProps> = ({
  id,
  icon,
  label,
  value,
  valueId,
  deltaPct,
  deltaId,
  lang,
  hint,
  sparkline,
  span = 1,
}) => {
  const spanClass = span === 2 ? "span-2" : span === 3 ? "span-3" : "bento-card-compact";
  return (
    <div class={`bento-card kpi ${spanClass}`} id={id}>
      <div class="kpi-top">
        <div class="kpi-label">
          {icon && <span class="icon">{icon}</span>}
          <span>{label}</span>
        </div>
        {deltaPct !== undefined && deltaPct !== null && <Delta pct={deltaPct} lang={lang} id={deltaId} />}
      </div>
      <div class="kpi-value" id={valueId}>{value}</div>
      {hint && <div class="kpi-hint">{hint}</div>}
      {sparkline && sparkline.length > 0 && (
        <div class="kpi-spark">
          <Sparkline values={sparkline} />
        </div>
      )}
    </div>
  );
};
