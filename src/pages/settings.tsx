// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TranslateFn } from "../i18n";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { RANDOM_CHARSET } from "../slugs";
import { MIN_SLUG_LENGTH } from "../constants";

type Props = {
  theme: string;
  slugLength: number;
  lang: string;
  t: TranslateFn;
  mcpConfigured: boolean;
  userEmail?: string | null;
};

export const SettingsPage: FC<Props> = ({ theme, slugLength, lang, t, mcpConfigured, userEmail }) => {
  const combos = Math.pow(RANDOM_CHARSET.length, Math.max(slugLength, MIN_SLUG_LENGTH));
  const comboHint =
    slugLength >= 3
      ? t("settings.combos", { count: combos.toLocaleString() })
      : t("settings.minLength");

  return (
    <>
      <div class="page-header">
        <div class="page-title">{t("settings.title")}</div>
        <div class="page-subtitle">{t("settings.subtitle")}</div>
      </div>

      <div
        class="settings-layout"
        style="display:flex;gap:2.5rem;align-items:flex-start;flex-wrap:wrap"
      >
        <div style="flex:1;min-width:280px;max-width:480px">
          <div class="bento-card">
            <div class="form-group">
              <label class="form-label">{t("settings.language")}</label>
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

          <div class="bento-card" style="margin-top:1.4rem">
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

          <div class="bento-card" style="margin-top:1.4rem">
            <div class="form-group">
              <label class="form-label">{t("settings.slugLength")}</label>
              <div style="display:flex;gap:0.75rem;align-items:center">
                <input
                  class="form-input"
                  type="number"
                  id="slug-length-input"
                  min={String(MIN_SLUG_LENGTH)}
                  value={String(slugLength)}
                  style="width:80px"
                />
                <button class="btn btn-secondary btn-sm" onclick="saveSettings()">
                  {t("settings.save")}
                </button>
              </div>
              <div
                style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.4rem"
                id="slug-combo-hint"
              >
                {comboHint}
              </div>
            </div>
          </div>

          <div class="bento-card" style="margin-top:1.4rem">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">{t("settings.version")}</label>              <div id="version-status" style="font-size:0.875rem;margin-top:0.5rem">
                <span style="color:var(--color-text-muted)">
                  <span
                    class="icon"
                    style="font-size:16px;vertical-align:text-bottom;animation:spin 1s linear infinite"
                  >
                    progress_activity
                  </span>{" "}
                  {t("settings.checkingUpdates")}
                </span>
              </div>
            </div>
          </div>

          {userEmail && (
            <div class="bento-card" style="margin-top:1.4rem">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">{t("settings.account")}</label>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:0.5rem">
                  <div style="display:flex;align-items:center;gap:0.5rem;min-width:0">
                    <span class="icon" style="font-size:18px;color:var(--color-text-muted);flex-shrink:0">person</span>
                    <span style="font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{userEmail}</span>
                  </div>
                  <a
                    href="/_/admin/logout"
                    style="font-size:0.813rem;color:var(--color-text-muted);text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:0.3rem"
                  >
                    <span class="icon" style="font-size:15px">logout</span>
                    {t("nav.logout")}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style="min-width:240px;max-width:300px;display:flex;flex-direction:column;gap:1.4rem">
          <div style="font-size:0.75rem;color:var(--color-success);font-weight:600;text-transform:uppercase">
            {t("settings.integrations")}
          </div>
          <a
            href="https://oddb.it/shrtnr-npm-app"
            target="_blank"
            rel="noopener"
            class="bento-card"
            style="text-decoration:none;color:inherit;display:block"
          >
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
              <span class="icon" style="color:var(--color-accent)">
                terminal
              </span>
              <span style="font-weight:600">{t("settings.sdkTitle")}</span>
            </div>
            <div style="font-size:0.813rem;color:var(--color-text-muted);line-height:1.45">
              {t("settings.sdkDesc")}
            </div>
            <div style="font-size:0.7rem;color:var(--color-success);margin-top:0.6rem;display:flex;align-items:center;gap:0.25rem">
              <span class="icon" style="font-size:14px">
                open_in_new
              </span>{" "}
              {t("settings.sdkLink")}
            </div>
          </a>
          <a
            href="https://oddb.it/mcp-documentation-app"
            target="_blank"
            rel="noopener"
            class="bento-card"
            style="text-decoration:none;color:inherit;display:block"
          >
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
              <span class="icon" style="color:var(--color-accent)">
                smart_toy
              </span>
              <span style="font-weight:600">{t("settings.mcpTitle")}</span>
            </div>
            <div style="font-size:0.813rem;color:var(--color-text-muted);line-height:1.45">
              {t("settings.mcpDesc")}
            </div>
            {mcpConfigured ? (
              <div style="font-size:0.7rem;color:var(--color-success);margin-top:0.6rem;display:flex;align-items:center;gap:0.25rem">
                <span class="icon" style="font-size:14px">open_in_new</span>{" "}
                {t("settings.mcpDocsLink")}
              </div>
            ) : (
              <div style="font-size:0.7rem;color:var(--color-success);margin-top:0.6rem;display:flex;align-items:center;gap:0.25rem">
                <span class="icon" style="font-size:14px">open_in_new</span>{" "}
                {t("settings.mcpSetupLink")}
              </div>
            )}
          </a>
        </div>
      </div>
    </>
  );
};
