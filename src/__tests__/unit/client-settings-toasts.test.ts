// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// setTheme() used to toast "Theme updated" unconditionally, regardless of
// whether the PUT to /settings succeeded. Every sibling settings setter
// (setDefaultRange, saveSettings, setFilterBots, setFilterSelfReferrers,
// and now setLanguage) checks res.ok before deciding which toast to show.
// This extracts the real handlers from the generated script and drives
// them against both a success and a failure response to prove the outcome
// now reflects the actual result.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import { extractTopLevelChunk } from "../client-script";
import type { Translations } from "../../i18n/types";

type ToastCall = { message: string; level?: string };

function loadHandlers(ok: boolean) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    extractTopLevelChunk(script, /^function applyTheme\(/),
    extractTopLevelChunk(script, /^function setTheme\(/),
    extractTopLevelChunk(script, /^function setLanguage\(/),
    "return { setTheme: setTheme, setLanguage: setLanguage };",
  ].join("\n");

  const toasts: ToastCall[] = [];
  const fakeDocument = {
    documentElement: { setAttribute: () => {} },
    querySelectorAll: () => [],
    cookie: "",
  };
  let reloaded = false;
  const factory = new Function("api", "toast", "t", "document", "window", code) as (
    ...args: unknown[]
  ) => { setTheme: (theme: string) => void; setLanguage: (lang: string) => void };

  const handlers = factory(
    () => Promise.resolve({ ok }),
    (message: string, level?: string) => {
      toasts.push({ message, level });
    },
    (key: string) => key,
    fakeDocument,
    { location: { reload: () => { reloaded = true; } } },
  );
  return { handlers, toasts, reloaded: () => reloaded };
}

async function waitForToast(toasts: ToastCall[]) {
  for (let i = 0; i < 50 && toasts.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("setTheme", () => {
  it("toasts success only when the save succeeds", async () => {
    const { handlers, toasts } = loadHandlers(true);
    handlers.setTheme("dark");
    await waitForToast(toasts);
    expect(toasts).toEqual([{ message: "client.themeUpdated", level: undefined }]);
  });

  it("toasts an error instead of a success message when the save fails", async () => {
    const { handlers, toasts } = loadHandlers(false);
    handlers.setTheme("dark");
    await waitForToast(toasts);
    expect(toasts).toEqual([{ message: "client.settingsError", level: "error" }]);
  });
});

describe("setLanguage", () => {
  it("reloads the page only when the save succeeds", async () => {
    const { handlers, reloaded } = loadHandlers(true);
    handlers.setLanguage("sv");
    for (let i = 0; i < 50 && !reloaded(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(reloaded()).toBe(true);
  });

  it("toasts an error and does not reload when the save fails", async () => {
    const { handlers, toasts, reloaded } = loadHandlers(false);
    handlers.setLanguage("sv");
    await waitForToast(toasts);
    expect(toasts).toEqual([{ message: "client.settingsError", level: "error" }]);
    expect(reloaded()).toBe(false);
  });
});
