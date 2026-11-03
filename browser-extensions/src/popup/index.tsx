// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { render } from "preact";
import { Popup } from "./Popup";
import "./popup.css";
import { detectLanguage } from "../i18n";
import { applyDocumentLanguage } from "../i18n/document";

// One detection feeds both <html lang> and the strings on screen.
const lang = detectLanguage();
applyDocumentLanguage(lang);

const root = document.getElementById("root");
if (root) {
  render(<Popup lang={lang} />, root);
}
