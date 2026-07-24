// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Toolbar popup. State machine driven by the shorten flow: every popup
// open re-runs config check + active tab read + shortenUrl(). Errors
// are terminal until the user clicks Retry or Open settings.

import { useEffect, useMemo, useState } from "preact/hooks";
import { getConfig } from "../storage";
import { shortenUrl, getQrSvg, isShortenable, type ShortenResult } from "../api";
import { ExtensionError, logError, type ErrorCategory } from "../errors";
import { copyText } from "../clipboard";
import { COPY_CONFIRM_DURATION_MS } from "../constants";
import { ConfigForm } from "../components/ConfigForm";
import { DeployCta } from "../components/DeployCta";
import { createTranslateFn, detectLanguage, type TranslateFn } from "../i18n";

type State =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | {
      kind: "success";
      link: ShortenResult;
      baseUrl: string;
      qr: { visible: boolean; svg: string | null; loading: boolean };
      copyStatus: "fresh" | "stale" | "failed";
    }
  | { kind: "error"; category: ErrorCategory; serverMessage?: string; baseUrl?: string };

async function getActiveTabUrl(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url ?? null;
  } catch {
    return null;
  }
}

function categoryToMessageKey(category: ErrorCategory): string {
  switch (category) {
    case "internal-page":
      return "error.internalPage";
    case "unparseable-url":
      return "error.unparseable";
    case "network":
      return "error.network";
    case "unauthorized":
      return "error.unauthorized";
    case "forbidden":
      return "error.forbidden";
    case "not-found":
      return "error.notFound";
    case "rate-limited":
      return "error.rateLimited";
    case "server":
      return "error.server";
    case "validation":
      return "error.validation";
  }
}

