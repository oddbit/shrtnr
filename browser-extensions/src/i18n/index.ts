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
 * The script a table is written in, for languages written in more than one.
 * A browser tag whose likely script differs falls back to English instead of
 * crossing scripts, the way chrome.i18n keeps zh_CN and zh_TW apart.
 */
const TABLE_SCRIPT: Partial<Record<SupportedLanguage, string>> = { zh: "Hans" };

/**
 * The browser's language, as a supported table. Intl.Locale#maximize()
 * supplies the script a tag implies: zh-CN and zh-SG write Hans, while zh-TW,
 * zh-HK and zh-MO write Hant. zh-Hans-HK names its script and reads
 * Simplified. A Traditional table would register as its own language and be
 * matched on language and script before this check.
 */
export function detectLanguage(): SupportedLanguage {
  const raw = typeof navigator !== "undefined" ? navigator.language || "" : "";
  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(raw).maximize();
  } catch {
    return DEFAULT_LANGUAGE;
  }
  const lang = locale.language;
  if (!isSupportedLanguage(lang)) return DEFAULT_LANGUAGE;
  const script = TABLE_SCRIPT[lang];
  return script && locale.script !== script ? DEFAULT_LANGUAGE : lang;
}

/**
 * The tag for <html lang>. A table written in one of several scripts names
 * it, so screen readers and Han font fallback match the strings on screen.
 */
export function documentLang(lang: SupportedLanguage): string {
  const script = TABLE_SCRIPT[lang];
  return script ? `${lang}-${script}` : lang;
}

/**
 * Tags the document with the language its strings are in. popup.html and
 * options.html ship lang="en" and an English title, so each entry point
 * calls this before it renders.
 */
export function applyDocumentLanguage(lang: SupportedLanguage, title?: string): void {
  document.documentElement.lang = documentLang(lang);
  if (title !== undefined) document.title = title;
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
