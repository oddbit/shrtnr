// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TimelineRange } from "../types";
import type { TranslateFn } from "../i18n";
import { RangePicker } from "../components/range-picker";
import { Widget } from "../admin/widgets/shell";

type Props = {
  t: TranslateFn;
  lang: string;
  range: TimelineRange;
};

export const DashboardPage: FC<Props> = ({ t, range }) => {
  return (
    <>
      <div class="page-header topbar">
        <div>
          <div class="page-title">{t("dashboard.title")}</div>
          <div class="page-subtitle">{t("dashboard.subtitle")}</div>
        </div>
        <div class="topbar-actions">
          <RangePicker current={range} basePath="/_/admin/dashboard" />
        </div>
      </div>

      <div class="hero-input-wrap">
        <input
          class="hero-input"
          id="quick-url"
          type="text"
          placeholder={t("links.inputPlaceholder")}
        />
        <button class="btn btn-primary btn-lg" id="quick-action-btn" onclick="quickShorten()">
          <span class="icon" id="quick-action-icon">bolt</span> <span id="quick-action-label">{t("dashboard.shorten")}</span>
        </button>
      </div>

      <Widget id="dashboard.kpis" range={range} poll />

      <div class="bento">
        <Widget id="dashboard.timeline" range={range} span={2} poll />
        <Widget id="dashboard.top-countries" range={range} />
        <Widget id="dashboard.top-links" range={range} span={2} />
        <Widget id="dashboard.top-domains" range={range} />
        <Widget id="dashboard.recent-links" range={range} span={3} />
      </div>
    </>
  );
};
