// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TranslateFn } from "../i18n";
import { escHtml } from "../escape";
import { SdkList } from "./sdk-list";

// Bullets that stand in for the redacted tail of a key prefix, e.g. sk_84cc••••••.
const KEY_MASK = "••••••";

function formatDate(ts: number, lang: string): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type ApiKey = {
  id: number;
  title: string;
  key_prefix: string;
  scope: string;
  created_at: number;
  last_used_at: number | null;
};

type Props = {
  keys: ApiKey[];
  t: TranslateFn;
  lang: string;
  origin: string;
};

export const KeysPage: FC<Props> = ({ keys, t, lang, origin }) => {
  // Split the banner copy around the {header} token so "Authorization" renders
  // as an inline code element while word order stays translator-controlled.
  const [bannerBefore, bannerAfter = ""] = t("keys.authBanner").split("{header}");
  const curl = `curl ${origin}/_/api/links \\\n  -H "Authorization: Bearer sk_..."`;

  return (
    <>
      <div class="keys-page-header">
        <div class="page-header">
          <div class="page-title">{t("keys.title")}</div>
          <div class="page-subtitle">{t("keys.subtitle")}</div>
        </div>
        <button class="btn btn-primary" onclick="showCreateKeyModal()">
          <span class="icon">add</span> {t("keys.newKey")}
        </button>
      </div>

      <div class="auth-banner">
        <span class="auth-banner-text">
          <span class="icon">info</span>
          <span>
            {bannerBefore}
            <code>Authorization</code>
            {bannerAfter}
          </span>
        </span>
        <a class="auth-banner-link" href="/_/api/docs" target="_blank" rel="noopener">
          {t("keys.docsLink")} <span class="icon">open_in_new</span>
        </a>
      </div>

      <div class="bento">
        <div class="bento-card span-2">
          <div class="bento-label">{t("keys.quickStartTitle")}</div>
          <div class="quick-start-hint">{t("keys.quickStartHint")}</div>
          <div class="code-block">
            <button
              class="btn-icon code-block-copy"
              onclick="copyCodeBlock('quickstart-curl')"
              aria-label={t("keys.copyCommand")}
              title={t("keys.copyCommand")}
            >
              <span class="icon">content_copy</span>
            </button>
            <pre>
              <code id="quickstart-curl">{curl}</code>
            </pre>
          </div>
        </div>
        <div class="bento-card">
          <div class="bento-label">{t("keys.sdkCardTitle")}</div>
          <SdkList t={t} />
        </div>
      </div>

      {keys.length === 0 ? (
        <div class="empty-state">
          <span class="icon">key_off</span>
          <p>
            {t("keys.empty")}
          </p>
        </div>
      ) : (
        <div class="bento-card bento-card-flush">
          <div class="keys-table-scroll">
            <table class="keys-table">
              <thead>
                <tr>
                  <th>{t("keys.colTitle")}</th>
                  <th>{t("keys.colKey")}</th>
                  <th>{t("keys.colScope")}</th>
                  <th>{t("keys.colCreated")}</th>
                  <th>{t("keys.colLastUsed")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const scopes = k.scope.split(",");
                  return (
                    <tr>
                      <td data-label={t("keys.colTitle")} class="col-title">{k.title}</td>
                      <td data-label={t("keys.colKey")}>
                        <span class="col-key-mask">{k.key_prefix}{KEY_MASK}</span>
                      </td>
                      <td data-label={t("keys.colScope")}>
                        {scopes.map((s) => (
                          <span class={`scope-badge ${s}`}>{s} </span>
                        ))}
                      </td>
                      <td data-label={t("keys.colCreated")} class="col-date">
                        {formatDate(k.created_at, lang)}
                      </td>
                      <td data-label={t("keys.colLastUsed")} class="col-last-used">
                        {k.last_used_at ? (
                          <span class="col-last-used-cell">
                            <span class="icon">schedule</span>
                            {formatDate(k.last_used_at, lang)}
                          </span>
                        ) : (
                          <span class="col-never">{t("keys.never")}</span>
                        )}
                      </td>
                      <td>
                        <button
                          class="btn btn-danger btn-sm"
                          onclick={`deleteKey(${k.id},'${escHtml(k.title).replace(/'/g, "\\'")}')`}
                        >
                          <span class="icon icon-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
