// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { render } from "preact";
import { Popup } from "./Popup";
import "./popup.css";
import { applyDocumentLanguage, detectLanguage } from "../i18n";

applyDocumentLanguage(detectLanguage());

const root = document.getElementById("root");
if (root) {
  render(<Popup />, root);
}
