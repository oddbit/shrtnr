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
    const dates = ["2026-07-14", "2026-07-15", "2026-07-16"];
    const out = renderWithDates([10, 20, 30], dates);
    // One transparent hover band per point.
    expect(out.match(/<rect[^>]*fill="transparent"/g)?.length).toBe(3);
    // Each band exposes its date through a native <title> tooltip. Expected text
    // comes from the formatter, so an ICU version that punctuates dates
    // differently cannot fail this test; formatBucketLabel pins its own output
    // in the describe block below.
    expect(out).toContain(`<title>${formatBucketLabel(dates[0], "en")}</title>`);
    expect(out).toContain(`<title>${formatBucketLabel(dates[1], "en")}</title>`);
  });

  it("marks the final point's tooltip as the in-progress period", () => {
    const out = renderWithDates([10, 20], ["2026-07-15", "2026-07-16"]);
    expect(out).toContain(
      `${formatBucketLabel("2026-07-16", "en")} (${t("linkDetail.todayPartial")})`,
    );
    // Only the final point is annotated; earlier bands carry a bare date.
    expect(out).toContain(`<title>${formatBucketLabel("2026-07-15", "en")}</title>`);
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

// These assert the components that carry meaning: month name, day, year, and
// granularity. Ordering and punctuation come from ICU and have shifted between
// runtime versions, so full-string equality would fail on a Node upgrade while
// the behavior stayed correct. A wrong month index and a wrong granularity
// branch both still fail these checks (verified by mutating the source).
// `timeZone: "UTC"` is not covered: the workers pool runs in UTC, so UTC and
// local formatting coincide here. It stays load-bearing in the browser, where
// client.ts renders the same labels against the viewer's zone.
describe("formatBucketLabel", () => {
  it("formats a daily bucket with day, month, and year", () => {
    const out = formatBucketLabel("2026-07-16", "en");
    expect(out).toContain("Jul");
    expect(out).toContain("16");
    expect(out).toContain("2026");
    // No time component on a daily bucket.
    expect(out).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats a monthly bucket with month and year only", () => {
    const out = formatBucketLabel("2026-07", "en");
    expect(out).toContain("Jul");
    expect(out).toContain("2026");
    // A monthly bucket is built on the 1st. Falling through to the daily branch
    // would render that day, so the two labels must not match.
    expect(out).not.toBe(formatBucketLabel("2026-07-01", "en"));
  });

  it("formats an hourly bucket with the hour in UTC", () => {
    const out = formatBucketLabel("2026-07-16 09", "en");
    expect(out).toContain("Jul");
    expect(out).toContain("16");
    expect(out).toContain("2026");
    expect(out).toContain("09:00");
  });
});
