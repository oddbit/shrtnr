// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// adminClientScript() returns the admin panel's client-side JS as a string,
// not a module we can import functions from directly. These tests extract
// the exact top-level chunks under review from that generated source (not a
// reimplementation) and evaluate them against a minimal DOM stub so a
// regression in the real shipped script is actually caught.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";

function extractTopLevelChunk(source: string, startPattern: RegExp): string {
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => startPattern.test(l));
  if (startIdx === -1) throw new Error(`chunk not found: ${startPattern}`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^(function |var |if |window\.|document\.)/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

// Mimics a browser's text-node serialization: & < > are entity-encoded on
// the way into innerHTML, quotes are not (they're only special inside an
// attribute value, not inside text content).
function fakeDocument() {
  return {
    createElement() {
      let html = "";
      return {
        set textContent(v: string) {
          html = String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        },
        get innerHTML() {
          return html;
        },
      };
    },
  };
}

function loadIconPickerFns() {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    extractTopLevelChunk(script, /^function esc\(/),
    extractTopLevelChunk(script, /^var BUNDLE_ICONS/),
    extractTopLevelChunk(script, /^function renderIconPicker\(/),
    "return { esc: esc, renderIconPicker: renderIconPicker, BUNDLE_ICONS: BUNDLE_ICONS };",
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function("document", code) as (doc: unknown) => {
    esc: (s: string) => string;
    renderIconPicker: (selected: string) => string;
    BUNDLE_ICONS: string[];
  };
  return factory(fakeDocument());
}

describe("client.ts esc()", () => {
  it("escapes double quotes so a value can't break out of a quoted attribute", () => {
    const { esc } = loadIconPickerFns();
    expect(esc('"')).toBe("&quot;");
    expect(esc('a" onmouseover="x')).toBe("a&quot; onmouseover=&quot;x");
  });

  it("still escapes markup-significant characters", () => {
    const { esc } = loadIconPickerFns();
    expect(esc("<script>")).toBe("&lt;script&gt;");
    expect(esc("a & b")).toBe("a &amp; b");
  });
});

describe("client.ts renderIconPicker()", () => {
  it("never interpolates the icon value into the onclick JS-string", () => {
    const { renderIconPicker } = loadIconPickerFns();
    const malicious = "x'); alert(document.cookie); //";
    const html = renderIconPicker(malicious);

    const onclicks = html.match(/onclick="[^"]*"/g) ?? [];
    expect(onclicks.length).toBeGreaterThan(0);
    for (const onclick of onclicks) {
      expect(onclick).toBe('onclick="selectBundleIcon(this.dataset.icon)"');
    }
  });

  it("escapes a quote in the icon value inside the data-icon attribute", () => {
    const { renderIconPicker } = loadIconPickerFns();
    const malicious = 'x" onmouseover="alert(1)';
    const html = renderIconPicker(malicious);

    expect(html).not.toContain(`data-icon="${malicious}"`);
    expect(html).toContain('data-icon="x&quot; onmouseover=&quot;alert(1)"');
  });
});
