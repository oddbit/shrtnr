// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The popup and options entry points tag the document with the language the
// strings on screen are in. popup.html and options.html ship lang="en".
// Without the tag, a screen reader reads Chinese labels with an English
// voice, and the browser picks the Han fallback font from the system default.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/preact";
import { setBrowserLanguage } from "./setup";

const ENTRY_POINTS = {
  popup: () => import("../src/popup/index"),
  options: () => import("../src/options/index"),
};

beforeEach(() => {
  cleanup();
  // Each entry point renders on import, so every case loads it fresh.
  vi.resetModules();
  document.documentElement.lang = "en";
  document.title = "";
  document.body.innerHTML = '<div id="root"></div>';
});

describe.each(Object.entries(ENTRY_POINTS))("%s entry point", (_name, load) => {
  it("tags <html lang> with the zh table's script when the browser reports zh-CN", async () => {
    setBrowserLanguage("zh-CN");
    await load();
    expect(document.documentElement.lang).toBe("zh-Hans");
  });

  it("keeps <html lang> English for an English browser", async () => {
    setBrowserLanguage("en-US");
    await load();
    expect(document.documentElement.lang).toBe("en");
  });

  it("tags <html lang> English for a Traditional Chinese browser, matching the English strings", async () => {
    setBrowserLanguage("zh-TW");
    await load();
    expect(document.documentElement.lang).toBe("en");
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
