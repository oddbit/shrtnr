// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TranslateFn } from "../i18n";
import type { TimelineRange } from "../types";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { fmtNumber } from "../i18n/format";
import { RANDOM_CHARSET } from "../slugs";
import { MIN_SLUG_LENGTH } from "../constants";

const RANGE_OPTIONS: TimelineRange[] = ["24h", "7d", "30d", "90d", "1y", "all"];

type Props = {
  theme: string;
  slugLength: number;
  lang: string;
  defaultRange: TimelineRange | null;
  t: TranslateFn;
  mcpConfigured: boolean;
  userEmail?: string | null;
};

export const SettingsPage: FC<Props> = ({ theme, slugLength, lang, defaultRange, t, mcpConfigured, userEmail }) => {
  const combos = Math.pow(RANDOM_CHARSET.length, Math.max(slugLength, MIN_SLUG_LENGTH));
  const comboHint =
    slugLength >= 3
      ? t("settings.combos", { count: fmtNumber(combos, lang) })
      : t("settings.minLength");

  return (
    <>
      <div class="page-header">
        <div class="page-title">{t("settings.title")}</div>
        <div class="page-subtitle">{t("settings.subtitle")}</div>
      </div>

      <div class="settings-layout">
        <div class="settings-main">
          <div class="bento-card">
            <div class="form-group">
              <label class="form-label">{t("settings.language")}</label>
              <div class="form-select">
                <select
                  class="form-input"
                  id="language-picker"
                  onchange="setLanguage(this.value)"
                >
                  {SUPPORTED_LANGUAGES.map((code) => {
                    const native = t(`lang.${code}` as any);
                    const local = t(`langLocal.${code}` as any);
                    const label = lang === code ? native : `${native} · ${local}`;
                    return (
                      <option value={code} selected={lang === code}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div class="bento-card">
            <div class="form-group">
              <label class="form-label">{t("settings.theme")}</label>
              <div class="theme-toggle" id="theme-picker">
                <button
                  class={`theme-btn${theme === "oddbit" ? " active" : ""}`}
                  data-theme="oddbit"
                  onclick="setTheme('oddbit')"
                >
                  <span class="icon">eco</span> {t("settings.themeOddbit")}
                </button>
                <button
                  class={`theme-btn${theme === "dark" ? " active" : ""}`}
                  data-theme="dark"
                  onclick="setTheme('dark')"
                >
                  <span class="icon">dark_mode</span> {t("settings.themeDark")}
                </button>
                <button
                  class={`theme-btn${theme === "light" ? " active" : ""}`}
                  data-theme="light"
                  onclick="setTheme('light')"
                >
                  <span class="icon">light_mode</span> {t("settings.themeLight")}
                </button>
              </div>
            </div>
          </div>

          <div class="bento-card">
            <div class="form-group">
              <label class="form-label">{t("settings.defaultRange")}</label>
              <div class="form-select">
                <select
                  class="form-input"
                  id="default-range-picker"
                  onchange="setDefaultRange(this.value)"
                >
                  <option value="" selected={defaultRange === null}>
                    {t("settings.defaultRangeUnset")}
                  </option>
                  {RANGE_OPTIONS.map((r) => (
                    <option value={r} selected={defaultRange === r}>
                      {t(`range.long.${r}` as const)}
                    </option>
                  ))}
                </select>
              </div>
              <div class="form-hint">{t("settings.defaultRangeHint")}</div>
            </div>
          </div>

          <div class="bento-card">
            <div class="form-group">
              <label class="form-label">{t("settings.slugLength")}</label>
              <div class="slug-length-row">
                <input
                  class="form-input"
                  type="number"
                  id="slug-length-input"
                  min={String(MIN_SLUG_LENGTH)}
                  value={String(slugLength)}
                />
                <button class="btn btn-secondary btn-sm" onclick="saveSettings()">
                  {t("settings.save")}
                </button>
              </div>
              <div class="form-hint" id="slug-combo-hint">{comboHint}</div>
            </div>
          </div>

          <div class="bento-card">
            <div class="form-group form-group-flush">
              <label class="form-label">{t("settings.version")}</label>
              <div id="version-status" class="version-status">
                <span class="icon icon-spin">progress_activity</span>
                <span>{t("settings.checkingUpdates")}</span>
              </div>
            </div>
          </div>

          {userEmail && (
            <div class="bento-card">
              <div class="form-group form-group-flush">
                <label class="form-label">{t("settings.account")}</label>
                <div class="account-row">
                  <div class="account-identity">
                    <span class="icon">person</span>
                    <span class="email">{userEmail}</span>
                  </div>
                  <a href="/_/admin/logout" class="account-logout">
                    <span class="icon">logout</span>
                    {t("nav.logout")}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div class="settings-side">
          <div class="settings-side-label">{t("settings.integrations")}</div>
          <a
            href="https://oddb.it/shrtnr-npm-app"
            target="_blank"
            rel="noopener"
            class="bento-card integration-card"
          >
            <div class="integration-card-head">
              <span class="icon">terminal</span>
              <span class="integration-card-title">{t("settings.sdkTitle")}</span>
            </div>
            <div class="integration-card-desc">{t("settings.sdkDesc")}</div>
            <div class="integration-card-link">
              <span class="icon">open_in_new</span>
              {t("settings.sdkLink")}
            </div>
          </a>
          <a
            href="https://oddb.it/mcp-documentation-app"
            target="_blank"
            rel="noopener"
            class="bento-card integration-card"
          >
            <div class="integration-card-head">
              <span class="icon">smart_toy</span>
              <span class="integration-card-title">{t("settings.mcpTitle")}</span>
            </div>
            <div class="integration-card-desc">{t("settings.mcpDesc")}</div>
            <div class="integration-card-link">
              <span class="icon">open_in_new</span>
              {mcpConfigured ? t("settings.mcpDocsLink") : t("settings.mcpSetupLink")}
            </div>
          </a>
        </div>
      </div>
    </>
  );
};
