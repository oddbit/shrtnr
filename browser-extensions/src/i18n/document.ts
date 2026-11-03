// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { documentLang, type SupportedLanguage } from "./index";

/**
 * Tags the document with the language its strings are in. popup.html and
 * options.html ship lang="en" and an English title, so each entry point
 * calls this before it renders. It lives apart from ./index, which stays free
 * of DOM types for the admin app's parity suite.
 */
export function applyDocumentLanguage(lang: SupportedLanguage, title?: string): void {
  document.documentElement.lang = documentLang(lang);
  if (title !== undefined) document.title = title;
}
