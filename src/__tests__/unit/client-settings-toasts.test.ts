// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// setTheme() used to toast "Theme updated" unconditionally, regardless of
// whether the PUT to /settings actually succeeded — unlike every sibling
// settings setter (setDefaultRange, saveSettings, setFilterBots,
// setFilterSelfReferrers), which all check res.ok before deciding which
// toast to show. This extracts the real handler from the generated script
// and drives it against both a success and a failure response to prove the
// toast now reflects the actual outcome.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";

function extractTopLevelChunk(source: string, startPattern: RegExp): string {
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => startPattern.test(l));
  if (startIdx === -1) throw new Error(`chunk not found: ${startPattern}`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^(function |var |if |window\.|document\.)/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

type ToastCall = { message: string; level?: string };

function loadSetTheme(ok: boolean) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    extractTopLevelChunk(script, /^function applyTheme\(/),
    extractTopLevelChunk(script, /^function setTheme\(/),
    "return { setTheme: setTheme };",
  ].join("\n");

  const toasts: ToastCall[] = [];
  const fakeDocument = {
    documentElement: { setAttribute: () => {} },
    querySelectorAll: () => [],
    cookie: "",
  };
  const factory = new Function("api", "toast", "t", "document", code) as (
    ...args: unknown[]
  ) => { setTheme: (theme: string) => void };

  const handlers = factory(
    () => Promise.resolve({ ok }),
    (message: string, level?: string) => {
      toasts.push({ message, level });
    },
    (key: string) => key,
    fakeDocument,
  );
  return { handlers, toasts };
}

async function waitForToast(toasts: ToastCall[]) {
  for (let i = 0; i < 50 && toasts.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("setTheme", () => {
  it("toasts success only when the save actually succeeds", async () => {
    const { handlers, toasts } = loadSetTheme(true);
    handlers.setTheme("dark");
    await waitForToast(toasts);
    expect(toasts).toEqual([{ message: "client.themeUpdated", level: undefined }]);
  });

  it("toasts an error instead of a success message when the save fails", async () => {
    const { handlers, toasts } = loadSetTheme(false);
    handlers.setTheme("dark");
    await waitForToast(toasts);
    expect(toasts).toEqual([{ message: "client.settingsError", level: "error" }]);
  });
});
