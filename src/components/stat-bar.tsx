// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import { fmtNumber } from "../i18n/format";

export const StatBar: FC<{
  name: string;
  count: number;
  max: number;
  color: string;
  lang: string;
  flag?: string;
  mono?: boolean;
}> = ({ name, count, max, color, lang, flag, mono }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div class="stat-row">
      <div class={`name${mono ? " mono" : ""}`}>
        {flag && <span class="flag">{flag}</span>}
        <span class="label">{name}</span>
      </div>
      <div class="right">
        <span class="count">{fmtNumber(count, lang)}</span>
        <span class="pct">{pct}%</span>
      </div>
      <div class="bar"><div class={`fill ${color}`} style={`width:${pct}%`} /></div>
    </div>
  );
};
