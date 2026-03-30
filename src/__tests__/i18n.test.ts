import { describe, expect, it } from "vitest";
import {
  createTranslateFn,
  getTranslations,
  isSupportedLanguage,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from "../i18n";
import en from "../i18n/en";

describe("i18n", () => {
  describe("isSupportedLanguage", () => {
    it("returns true for supported languages", () => {
      expect(isSupportedLanguage("en")).toBe(true);
      expect(isSupportedLanguage("id")).toBe(true);
      expect(isSupportedLanguage("sv")).toBe(true);
    });

    it("returns false for unsupported languages", () => {
      expect(isSupportedLanguage("fr")).toBe(false);
      expect(isSupportedLanguage("")).toBe(false);
      expect(isSupportedLanguage("EN")).toBe(false);
    });
  });

  describe("getTranslations", () => {
    it("returns English translations for 'en'", () => {
      const t = getTranslations("en");
      expect(t["nav.dashboard"]).toBe("Dashboard");
    });

    it("returns Indonesian translations for 'id'", () => {
      const t = getTranslations("id");
      expect(t["nav.dashboard"]).toBe("Dasbor");
    });

    it("returns Swedish translations for 'sv'", () => {
      const t = getTranslations("sv");
      expect(t["nav.dashboard"]).toBe("Översikt");
    });

    it("falls back to English for unsupported language", () => {
      const t = getTranslations("fr");
      expect(t["nav.dashboard"]).toBe("Dashboard");
    });
  });

  describe("createTranslateFn", () => {
    it("returns translated string for the given language", () => {
      const t = createTranslateFn("id");
      expect(t("dashboard.title")).toBe("Dasbor");
    });

    it("falls back to English for unsupported language code", () => {
      const t = createTranslateFn("xx");
      expect(t("dashboard.title")).toBe("Dashboard");
    });

    it("interpolates parameters with {param} syntax", () => {
      const t = createTranslateFn("en");
      expect(t("settings.combos", { count: "1,000" })).toBe(
        "1,000 possible combinations",
      );
    });

    it("interpolates multiple parameters", () => {
      const t = createTranslateFn("en");
      expect(t("client.confirmDeleteKey", { title: "My Key" })).toBe(
        'Delete API key "My Key"? This cannot be undone.',
      );
    });

    it("returns the key itself when no translation exists", () => {
      // Simulate a missing key by casting
      const t = createTranslateFn("en");
      const result = t("nonexistent.key" as any);
      expect(result).toBe("nonexistent.key");
    });

    it("translates all English keys without gaps", () => {
      const t = createTranslateFn("en");
      for (const key of Object.keys(en)) {
        const val = t(key as any);
        expect(val).not.toBe(key);
      }
    });

    it("every supported language covers all English keys", () => {
      const enKeys = Object.keys(en);
      for (const lang of SUPPORTED_LANGUAGES) {
        const translations = getTranslations(lang);
        for (const key of enKeys) {
          expect(translations[key as keyof typeof translations], `Missing '${key}' in '${lang}'`).toBeTruthy();
        }
      }
    });
  });

  describe("constants", () => {
    it("has 'en' as default language", () => {
      expect(DEFAULT_LANGUAGE).toBe("en");
    });

    it("lists all supported languages", () => {
      expect(SUPPORTED_LANGUAGES).toContain("en");
      expect(SUPPORTED_LANGUAGES).toContain("id");
      expect(SUPPORTED_LANGUAGES).toContain("sv");
    });
  });

  describe("language metadata keys", () => {
    it("each language has a _lang key matching its code", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        const translations = getTranslations(lang);
        expect(translations["_lang"]).toBe(lang);
      }
    });

    it("native language names are the same across all locales", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        const translations = getTranslations(lang);
        expect(translations["lang.en"]).toBe("English");
        expect(translations["lang.id"]).toBe("Bahasa Indonesia");
        expect(translations["lang.sv"]).toBe("Svenska");
      }
    });

    it("localized language names differ per locale", () => {
      const en = getTranslations("en");
      const id = getTranslations("id");
      const sv = getTranslations("sv");

      expect(en["langLocal.id"]).toBe("Indonesian");
      expect(id["langLocal.id"]).toBe("Indonesia");
      expect(sv["langLocal.id"]).toBe("Indonesiska");

      expect(en["langLocal.sv"]).toBe("Swedish");
      expect(id["langLocal.sv"]).toBe("Swedia");
      expect(sv["langLocal.sv"]).toBe("Svenska");
    });
  });
});
