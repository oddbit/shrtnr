// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The browser extension carries its own i18n module, so its build and store
// release never depend on files outside browser-extensions/. The two copies
// promise the same behavior: the same language set, the same interpolation
// rules and the same <html lang> tags. This suite holds them to it. It lives
// in the root suite because the root installs everything both sides need.
import { describe, expect, it } from "vitest";
import * as admin from "../../i18n";
import * as extension from "../../../browser-extensions/src/i18n";

type Translate = (key: string, params?: Record<string, string>) => string;

// One key per side that interpolates a single parameter.
const SIDES: Array<{ name: string; t: (lang: string) => Translate; key: string; param: string }> = [
  { name: "admin", t: (lang) => admin.createTranslateFn(lang) as Translate, key: "links.searchResults", param: "count" },
  { name: "extension", t: (lang) => extension.createTranslateFn(lang) as Translate, key: "error.validation", param: "message" },
];

describe("browser extension i18n parity with the admin app", () => {
  it("carries the same set of languages", () => {
    // The extension README promises the admin app's set. Order does not count.
    expect([...extension.SUPPORTED_LANGUAGES].sort()).toEqual([...admin.SUPPORTED_LANGUAGES].sort());
    expect(extension.DEFAULT_LANGUAGE).toBe(admin.DEFAULT_LANGUAGE);
  });

  it("tags <html lang> the same way for every language", () => {
    for (const lang of admin.SUPPORTED_LANGUAGES) {
      expect(extension.documentLang(lang), lang).toBe(admin.documentLang(lang));
    }
  });

  describe.each(SIDES)("$name createTranslateFn", ({ t, key, param }) => {
    it("prints $ sequences in a parameter literally", () => {
      // A string replacement expands "$&", "$'", "$`" and "$1" instead of
      // printing them. Both copies pass a replacer function.
      for (const value of ["$&", "$'", "$`", "$1", "$$", "Invalid character '$' in slug"]) {
        expect(t("en")(key, { [param]: value })).toContain(value);
      }
    });

    it("falls back to English for an unsupported language", () => {
      expect(t("xx")(key, { [param]: "7" })).toBe(t("en")(key, { [param]: "7" }));
    });

    it("returns the key itself when no table carries it", () => {
      expect(t("en")("no.such.key")).toBe("no.such.key");
    });
  });
});
