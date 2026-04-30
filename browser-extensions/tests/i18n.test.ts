// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import en from "../src/i18n/en";
import id from "../src/i18n/id";
import sv from "../src/i18n/sv";
import {
  createTranslateFn,
  detectLanguage,
  getTranslations,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from "../src/i18n";

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

  it("returns the key itself when missing in both target and fallback", () => {
    const t = createTranslateFn("en");
    // @ts-expect-error: deliberately passing an unknown key
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});

describe("i18n key parity", () => {
  it("every en key exists in id", () => {
    const enKeys = Object.keys(en);
    const idKeys = new Set(Object.keys(id));
    const missing = enKeys.filter((k) => !idKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("every en key exists in sv", () => {
    const enKeys = Object.keys(en);
    const svKeys = new Set(Object.keys(sv));
    const missing = enKeys.filter((k) => !svKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("id and sv have no extra keys beyond en", () => {
    const enKeys = new Set(Object.keys(en));
    expect(Object.keys(id).filter((k) => !enKeys.has(k))).toEqual([]);
    expect(Object.keys(sv).filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("every value is a non-empty string in every language", () => {
    for (const [lang, table] of Object.entries({ en, id, sv })) {
      for (const [key, value] of Object.entries(table)) {
        expect(typeof value, `${lang}.${key} must be a string`).toBe("string");
        expect(String(value).trim(), `${lang}.${key} must be non-empty`).not.toBe("");
      }
    }
  });

  it("placeholders match between en and translated languages", () => {
    const placeholderRe = /\{[^}]+\}/g;
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      const enValue = en[key];
      const idValue = id[key];
      const svValue = sv[key];
      const enPlaceholders = (enValue.match(placeholderRe) ?? []).sort();
      const idPlaceholders = (idValue.match(placeholderRe) ?? []).sort();
      const svPlaceholders = (svValue.match(placeholderRe) ?? []).sort();
      expect(idPlaceholders, `id.${key} placeholders must match en`).toEqual(enPlaceholders);
      expect(svPlaceholders, `sv.${key} placeholders must match en`).toEqual(enPlaceholders);
    }
  });
});

describe("i18n.detectLanguage", () => {
  it("returns one of the supported languages", () => {
    const detected = detectLanguage();
    expect(SUPPORTED_LANGUAGES).toContain(detected);
  });
});

describe("i18n.isSupportedLanguage", () => {
  it("accepts en, id, sv", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("id")).toBe(true);
    expect(isSupportedLanguage("sv")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage("")).toBe(false);
    expect(isSupportedLanguage("EN")).toBe(false);
  });
});

describe("i18n.getTranslations", () => {
  it("returns en for unknown lang", () => {
    expect(getTranslations("xx")).toBe(en);
  });
  it("returns id for id", () => {
    expect(getTranslations("id")).toBe(id);
  });
  it("DEFAULT_LANGUAGE is en", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
  });
});
