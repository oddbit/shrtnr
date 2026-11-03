// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { render } from "preact";
import { Options } from "./Options";
import "./options.css";
import { applyDocumentLanguage, createTranslateFn, detectLanguage } from "../i18n";

const lang = detectLanguage();
applyDocumentLanguage(lang, createTranslateFn(lang)("options.title"));

const root = document.getElementById("root");
if (root) {
  render(<Options />, root);
}