function hostFromBaseUrl(baseUrl: string | undefined): string {
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

export function Popup() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const t = useMemo<TranslateFn>(() => createTranslateFn(detectLanguage()), []);

  async function runFlow() {
    setState({ kind: "loading" });
    const [config, tabUrl] = await Promise.all([getConfig(), getActiveTabUrl()]);
    if (!config) {
      setState({ kind: "not-configured" });
      return;
    }
    if (!tabUrl) {
      setState({ kind: "error", category: "unparseable-url", baseUrl: config.baseUrl });
      return;
    }
    if (!isShortenable(tabUrl)) {
      setState({ kind: "error", category: "internal-page", baseUrl: config.baseUrl });
      return;
    }
    try {
      const link = await shortenUrl(tabUrl);
      setState({
        kind: "success",
        link,
        baseUrl: config.baseUrl,
        qr: { visible: false, svg: null, loading: false },
        copyStatus: "fresh",
      });
      try {
        await copyText(link.shortUrl);
      } catch {
        setState((prev) =>
          prev.kind === "success" ? { ...prev, copyStatus: "failed" } : prev,
        );
      }
    } catch (err) {
      if (err instanceof ExtensionError) {
        logError(err.category, err.status);
        setState({
          kind: "error",
          category: err.category,
          serverMessage: err.serverMessage,
          baseUrl: config.baseUrl,
        });
      } else {
        logError("server", undefined);
        setState({ kind: "error", category: "server", baseUrl: config.baseUrl });
      }
    }
  }

  useEffect(() => {
    runFlow();
  }, []);

  useEffect(() => {
    if (state.kind !== "success" || state.copyStatus !== "fresh") return;
    const timeout = setTimeout(() => {
      setState((prev) =>
        prev.kind === "success" && prev.copyStatus === "fresh"
          ? { ...prev, copyStatus: "stale" }
          : prev,
      );
    }, COPY_CONFIRM_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [state.kind, state.kind === "success" ? state.copyStatus : null]);

  function openOptions() {
    void chrome.runtime.openOptionsPage();
  }

  async function copyAgain() {
    if (state.kind !== "success") return;
    try {
      await copyText(state.link.shortUrl);
      setState((prev) => (prev.kind === "success" ? { ...prev, copyStatus: "fresh" } : prev));
    } catch {
      setState((prev) => (prev.kind === "success" ? { ...prev, copyStatus: "failed" } : prev));
    }
  }

  async function toggleQr() {
    if (state.kind !== "success") return;
    if (state.qr.visible) {
      setState({ ...state, qr: { ...state.qr, visible: false } });
      return;
    }
    if (state.qr.svg) {
      setState({ ...state, qr: { ...state.qr, visible: true } });
      return;
    }
    setState({ ...state, qr: { visible: true, svg: null, loading: true } });
    try {
      const svg = await getQrSvg(state.link.id);
      setState((prev) =>
        prev.kind === "success"
          ? { ...prev, qr: { visible: true, svg, loading: false } }
          : prev,
      );
    } catch {
      setState((prev) =>
        prev.kind === "success"
          ? { ...prev, qr: { visible: false, svg: null, loading: false } }
          : prev,
      );
    }
  }

  return (
    <main class="popup">
      <header class="popup-header">
        <span class="brand-name">{t("brand.name")}</span>
        <span class="brand-tagline">{t("brand.tagline")}</span>
      </header>

      {state.kind === "loading" && (
        <section class="popup-state popup-state-loading" aria-live="polite">
          <p>{t("popup.loading")}</p>
        </section>
      )}

      {state.kind === "not-configured" && (
        <section class="popup-state popup-state-config">
          <h2 class="popup-heading">{t("popup.notConfigured.heading")}</h2>
          <p class="popup-body">{t("popup.notConfigured.body")}</p>
          <ConfigForm
            t={t}
            initial={null}
            onSaved={() => {
              void runFlow();
            }}
          />
          <DeployCta t={t} variant="popup" />
        </section>
      )}

      {state.kind === "success" && (
        <SuccessView
          t={t}
          state={state}
          onCopyAgain={copyAgain}
          onToggleQr={toggleQr}
          onOpenSettings={openOptions}
        />
      )}

      {state.kind === "error" && (
        <ErrorView
          t={t}
          state={state}
          onRetry={runFlow}
          onOpenSettings={openOptions}
        />
      )}
    </main>
  );
}

function SuccessView({
  t,
  state,
  onCopyAgain,
  onToggleQr,
  onOpenSettings,
}: {
  t: TranslateFn;
  state: Extract<State, { kind: "success" }>;
  onCopyAgain: () => void;
  onToggleQr: () => void;
  onOpenSettings: () => void;
}) {
  const { link, baseUrl, qr, copyStatus } = state;
  const adminUrl = `${baseUrl}/_/admin/links/${link.id}`;
  return (
    <section class="popup-state popup-state-success">
      <div class="short-url-wrap">
        <span class="field-label">{t("popup.shortUrlLabel")}</span>
        <a class="short-url" href={link.shortUrl} target="_blank" rel="noopener noreferrer">
          {link.shortUrl}
        </a>
      </div>

      {copyStatus === "fresh" && (
        <p class="copied-toast" role="status">
          ✓ {t("popup.copied")}
        </p>
      )}
      {copyStatus === "failed" && (
        <p class="form-status form-status-error" role="alert">
          {t("error.clipboard")}
        </p>
      )}

      <div class="popup-actions">
        <button type="button" class="button button-primary" onClick={onCopyAgain}>
          {copyStatus === "fresh" ? t("popup.copied") : t("popup.copy")}
        </button>
        <button type="button" class="button button-secondary" onClick={onToggleQr}>
          {qr.visible ? t("popup.qrHide") : t("popup.qrShow")}
        </button>
      </div>

      {qr.loading && (
        <p class="popup-body" aria-live="polite">
          {t("popup.qrLoading")}
        </p>
      )}
      {qr.visible && qr.svg && (
        <div class="qr-container">
          <img
            class="qr-image"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}
            alt="QR code"
          />
        </div>
      )}

      <footer class="popup-footer">
        <a class="link" href={adminUrl} target="_blank" rel="noopener noreferrer">
          {t("popup.viewInAdmin")}
        </a>
        <button type="button" class="button button-text" onClick={onOpenSettings}>
          {t("popup.openSettings")}
        </button>
      </footer>
    </section>
  );
}

function ErrorView({
  t,
  state,
  onRetry,
  onOpenSettings,
}: {
  t: TranslateFn;
  state: Extract<State, { kind: "error" }>;
  onRetry: () => void;
  onOpenSettings: () => void;
}) {
  const messageKey = categoryToMessageKey(state.category);
  const params: Record<string, string> = {};
  if (state.baseUrl) params.host = hostFromBaseUrl(state.baseUrl);
  if (state.category === "validation" && state.serverMessage) params.message = state.serverMessage;

  const showRetry =
    state.category === "network" ||
    state.category === "rate-limited" ||
    state.category === "server" ||
    state.category === "validation";
  const showSettings =
    state.category === "unauthorized" ||
    state.category === "forbidden" ||
    state.category === "not-found" ||
    state.category === "network";

  return (
    <section class="popup-state popup-state-error">
      <p class="error-message" role="alert">
        {t(messageKey as never, params)}
      </p>
      <div class="popup-actions">
        {showRetry && (
          <button type="button" class="button button-primary" onClick={onRetry}>
            {t("popup.retry")}
          </button>
        )}
        {showSettings && (
          <button type="button" class="button button-secondary" onClick={onOpenSettings}>
            {t("popup.openSettings")}
          </button>
        )}
        {!showRetry && !showSettings && (
          <button type="button" class="button button-text" onClick={onOpenSettings}>
            {t("popup.openSettings")}
          </button>
        )}
      </div>
    </section>
  );
}
