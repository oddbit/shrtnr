// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Toolbar popup. State machine driven by the shorten flow: every popup
// open re-runs config check + active tab read + shortenUrl(). The server
// returns the existing link for a URL it already knows, so reopening the
// popup on the same page never creates a duplicate. Errors are terminal
// until the user clicks Retry or Open settings.

import { useEffect, useMemo, useState } from "preact/hooks";
import { getConfig } from "../storage";
import { shortenUrl, getQrSvg, addCustomSlug, isShortenable, type ShortenResult } from "../api";
import { ExtensionError, logError, type ErrorCategory } from "../errors";
import { copyText } from "../clipboard";
import { COPY_CONFIRM_DURATION_MS, MAX_SLUG_LENGTH } from "../constants";
import { listRecent, recordRecent, type RecentLink } from "../recent";
import { ConfigForm } from "../components/ConfigForm";
import { DeployCta } from "../components/DeployCta";
import { createTranslateFn, detectLanguage, type TranslateFn } from "../i18n";

type QrState = {
  visible: boolean;
  svg: string | null;
  loading: boolean;
  error: ErrorCategory | null;
};

type SlugState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; category: ErrorCategory; serverMessage?: string };

type SuccessState = {
  kind: "success";
  link: ShortenResult;
  /** The page that was shortened. Shown in the recent list. */
  pageUrl: string;
  baseUrl: string;
  qr: QrState;
  /** Set once a custom slug is added, so the QR encodes that slug rather than the primary one. */
  qrSlug?: string;
  copyStatus: "fresh" | "stale" | "failed";
  slugDraft: string;
  slugState: SlugState;
  recent: RecentLink[];
};

type State =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | SuccessState
  | { kind: "error"; category: ErrorCategory; serverMessage?: string; baseUrl?: string };

const IDLE_QR: QrState = { visible: false, svg: null, loading: false, error: null };

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
    case "conflict":
      return "error.conflict";
    case "rate-limited":
      return "error.rateLimited";
    case "server":
      return "error.server";
    case "validation":
      return "error.validation";
    case "slug-invalid":
      return "error.slugInvalid";
  }
}

function hostFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function toRecent(link: ShortenResult, pageUrl: string): RecentLink {
  return { id: link.id, slug: link.slug, shortUrl: link.shortUrl, url: pageUrl, createdAt: Date.now() };
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
        pageUrl: tabUrl,
        baseUrl: config.baseUrl,
        qr: IDLE_QR,
        copyStatus: "fresh",
        slugDraft: "",
        slugState: { kind: "idle" },
        recent: [],
      });
      const [recent] = await Promise.all([
        recordRecent(toRecent(link, tabUrl)),
        copyText(link.shortUrl).catch(() => {
          setState((prev) => (prev.kind === "success" ? { ...prev, copyStatus: "failed" } : prev));
        }),
      ]);
      setState((prev) => (prev.kind === "success" ? { ...prev, recent } : prev));
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
      setState({ ...state, copyStatus: "fresh" });
    } catch {
      setState({ ...state, copyStatus: "failed" });
    }
  }

  async function toggleQr() {
    if (state.kind !== "success") return;
    if (state.qr.visible) {
      setState({ ...state, qr: { ...state.qr, visible: false } });
      return;
    }
    if (state.qr.svg) {
      setState({ ...state, qr: { ...state.qr, visible: true, error: null } });
      return;
    }
    setState({ ...state, qr: { visible: true, svg: null, loading: true, error: null } });
    const { id } = state.link;
    const qrSlug = state.qrSlug;
    try {
      const svg = qrSlug ? await getQrSvg(id, qrSlug) : await getQrSvg(id);
      setState((prev) =>
        prev.kind === "success"
          ? { ...prev, qr: { visible: true, svg, loading: false, error: null } }
          : prev,
      );
    } catch (err) {
      const category: ErrorCategory = err instanceof ExtensionError ? err.category : "server";
      logError(category, err instanceof ExtensionError ? err.status : undefined);
      setState((prev) =>
        prev.kind === "success"
          ? { ...prev, qr: { visible: false, svg: null, loading: false, error: category } }
          : prev,
      );
    }
  }

  function setSlugDraft(value: string) {
    setState((prev) =>
      prev.kind === "success"
        ? { ...prev, slugDraft: value, slugState: prev.slugState.kind === "error" ? { kind: "idle" } : prev.slugState }
        : prev,
    );
  }

  async function submitSlug(e?: Event) {
    e?.preventDefault();
    if (state.kind !== "success" || state.slugState.kind === "running") return;
    const draft = state.slugDraft.trim();
    if (!draft) return;
    const { link, pageUrl } = state;
    setState({ ...state, slugState: { kind: "running" } });
    try {
      const updated = await addCustomSlug(link.id, draft);
      const recent = await recordRecent(toRecent(updated, pageUrl));
      setState((prev) =>
        prev.kind === "success"
          ? {
              ...prev,
              link: updated,
              qr: IDLE_QR,
              qrSlug: updated.slug,
              copyStatus: "fresh",
              slugDraft: "",
              slugState: { kind: "idle" },
              recent,
            }
          : prev,
      );
      try {
        await copyText(updated.shortUrl);
      } catch {
        setState((prev) => (prev.kind === "success" ? { ...prev, copyStatus: "failed" } : prev));
      }
    } catch (err) {
      const category: ErrorCategory = err instanceof ExtensionError ? err.category : "server";
      const serverMessage = err instanceof ExtensionError ? err.serverMessage : undefined;
      logError(category, err instanceof ExtensionError ? err.status : undefined);
      setState((prev) =>
        prev.kind === "success" ? { ...prev, slugState: { kind: "error", category, serverMessage } } : prev,
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
          onSlugInput={setSlugDraft}
          onSlugSubmit={submitSlug}
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
  onSlugInput,
  onSlugSubmit,
}: {
  t: TranslateFn;
  state: SuccessState;
  onCopyAgain: () => void;
  onToggleQr: () => void;
  onOpenSettings: () => void;
  onSlugInput: (value: string) => void;
  onSlugSubmit: (e?: Event) => void;
}) {
  const { link, baseUrl, qr, copyStatus, slugDraft, slugState, recent } = state;
  const adminUrl = `${baseUrl}/_/admin/links/${link.id}`;
  const otherRecent = recent.filter((r) => r.id !== link.id);
  const slugBusy = slugState.kind === "running";
  const slugErrorParams: Record<string, string> = {};
  if (slugState.kind === "error" && slugState.category === "validation" && slugState.serverMessage) {
    slugErrorParams.message = slugState.serverMessage;
  }
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
      {qr.error && (
        <p class="form-status form-status-error" role="alert">
          {t(qr.error === "forbidden" ? "error.qrForbidden" : "error.qrFailed")}
        </p>
      )}
      {qr.visible && qr.svg && (
        <div class="qr-container">
          <img
            class="qr-image"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}
            alt={t("popup.qrAlt")}
          />
        </div>
      )}

      <form
        class="slug-form"
        onSubmit={(e) => {
          onSlugSubmit(e);
        }}
        noValidate
      >
        <div class="field slug-field">
          <label class="field-label" for="slug-input">
            {t("popup.slug.label")}
          </label>
          <div class="slug-row">
            <span class="slug-prefix" aria-hidden="true">
              {hostFromUrl(baseUrl)}/
            </span>
            <input
              id="slug-input"
              type="text"
              class="field-input field-input-mono slug-input"
              placeholder={t("popup.slug.placeholder")}
              value={slugDraft}
              maxLength={MAX_SLUG_LENGTH}
              onInput={(e) => onSlugInput((e.currentTarget as HTMLInputElement).value)}
              autoComplete="off"
              spellcheck={false}
              disabled={slugBusy}
            />
            <button
              type="submit"
              class="button button-secondary"
              disabled={slugBusy || slugDraft.trim() === ""}
            >
              {slugBusy ? t("popup.slug.adding") : t("popup.slug.add")}
            </button>
          </div>
          <span class="field-help">{t("popup.slug.help")}</span>
        </div>
        {slugState.kind === "error" && (
          <p class="form-status form-status-error" role="alert">
            {t(categoryToMessageKey(slugState.category) as never, slugErrorParams)}
          </p>
        )}
      </form>

      {otherRecent.length > 0 && (
        <section class="recent" aria-labelledby="recent-heading">
          <h2 id="recent-heading" class="field-label">
            {t("popup.recent.heading")}
          </h2>
          <ul class="recent-list">
            {otherRecent.map((item) => (
              <li class="recent-item" key={item.id}>
                <a
                  class="recent-slug"
                  href={item.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.shortUrl}
                >
                  /{item.slug}
                </a>
                <span class="recent-host" title={item.url}>
                  {hostFromUrl(item.url)}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
  if (state.baseUrl) params.host = hostFromUrl(state.baseUrl);
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
