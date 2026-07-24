// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { adminClientScript } from "../../client";
import en from "../../i18n/en";

function extractEsc(script: string): (s: string) => string {
  const match = script.match(/function esc\(s\) \{[^\n]*\}/);
  if (!match) throw new Error("esc() not found in adminClientScript output");
  return new Function(`return (${match[0]});`)() as (s: string) => string;
}

describe("adminClientScript — esc() attribute escaping", () => {
  it("escapes double quotes so attacker-controlled values cannot break out of a double-quoted HTML attribute", () => {
    const script = adminClientScript("1.0.0", en);
    const esc = extractEsc(script);
    const out = esc('foo" onmouseover="alert(1)');
    expect(out).not.toContain('"');
    expect(out).toBe("foo&quot; onmouseover=&quot;alert(1)");
  });

  it("still escapes &, <, and > as before", () => {
    const script = adminClientScript("1.0.0", en);
    const esc = extractEsc(script);
    expect(esc("<script>&</script>")).toBe("&lt;script&gt;&amp;&lt;/script&gt;");
  });
});

describe("adminClientScript — bundle icon picker", () => {
  it("does not interpolate the icon name into an inline onclick JS-string", () => {
    const script = adminClientScript("1.0.0", en);
    // Before the fix, a bundle's (attacker-controlled, free-text) icon field
    // was interpolated directly into onclick="selectBundleIcon('...')" with
    // no quote-escaping at all, since HTML entity-escaping alone cannot stop
    // a JS-string breakout inside an inline event handler.
    expect(script).not.toMatch(/onclick=.*selectBundleIcon\(/);
  });

  it("wires icon selection through a delegated data-icon click handler", () => {
    const script = adminClientScript("1.0.0", en);
    expect(script).toContain("closest('.bundle-icon-option')");
    expect(script).toContain("getAttribute('data-icon')");
    expect(script).toContain("selectBundleIcon(name)");
  });
});
