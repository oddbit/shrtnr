// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin client script's t() interpolates {param} placeholders into a
// translation string. src/i18n/index.ts's createTranslateFn() already
// guards this with a replacer function instead of a plain string, because
// String.prototype.replace treats "$&", "$`", "$'", "$1" etc. in a string
// replacement as special patterns instead of literal text. t() in
// client.ts reimplements the same interpolation client-side and needs the
// same guard, or a param value containing one of those sequences (an API
// key title, a bundle name — both free text) corrupts the rendered string.
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

function loadT(translations: Record<string, string>) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    `var T = ${JSON.stringify(translations)};`,
    extractTopLevelChunk(script, /^function t\(/),
    "return t;",
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(code) as () => (key: string, params?: Record<string, unknown>) => string;
  return factory();
}

describe("client.ts t()", () => {
  it("interpolates a plain {param} value", () => {
    const t = loadT({ greeting: "Hello {name}!" });
    expect(t("greeting", { name: "World" })).toBe("Hello World!");
  });

  it("treats interpolated values as literal text, not replacement patterns", () => {
    const t = loadT({ confirm: 'Delete "{title}"?' });
    // "$`" is a special String.replace pattern (text before the match). A
    // naive `val.replace(re, String(v))` would splice that in instead of
    // the literal value.
    expect(t("confirm", { title: "x$`y" })).toBe('Delete "x$`y"?');
  });

  it("does not collapse a literal $$ in the interpolated value", () => {
    const t = loadT({ label: "{name}" });
    expect(t("label", { name: "Q1 $$" })).toBe("Q1 $$");
  });
});
