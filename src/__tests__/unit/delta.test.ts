// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { jsx } from "hono/jsx";
import { Delta } from "../../components/delta";

function render(props: { pct: number; lang: string }): string {
  return String(jsx(Delta, props));
}

describe("Delta component", () => {
  it("renders +1,400% for an en delta of 1400", () => {
    const out = render({ pct: 1400, lang: "en" });
    expect(out).toContain("+1,400%");
    expect(out).toContain("delta up");
    expect(out).toContain("trending_up");
  });

  it("normalizes -0 to 0 so the flat delta does not render -0%", () => {
    // Math.round(((99.9 - 100) / 100) * 100) === -0, which Intl.NumberFormat
    // would otherwise render as "-0".
    const out = render({ pct: -0, lang: "en" });
    expect(out).toContain(">0%<");
    expect(out).not.toContain("-0%");
    expect(out).not.toContain("−0%");
    expect(out).toContain("delta flat");
    expect(out).toContain("trending_flat");
  });

  it("groups thousands using the active locale", () => {
    expect(render({ pct: 1400, lang: "id" })).toContain("+1.400%");
  });

  it("renders a negative delta with a minus and the down direction", () => {
    const out = render({ pct: -25, lang: "en" });
    expect(out).toContain("-25%");
    expect(out).toContain("delta down");
    expect(out).toContain("trending_down");
  });
});
