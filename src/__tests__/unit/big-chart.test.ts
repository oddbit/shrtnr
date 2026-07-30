// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { jsx } from "hono/jsx";
import { BigChart, formatBucketLabel } from "../../components/big-chart";
import { createTranslateFn } from "../../i18n";
import type { TimelineRange } from "../../types";

const t = createTranslateFn("en");

function render(values: number[], range: TimelineRange = "30d"): string {
  return String(jsx(BigChart, { values, range, t, id: "test" }));
}

function renderWithDates(
  values: number[],
  dates: string[],
  range: TimelineRange = "30d",
): string {
  return String(jsx(BigChart, { values, range, t, id: "test", dates, lang: "en" }));
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

describe("BigChart per-point date tooltips", () => {
  it("renders a hover band with the formatted date for every point when dates are supplied", () => {
    const out = renderWithDates(
      [10, 20, 30],
      ["2026-07-14", "2026-07-15", "2026-07-16"],
    );
    // One transparent hover band per point.
    expect(out.match(/<rect[^>]*fill="transparent"/g)?.length).toBe(3);
    // Each band exposes its date through a native <title> tooltip.
    expect(out).toContain("<title>Jul 14, 2026</title>");
    expect(out).toContain("<title>Jul 15, 2026</title>");
  });

  it("marks the final point's tooltip as the in-progress period", () => {
    const out = renderWithDates([10, 20], ["2026-07-15", "2026-07-16"]);
    expect(out).toContain(`Jul 16, 2026 (${t("linkDetail.todayPartial")})`);
  });

  it("does not render hover bands when no dates are supplied", () => {
    const out = render([10, 20, 30]);
    expect(out).not.toContain('fill="transparent"');
  });

  it("ignores a dates array whose length does not match the values", () => {
    const out = renderWithDates([10, 20, 30], ["2026-07-16"]);
    expect(out).not.toContain('fill="transparent"');
  });
});

describe("formatBucketLabel", () => {
  it("formats a daily bucket with day, month, and year", () => {
    expect(formatBucketLabel("2026-07-16", "en")).toBe("Jul 16, 2026");
  });

  it("formats a monthly bucket with month and year only", () => {
    expect(formatBucketLabel("2026-07", "en")).toBe("Jul 2026");
  });

  it("formats an hourly bucket with the hour in UTC", () => {
    expect(formatBucketLabel("2026-07-16 09", "en")).toContain("Jul 16, 2026");
    expect(formatBucketLabel("2026-07-16 09", "en")).toContain("09:00");
  });
});
