// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { TranslationKey, Translations } from "./types";
import en from "./en";
import id from "./id";
import sv from "./sv";

export type { TranslationKey, Translations };
export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "id", "sv"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const translations: Record<string, Translations> = { en, id, sv };

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export function getTranslations(lang: string): Translations {
  if (isSupportedLanguage(lang)) return translations[lang];
  return en;
}

export function createTranslateFn(lang: string): TranslateFn {
  const strings = getTranslations(lang);
  const fallback = en;

  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let value = strings[key] || fallback[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return value;
  };
}
