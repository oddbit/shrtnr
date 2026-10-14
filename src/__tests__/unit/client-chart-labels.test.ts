// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin client's chart x-axis labels. fmtLabel() composes a canonical
// bucket label ("YYYY-MM-DD HH" hourly, "YYYY-MM-DD" daily and weekly,
// "YYYY-MM" monthly) into the text the axis shows, and that composition is a
// locale decision: which of the month and the day comes first, what separates
// them, and whether the day or the year carries a counter.
//
// These tests cut the shipped function out of adminClientScript() and run it
// with UI_LANG set, the same way the other client.ts tests do. The chunk is
// evaluated with no t() in scope, so a version that went back to gluing
// translated month names onto day numbers throws here rather than rendering a
// wrong label.
//
// Assertions name the components that carry meaning (month, day, year) and
// the order they appear in, not the whole string: ICU punctuation has shifted
// between runtime versions. The server-side sibling, formatBucketLabel, is
// pinned the same way in big-chart.test.ts.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";
import { extractTopLevelChunk } from "../client-script";

function loadFmtLabel(lang: string) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    `var UI_LANG = ${JSON.stringify(lang)};`,
    extractTopLevelChunk(script, /^function fmtLabel\(/),
    "return fmtLabel;",
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(code) as () => (label: string, range: string) => string;
  return factory();
}

describe("client.ts fmtLabel", () => {
  it("formats an hourly bucket as the hour", () => {
    expect(loadFmtLabel("en")("2026-07-16 09", "24h")).toBe("09:00");
  });

  it("puts the month first for en", () => {
    const out = loadFmtLabel("en")("2026-07-16", "7d");
    expect(out).toContain("Jul");
    expect(out).toContain("16");
    expect(out.indexOf("16")).toBeGreaterThan(out.search(/[A-Za-z]/));
  });

  it("puts the day first for sv and id", () => {
    for (const lang of ["sv", "id"]) {
      const out = loadFmtLabel(lang)("2026-07-16", "7d");
      expect(out, `${lang} must carry the day`).toContain("16");
      expect(out.indexOf("16"), `${lang} puts the day before the month`).toBeLessThan(
        out.search(/[A-Za-z]/),
      );
    }
  });

  it("uses the Chinese month and day counter for zh", () => {
    // "日" is the day counter zh ICU appends. Gluing the translated month name
    // onto the day number produced "7月 16", which never carried one.
    const out = loadFmtLabel("zh")("2026-07-16", "7d");
    expect(out).toContain("7月");
    expect(out).toContain("16");
    expect(out).toContain("日");
    expect(out).not.toBe("7月 16");
  });

  it("spells the year out on a monthly bucket", () => {
    // The glued form rendered a two-digit year, so a zh viewer read "7月 26"
    // as the 26th of July. A two-digit year is not an option either: zh ICU
    // renders it "26年7月", which reads as the year 26.
    const out = loadFmtLabel("zh")("2026-07", "all");
    expect(out).toContain("2026");
    expect(out).toContain("7月");
    expect(out).not.toContain("NaN");
  });

  it("keeps a monthly bucket distinct from the month's first day", () => {
    // A monthly label is built on the 1st. Falling through to the daily shape
    // would render that day instead, which is the bug this pins.
    const fmt = loadFmtLabel("zh");
    expect(fmt("2026-07", "all")).not.toBe(fmt("2026-07-01", "all"));
  });

  it("treats a weekly bucket label like a daily one", () => {
    // The 1y range and a long all range bucket by week and still emit
    // YYYY-MM-DD, so the range must not pick the shape, only the label can.
    const fmt = loadFmtLabel("en");
    expect(fmt("2026-07-13", "1y")).toBe(fmt("2026-07-13", "all"));
  });

  it("renders no NaN, undefined or empty label for any bucket shape or language", () => {
    const cases: Array<[string, string]> = [
      ["2026-07-16 09", "24h"],
      ["2026-07-16", "7d"],
      ["2026-07-16", "30d"],
      ["2026-07-16", "90d"],
      ["2026-07-13", "1y"],
      ["2026-07-16", "all"],
      ["2026-07-13", "all"],
      ["2026-07", "all"],
    ];
    for (const lang of ["en", "id", "sv", "zh"]) {
      for (const [label, range] of cases) {
        const out = loadFmtLabel(lang)(label, range);
        const where = `${lang} ${range} ${label}`;
        expect(out, where).not.toContain("NaN");
        expect(out, where).not.toContain("undefined");
        expect(out.trim(), where).not.toBe("");
      }
    }
  });
});
