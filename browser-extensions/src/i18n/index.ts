// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import en from "./en";
import id from "./id";
import sv from "./sv";
import zh from "./zh";
import type { TranslationKey, Translations } from "./types";

export type { TranslationKey, Translations };
export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "id", "sv", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const translations: Record<SupportedLanguage, Translations> = { en, id, sv, zh };

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * The script a table is written in, for a language written in more than one.
 * A bare "zh" table is Simplified. A Traditional table would register as
 * "zh-Hant" and need no entry here.
 */
const TABLE_SCRIPT: Partial<Record<string, string>> = { zh: "Hans" };

/** Regions whose Chinese is written in Traditional script. */
const TRADITIONAL_CHINESE_REGIONS = new Set(["TW", "HK", "MO"]);

/**
 * The script a tag's text is in, for a language written in more than one. A
 * script subtag wins. Chinese without one is Traditional in TW, HK and MO
 * and Simplified elsewhere. The rule is fixed on purpose. CLDR's likely
 * subtags send zh-US, zh-GB and others to Traditional, and they shift
 * between browser versions.
 */
function tagScript(locale: Intl.Locale): string | undefined {
  if (locale.script) return locale.script;
  if (locale.language !== "zh") return undefined;
  return locale.region && TRADITIONAL_CHINESE_REGIONS.has(locale.region) ? "Hant" : "Hans";
}

/**
 * Resolves a BCP 47 tag to a code in `supported`, or undefined when none
 * fits. A table registered by language and script ("zh-Hant") matches first.
 * A bare-language table matches when the tag's script is the table's. A tag
 * in another script matches nothing, so the reader gets the fallback instead
 * of a script they did not choose. chrome.i18n keeps zh_CN and zh_TW apart
 * the same way.
 */
export function matchLanguageTag(tag: string, supported: readonly string[]): string | undefined {
  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(tag);
  } catch {
    return undefined;
  }
  const { language } = locale;
  const script = tagScript(locale);
  if (script && supported.includes(`${language}-${script}`)) return `${language}-${script}`;
  if (!supported.includes(language)) return undefined;
  const tableScript = TABLE_SCRIPT[language];
  return tableScript && script !== tableScript ? undefined : language;
}

/**
 * The browser's language, as a supported table. Reads navigator through
 * globalThis, so this module carries no DOM types. The admin app's suite
 * imports it for the parity checks.
 */
export function detectLanguage(): SupportedLanguage {
  const nav = (globalThis as { navigator?: { language?: string } }).navigator;
  const match = matchLanguageTag(nav?.language ?? "", SUPPORTED_LANGUAGES);
  return match !== undefined && isSupportedLanguage(match) ? match : DEFAULT_LANGUAGE;
}

/**
 * The tag for <html lang>. A table written in one of several scripts names
 * it, so screen readers and Han font fallback match the strings on screen.
 */
export function documentLang(lang: string): string {
  const script = TABLE_SCRIPT[lang];
  return script ? `${lang}-${script}` : lang;
}

export function getTranslations(lang: string): Translations {
  return isSupportedLanguage(lang) ? translations[lang] : en;
}

export function createTranslateFn(lang: string): TranslateFn {
  const strings = getTranslations(lang);
  return (key, params) => {
    let value: string = strings[key] || en[key] || (key as string);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        // A replacer function, not a string: a string replacement expands
        // "$&", "$'", "$`" and "$1" in the value instead of printing them.
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), () => String(v));
      }
    }
    return value;
  };
}
