// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import en from "../src/i18n/en";
import {
  createTranslateFn,
  detectLanguage,
  getTranslations,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from "../src/i18n";

/**
 * Every supported language except the fallback, derived once here: the key
 * and placeholder parity suites both iterate it, so a change to the default
 * language or to the exclusion rule lands in one place.
 */
const translated = SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE);

/** Sets navigator.language for one case. The global beforeEach re-pins it. */
function browserLanguage(language: string): void {
  Object.defineProperty(globalThis.navigator, "language", { configurable: true, value: language });
}

describe("i18n.createTranslateFn", () => {
  it("returns en strings for en", () => {
    const t = createTranslateFn("en");
    expect(t("brand.name")).toBe("shrtnr");
    expect(t("popup.copy")).toBe("Copy");
  });

  it("returns id strings for id", () => {
    const t = createTranslateFn("id");
    expect(t("popup.copy")).toBe("Salin");
  });

  it("returns sv strings for sv", () => {
    const t = createTranslateFn("sv");
    expect(t("popup.copy")).toBe("Kopiera");
  });

  it("returns zh strings for zh", () => {
    // "复制" only comes from the zh table: a fallback would render "Copy".
    const t = createTranslateFn("zh");
    expect(t("popup.copy")).toBe("复制");
  });

  it("falls back to en for unknown languages", () => {
    const t = createTranslateFn("xx");
    expect(t("popup.copy")).toBe("Copy");
  });

  it("interpolates {host} placeholders", () => {
    const t = createTranslateFn("en");
    expect(t("error.network", { host: "example.com" })).toContain("example.com");
  });

  it("interpolates {message} for validation errors", () => {
    const t = createTranslateFn("en");
    expect(t("error.validation", { message: "URL too long" })).toBe("URL too long");
  });

  it.each(SUPPORTED_LANGUAGES)(
    "localizes the invalid-URL error instead of passing English through (%s)",
    (lang) => {
      // error.validation is a "{message}" passthrough for server-supplied
      // text. A client-side URL parse failure must carry its own localized
      // key, in every language the extension offers.
      const text = createTranslateFn(lang)("error.invalidUrl");
      expect(text).not.toBe("error.invalidUrl");
      if (lang !== DEFAULT_LANGUAGE) expect(text).not.toBe(en["error.invalidUrl"]);
    },
  );

  it.each(SUPPORTED_LANGUAGES)("localizes the save-failure message (%s)", (lang) => {
    const text = createTranslateFn(lang)("error.saveFailed");
    expect(text).not.toBe("error.saveFailed");
    if (lang !== DEFAULT_LANGUAGE) expect(text).not.toBe(en["error.saveFailed"]);
  });

  it("returns the key itself when missing in both target and fallback", () => {
    const t = createTranslateFn("en");
    // @ts-expect-error: deliberately passing an unknown key
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});

describe("i18n key parity", () => {
  const enKeys = new Set(Object.keys(en));

  it.each(translated)("locale %s carries every key en declares", (lang) => {
    const keys = new Set(Object.keys(getTranslations(lang)));
    expect([...enKeys].filter((k) => !keys.has(k))).toEqual([]);
  });

  it.each(translated)("locale %s carries no key beyond en", (lang) => {
    const keys = new Set(Object.keys(getTranslations(lang)));
    expect([...keys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("every value is a non-empty string in every language", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [key, value] of Object.entries(getTranslations(lang))) {
        expect(typeof value, `${lang}.${key} must be a string`).toBe("string");
        expect(String(value).trim(), `${lang}.${key} must be non-empty`).not.toBe("");
      }
    }
  });

  it("placeholders match between en and translated languages", () => {
    const placeholderRe = /\{[^}]+\}/g;
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      const enPlaceholders = (en[key].match(placeholderRe) ?? []).sort();
      for (const lang of translated) {
        const value = getTranslations(lang)[key];
        expect(
          (value.match(placeholderRe) ?? []).sort(),
          `${lang}.${key} placeholders must match en`,
        ).toEqual(enPlaceholders);
      }
    }
  });

  it("every table declares its own code in _lang", () => {
    // Catches a table that was copied from another locale and never renamed.
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(getTranslations(lang)["_lang"], lang).toBe(lang);
    }
  });
});

describe("i18n.detectLanguage", () => {
  it("returns one of the supported languages", () => {
    const detected = detectLanguage();
    expect(SUPPORTED_LANGUAGES).toContain(detected);
  });

  it("reads a regional variant by its primary subtag", () => {
    for (const [reported, expected] of [
      ["en-GB", "en"],
      ["id-ID", "id"],
      ["sv-SE", "sv"],
      ["zh-CN", "zh"],
      ["zh-SG", "zh"],
      ["ZH-cn", "zh"],
    ] as const) {
      browserLanguage(reported);
      expect(detectLanguage(), reported).toBe(expected);
    }
  });

  it("resolves a Chinese script variant to Simplified", () => {
    // The extension carries one Chinese table, so a Traditional reader gets
    // Simplified rather than English. Pinned so the choice is deliberate:
    // a zh-Hant table would have to be matched before the primary subtag is
    // taken, which detectLanguage() does not do today.
    for (const reported of ["zh-TW", "zh-HK", "zh-Hant"]) {
      browserLanguage(reported);
      expect(detectLanguage(), reported).toBe("zh");
    }
  });

  it("falls back to English for a language the extension does not carry", () => {
    for (const reported of ["fr-FR", "de", "ja-JP", ""]) {
      browserLanguage(reported);
      expect(detectLanguage(), `reported ${JSON.stringify(reported)}`).toBe(DEFAULT_LANGUAGE);
    }
  });
});

describe("i18n.isSupportedLanguage", () => {
  it("accepts every supported language", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(isSupportedLanguage(lang), lang).toBe(true);
    }
  });

  it("carries exactly the languages it declares", () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(["en", "id", "sv", "zh"]);
  });

  it("rejects everything else", () => {
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage("")).toBe(false);
    expect(isSupportedLanguage("EN")).toBe(false);
    // A regional variant is not a language code of its own: detectLanguage()
    // reduces it to the primary subtag before asking.
    expect(isSupportedLanguage("zh-CN")).toBe(false);
  });
});

describe("i18n.getTranslations", () => {
  it("returns en for unknown lang", () => {
    expect(getTranslations("xx")).toBe(en);
  });
  it("returns the table the language names", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(getTranslations(lang)["_lang"], lang).toBe(lang);
    }
  });
  it("DEFAULT_LANGUAGE is en", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
  });
});
