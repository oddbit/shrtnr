// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { render } from "preact";
import { Options } from "./Options";
import "./options.css";
import { createTranslateFn, detectLanguage } from "../i18n";
import { applyDocumentLanguage } from "../i18n/document";

// One detection feeds <html lang>, the tab title and the strings on screen.
const lang = detectLanguage();
applyDocumentLanguage(lang, createTranslateFn(lang)("options.title"));

const root = document.getElementById("root");
if (root) {
  render(<Options lang={lang} />, root);
}
