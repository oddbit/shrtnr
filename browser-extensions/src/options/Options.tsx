// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Options page. Lifecycle is independent from popup: edits the saved
// config, surfaces the deploy CTA whenever no config exists yet, and
// remains open after Save (no auto-close).

import { useEffect, useState } from "preact/hooks";
import { getConfig, type Config } from "../storage";
import { ConfigForm } from "../components/ConfigForm";
import { DeployCta } from "../components/DeployCta";
import { PROJECT_INFO_URL } from "../constants";
import { createTranslateFn, detectLanguage } from "../i18n";

/**
 * The live binding for the popup command, or "" when the browser left it
 * unassigned. `suggested_key` in the manifest is a request: the browser
 * drops it when another extension already holds the combination, and the
 * user can rebind it at any time. Reading it back is the only way to name
 * the keys that actually work.
 */
const POPUP_COMMAND = "_execute_action";

type ShortcutState = { kind: "unknown" } | { kind: "known"; shortcut: string };

async function popupShortcut(): Promise<string | null> {
  if (typeof chrome === "undefined") return null;
  const commands = chrome.commands as { getAll?: () => Promise<chrome.commands.Command[]> } | undefined;
  if (!commands || typeof commands.getAll !== "function") return null;
  try {
    const all = await commands.getAll();
    return all.find((c) => c.name === POPUP_COMMAND)?.shortcut ?? "";
  } catch {
    return null;
  }
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; config: Config | null }
  | { kind: "saved"; config: Config };

// The manifest version is the one number support asks for first. The
// getManifest guard covers test environments that mock only part of the
// runtime namespace.
function installedVersion(): string | null {
  if (typeof chrome === "undefined") return null;
  const runtime = chrome.runtime as { getManifest?: () => { version?: string } } | undefined;
  if (!runtime || typeof runtime.getManifest !== "function") return null;
  try {
    return runtime.getManifest().version ?? null;
  } catch {
    return null;
  }
}

export function Options() {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [shortcut, setShortcut] = useState<ShortcutState>({ kind: "unknown" });
  const t = createTranslateFn(detectLanguage());
  const version = installedVersion();

  useEffect(() => {
    getConfig().then((config) => {
      setLoadState({ kind: "ready", config });
    });
  }, []);

  useEffect(() => {
    popupShortcut().then((value) => {
      if (value !== null) setShortcut({ kind: "known", shortcut: value });
    });
  }, []);

  const initial = loadState.kind === "ready" ? loadState.config : loadState.kind === "saved" ? loadState.config : null;
  const ctaVisible = loadState.kind === "ready" && loadState.config === null;
  const showSaved = loadState.kind === "saved";

  return (
    <main class="options">
      <header class="options-header">
        <h1 class="options-title">{t("options.title")}</h1>
        <p class="options-subtitle">{t("options.subtitle")}</p>
      </header>

      {ctaVisible && (
        <div class="options-cta">
          <DeployCta t={t} variant="banner" />
        </div>
      )}

      <section class="options-section" aria-labelledby="connection-heading">
        <h2 id="connection-heading" class="options-section-heading">
          {t("options.section.connection")}
        </h2>
        <p class="options-section-body">{t("options.section.connection.body")}</p>
        <p class="options-section-body">{t("options.section.connection.scope")}</p>
        {loadState.kind !== "loading" && (
          <ConfigForm
            t={t}
            initial={initial}
            onSaved={(config) => {
              setLoadState({ kind: "saved", config });
            }}
          />
        )}
        {showSaved && (
          <p class="form-status form-status-ok" role="status">
            ✓ {t("form.saved")}
          </p>
        )}
      </section>

      <section class="options-section" aria-labelledby="shortcut-heading">
        <h2 id="shortcut-heading" class="options-section-heading">
          {t("options.section.shortcut")}
        </h2>
        {shortcut.kind === "known" && (
          <p class="options-section-body">
            {shortcut.shortcut
              ? t("options.section.shortcut.body", { shortcut: shortcut.shortcut })
              : t("options.section.shortcut.unassigned")}
          </p>
        )}
      </section>

      <section class="options-section" aria-labelledby="about-heading">
        <h2 id="about-heading" class="options-section-heading">
          {t("options.section.about")}
        </h2>
        <p class="options-section-body">{t("options.section.about.body")}</p>
        {version && (
          <p class="options-section-body">{t("options.section.about.version", { version })}</p>
        )}
        <p class="options-section-body">
          <a class="link" href={PROJECT_INFO_URL} target="_blank" rel="noopener noreferrer">
            {t("options.section.about.website")}
          </a>
        </p>
      </section>
    </main>
  );
}
