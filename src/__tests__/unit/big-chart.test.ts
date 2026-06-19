// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { jsx } from "hono/jsx";
import { BigChart } from "../../components/big-chart";
import { createTranslateFn } from "../../i18n";
import type { TimelineRange } from "../../types";

const t = createTranslateFn("en");

function render(values: number[], range: TimelineRange = "30d"): string {
  return String(jsx(BigChart, { values, range, t, id: "test" }));
}

describe("BigChart incomplete-period treatment", () => {
  it("draws the final segment dashed so the partial current period does not read as a real drop", () => {
    const out = render([10, 20, 30, 40, 5]);
    expect(out).toContain("stroke-dasharray");
  });

  it("flags the final point as in-progress via an accessible title", () => {
    const out = render([10, 20, 30, 40, 5]);
    expect(out).toContain(t("linkDetail.todayPartial"));
  });

  it("still labels the final point as today", () => {
    const out = render([10, 20, 30, 40, 5]);
    expect(out).toContain(">today<");
  });

  it("does not draw a dashed connector when there is only one point", () => {
    const out = render([7]);
    expect(out).not.toContain("stroke-dasharray");
    // The lone point is still the current, incomplete period.
    expect(out).toContain(t("linkDetail.todayPartial"));
  });

  it("omits the gradient area when only one period is complete", () => {
    // n === 2: a single completed period plus the in-progress point. With one
    // completed point there is no segment to fill under, so the area would be a
    // zero-width degenerate path; render nothing and let the dashed connector
    // carry the in-progress point.
    const out = render([10, 20]);
    expect(out).not.toContain("url(#test-grad)");
    expect(out).toContain("stroke-dasharray");
  });

  it("fills the gradient area once at least two periods are complete", () => {
    const out = render([10, 20, 30]);
    expect(out).toContain("url(#test-grad)");
  });

  it("renders the empty-state hint when there are no values", () => {
    const out = render([]);
    expect(out).toContain(t("linkDetail.noClickData"));
    expect(out).not.toContain("stroke-dasharray");
  });
});
