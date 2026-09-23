// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Shared connection-settings form. Used by the popup (when not yet
// configured) and by the options page (always). Owns its own draft
// state; emits saved values upward via onSaved.

import { useState } from "preact/hooks";
import type { Config } from "../storage";
import { setConfig } from "../storage";
import { testConnection } from "../api";
import { ExtensionError } from "../errors";
import type { TranslateFn } from "../i18n";
import { hostFromUrl } from "../url";

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok" }
  | { kind: "ok-limited" }
  | { kind: "error"; messageKey: string; params?: Record<string, string> };

type SaveState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; messageKey: string; params?: Record<string, string> };

type Props = {
  t: TranslateFn;
  initial: Config | null;
  onSaved: (config: Config) => void;
  showCancel?: boolean;
  onCancel?: () => void;
};

function categoryToMessage(category: string): {
  messageKey: string;
  params?: Record<string, string>;
} {
  switch (category) {
    case "network":
      return { messageKey: "error.network" };
    case "unauthorized":
      return { messageKey: "error.unauthorized" };
    case "forbidden":
      return { messageKey: "error.forbidden" };
    case "not-found":
      return { messageKey: "error.notFound" };
    case "rate-limited":
      return { messageKey: "error.rateLimited" };
    case "validation":
      return { messageKey: "error.validation" };
    default:
      return { messageKey: "error.server" };
  }
}

/**
 * Drops every granted host permission except the one the saved config points
 * at, so the extension only ever holds access to its own deployment.
 *
 * Reading the grants rather than the previous config is what makes this
 * complete: Test grants an origin for whatever URL is in the field at the
 * time, and those origins are never written to storage. Testing
 * `https://a.example`, editing to `https://b.example` and saving would
 * otherwise leave A granted forever.
 *
 * Best effort: a browser that declines the removal keeps working, it merely
 * holds a stale grant.
 */
async function pruneOriginPermissions(keepOrigin: string): Promise<void> {
  const permissions = typeof chrome !== "undefined" ? chrome.permissions : undefined;
  if (!permissions || typeof permissions.remove !== "function") return;
  if (typeof permissions.getAll !== "function") return;
  try {
    const granted = await permissions.getAll();
    const keep = `${keepOrigin}/*`;
    const stale = (granted.origins ?? []).filter((o) => o !== keep);
    if (stale.length === 0) return;
    await permissions.remove({ origins: stale });
  } catch {
    // Nothing to recover: a stale grant is harmless without a matching config.
  }
}

