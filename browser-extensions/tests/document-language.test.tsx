// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The popup and options entry points tag the document with the language the
// strings on screen are in. popup.html and options.html ship lang="en".
// Without the tag, a screen reader reads Chinese labels with an English
// voice, and the browser picks the Han fallback font from the system default.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "preact";
import { waitFor } from "@testing-library/preact";
import { setBrowserLanguage } from "./setup";

const ENTRY_POINTS = {
  popup: () => import("../src/popup/index"),
  options: () => import("../src/options/index"),
};

// The entry points mount with preact's render(), which @testing-library's
// cleanup() does not track. A sentinel seed makes every case prove the entry
// point wrote <html lang>, including the English ones.
const UNSET = "x-unset";

beforeEach(() => {
  // Each entry point renders on import, so every case loads it fresh.
  vi.resetModules();
  document.documentElement.lang = UNSET;
  document.title = "";
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  const root = document.getElementById("root");
  if (root) render(null, root);
});

describe.each(Object.entries(ENTRY_POINTS))("%s entry point", (_name, load) => {
  it("tags <html lang> with the zh table's script when the browser reports zh-CN", async () => {
    setBrowserLanguage("zh-CN");
    await load();
    expect(document.documentElement.lang).toBe("zh-Hans");
  });

  it("tags <html lang> English for an English browser", async () => {
    setBrowserLanguage("en-US");
    await load();
    expect(document.documentElement.lang).toBe("en");
  });

  it("tags <html lang> English for a Traditional Chinese browser, matching the English strings", async () => {
    setBrowserLanguage("zh-TW");
    await load();
    expect(document.documentElement.lang).toBe("en");
  });

  it("renders its strings in the language it tagged", async () => {
    // One detection feeds both the tag and the component. Two would let them
    // disagree, which is the mismatch the tag exists to prevent.
    setBrowserLanguage("zh-CN");
    await load();
    await waitFor(() => {
      expect(document.getElementById("root")!.textContent).toContain("测试连接");
    });
    expect(document.documentElement.lang).toBe("zh-Hans");
  });
});

describe("options entry point", () => {
  it("titles the tab in the browser's language", async () => {
    // options.html hardcodes the English "shrtnr settings".
    setBrowserLanguage("zh-CN");
    await ENTRY_POINTS.options();
    expect(document.title).toBe("shrtnr 设置");
  });

  it("titles the tab in English for an English browser", async () => {
    setBrowserLanguage("en-US");
    await ENTRY_POINTS.options();
    expect(document.title).toBe("shrtnr settings");
  });
});
