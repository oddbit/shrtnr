// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";

type Option = { value: TimelineRange; label: string };

type RangePickerProps = {
  current: TimelineRange;
  basePath: string;
  t: TranslateFn;
  options?: Option[];
  preserveParams?: Record<string, string | undefined>;
};

const DEFAULT_RANGES: TimelineRange[] = ["24h", "7d", "30d", "90d", "1y", "all"];

export const RangePicker: FC<RangePickerProps> = ({ current, basePath, t, options, preserveParams }) => {
  const resolvedOptions = options ?? DEFAULT_RANGES.map((value) => ({ value, label: t(`range.${value}` as const) }));
  return (
    <div class="range-picker" role="group" aria-label={t("range.ariaLabel")}>
      {resolvedOptions.map((o) => {
        const params = new URLSearchParams();
        if (preserveParams) {
          for (const [k, v] of Object.entries(preserveParams)) {
            if (v) params.set(k, v);
          }
        }
        params.set("range", o.value);
        const href = `${basePath}?${params.toString()}`;
        return (
          <a href={href} class={o.value === current ? "active" : ""} data-range={o.value}>{o.label}</a>
        );
      })}
    </div>
  );
};