export function ConfigForm({ t, initial, onSaved, showCancel, onCancel }: Props) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const trimmedKey = apiKey.trim();
  const formValid = baseUrl.trim() !== "" && trimmedKey !== "";

  async function handleTest() {
    if (!formValid) return;
    setTestState({ kind: "running" });

    // Mirror handleSave's normalization and permission request: without the
    // origin-only URL and a granted host permission, the fetch below is
    // subject to the same-origin/CORS restrictions of a normal page and a
    // reachable server is reported as a network failure.
    let origin: string;
    try {
      origin = new URL(baseUrl.trim()).origin;
    } catch {
      setTestState({ kind: "error", messageKey: "error.invalidUrl" });
      return;
    }

    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch {
      granted = false;
    }
    if (!granted) {
      setTestState({
        kind: "error",
        messageKey: "error.permissionDeniedTest",
        params: { host: hostFromUrl(origin) },
      });
      return;
    }

    try {
      await testConnection({ baseUrl: origin, apiKey: trimmedKey });
      setTestState({ kind: "ok" });
    } catch (err) {
      const host = hostFromUrl(origin);
      if (err instanceof ExtensionError) {
        // The probe is a read call. A 403 means the server accepted the key
        // and only its scope stops the read: the connection itself works.
        if (err.category === "forbidden") {
          setTestState({ kind: "ok-limited" });
          return;
        }
        const mapped = categoryToMessage(err.category);
        setTestState({
          kind: "error",
          messageKey: mapped.messageKey,
          params:
            err.category === "validation" && err.serverMessage
              ? { message: err.serverMessage, host }
              : { host },
        });
      } else {
        setTestState({ kind: "error", messageKey: "error.network", params: { host } });
      }
    }
  }

  async function handleSave(e?: Event) {
    e?.preventDefault();
    if (!formValid) return;
    setSaveState({ kind: "running" });

    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(baseUrl.trim()).origin;
    } catch {
      setSaveState({ kind: "error", messageKey: "error.invalidUrl" });
      return;
    }

    let granted = false;
    try {
      granted = await chrome.permissions.request({
        origins: [`${normalizedOrigin}/*`],
      });
    } catch {
      granted = false;
    }
    if (!granted) {
      setSaveState({
        kind: "error",
        messageKey: "error.permissionDenied",
        params: { host: hostFromUrl(normalizedOrigin) },
      });
      return;
    }

    try {
      await setConfig({ baseUrl: baseUrl.trim(), apiKey: trimmedKey });
      setSaveState({ kind: "idle" });
      onSaved({ baseUrl: normalizedOrigin, apiKey: trimmedKey });
    } catch {
      // chrome.storage rejections carry English-only browser strings
      // (quota, write-rate). Report a localized message instead.
      setSaveState({ kind: "error", messageKey: "error.saveFailed" });
      return;
    }

    await pruneOriginPermissions(normalizedOrigin);
  }

  return (
    <form
      class="config-form"
      onSubmit={(e) => {
        void handleSave(e);
      }}
      noValidate
    >
      <label class="field">
        <span class="field-label">{t("form.baseUrl.label")}</span>
        <input
          type="url"
          class="field-input"
          placeholder={t("form.baseUrl.placeholder")}
          value={baseUrl}
          onInput={(e) => setBaseUrl((e.currentTarget as HTMLInputElement).value)}
          autoComplete="off"
          spellcheck={false}
          required
        />
        <span class="field-help">{t("form.baseUrl.help")}</span>
      </label>

      <label class="field">
        <span class="field-label">{t("form.apiKey.label")}</span>
        <input
          type="password"
          class="field-input field-input-mono"
          placeholder={t("form.apiKey.placeholder")}
          value={apiKey}
          onInput={(e) => setApiKey((e.currentTarget as HTMLInputElement).value)}
          autoComplete="off"
          spellcheck={false}
          required
        />
        <span class="field-help">{t("form.apiKey.help")}</span>
      </label>

      <div class="form-actions">
        <button
          type="button"
          class="button button-secondary"
          onClick={handleTest}
          disabled={!formValid || testState.kind === "running"}
        >
          {testState.kind === "running" ? t("form.testing") : t("form.test")}
        </button>
        <button
          type="button"
          class="button button-primary"
          onClick={() => {
            void handleSave();
          }}
          disabled={!formValid || saveState.kind === "running"}
        >
          {saveState.kind === "running" ? t("form.saving") : t("form.save")}
        </button>
        {showCancel && onCancel && (
          <button type="button" class="button button-text" onClick={onCancel}>
            {t("form.cancel")}
          </button>
        )}
      </div>

      {testState.kind === "ok" && (
        <p class="form-status form-status-ok" role="status">
          ✓ {t("form.testOk")}
        </p>
      )}
      {testState.kind === "ok-limited" && (
        <p class="form-status form-status-ok" role="status">
          ✓ {t("form.testOkCreateOnly")}
        </p>
      )}
      {testState.kind === "error" && (
        <p class="form-status form-status-error" role="alert">
          {t(testState.messageKey as never, testState.params)}
        </p>
      )}
      {saveState.kind === "error" && (
        <p class="form-status form-status-error" role="alert">
          {t(saveState.messageKey as never, saveState.params)}
        </p>
      )}
    </form>
  );
}
