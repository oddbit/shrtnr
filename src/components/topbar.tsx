// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TranslateFn, TranslationKey } from "../i18n";

type TopbarProps = {
  active: string;
  t: TranslateFn;
};

const CRUMB_KEYS: Record<string, TranslationKey> = {
  dashboard: "nav.dashboard",
  links: "nav.links",
  bundles: "nav.bundles",
  keys: "nav.apiKeys",
  settings: "nav.settings",
};

export const Topbar: FC<TopbarProps> = ({ active, t }) => {
  const crumbKey = CRUMB_KEYS[active];
  const crumbLabel = crumbKey ? t(crumbKey) : "";

  return (
    <div class="topbar">
      <nav class="topbar-crumbs" aria-label={t("topbar.breadcrumb")}>
        <span>{t("topbar.workspace")}</span>
        {crumbLabel && (
          <>
            <span class="sep">/</span>
            <span class="current">{crumbLabel}</span>
          </>
        )}
      </nav>
    </div>
  );
};
