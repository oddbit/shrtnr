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
 * The browser's language decides, by its primary subtag: "zh-CN", "zh-SG" and
 * "zh-Hans" all resolve to "zh". A script variant this set does not carry,
 * "zh-TW" or "zh-HK", also resolves to "zh" and reads the Simplified table.
 * A Traditional locale would need its own entry here and would have to be
 * matched before the primary subtag is taken, which this does not do.
 */
export function detectLanguage(): SupportedLanguage {
  const raw = typeof navigator !== "undefined" ? (navigator.language || "en") : "en";
  const primary = raw.split("-")[0]?.toLowerCase() ?? "en";
  return isSupportedLanguage(primary) ? primary : DEFAULT_LANGUAGE;
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
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return value;
  };
}
