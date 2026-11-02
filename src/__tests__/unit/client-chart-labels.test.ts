// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin client's chart x-axis labels. A canonical bucket label
// ("YYYY-MM-DD HH" hourly, "YYYY-MM-DD" daily and weekly, "YYYY-MM" monthly)
// becomes the text the axis shows. Which of the month and the day comes first,
// what separates them, and whether the day or the year carries a counter are
// locale decisions.
//
// These tests cut the shipped functions out of adminClientScript() and run
// them with UI_LANG set, the same way the other client.ts tests do. The chunk
// runs with no t() in scope, so a version that went back to gluing translated
// month names onto day numbers throws here instead of rendering a wrong label.
//
// Assertions name the components that carry meaning (month, day, year, hour)
// and their order, not the whole string: ICU punctuation has shifted between
// runtime versions. The server-side sibling, formatBucketLabel, is pinned the
// same way in big-chart.test.ts.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import type { Translations } from "../../i18n/types";
import { extractTopLevelChunk } from "../client-script";

type AxisLabel = { x: number; text: string };
type ChartLabels = {
  fmtLabel: (label: string, withYear?: boolean) => string;
  fmtBucketDate: (label: string) => string;
  axisLabels: (
    buckets: Array<{ label: string }>,
    xs: number[],
    dotInterval: number,
    todayText: string,
  ) => AxisLabel[];
};

const CHUNKS = [
  /^function bucketDate\(/,
  /^var BUCKET_FORMATS = /,
  /^function fmtLabel\(/,
  /^function fmtBucketDate\(/,
  /^function labelWidth\(/,
  /^function labelsOverlap\(/,
  /^function axisLabels\(/,
];

function loadChartLabels(lang: string): ChartLabels {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    `var UI_LANG = ${JSON.stringify(lang)};`,
    ...CHUNKS.map((re) => extractTopLevelChunk(script, re)),
    "return { fmtLabel: fmtLabel, fmtBucketDate: fmtBucketDate, axisLabels: axisLabels };",
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return (new Function(code) as () => ChartLabels)();
}

const TODAY = "Today";

// The x positions renderTimeline() gives n points on its 800-wide viewBox.
function chartXs(n: number): number[] {
  const padL = 36;
  const innerW = 800 - 36 - 8;
  return Array.from({ length: n }, (_, i) => padL + (i * innerW) / (n - 1));
}

// renderTimeline()'s label spacing for n buckets.
function dotInterval(n: number): number {
  return n > 60 ? Math.ceil(n / 10) : n > 30 ? 5 : n > 14 ? 3 : 1;
}

function weeklyBuckets(startUtc: number, count: number): Array<{ label: string }> {
  return Array.from({ length: count }, (_, i) => ({
    label: new Date(startUtc + i * 7 * 86_400_000).toISOString().slice(0, 10),
  }));
}

function monthlyBuckets(year: number, month: number, count: number): Array<{ label: string }> {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 + i, 1));
    return { label: d.toISOString().slice(0, 7) };
  });
}

const charts = new Map(SUPPORTED_LANGUAGES.map((lang) => [lang, loadChartLabels(lang)]));
function chart(lang: (typeof SUPPORTED_LANGUAGES)[number]): ChartLabels {
  return charts.get(lang)!;
}

describe("client.ts fmtLabel", () => {
  it("formats an hourly bucket as the same time the tooltip shows, in every language", () => {
    // The axis glued "HH:00" while the tooltip used the locale's clock: en
    // read 09:00 on the axis and 09:00 AM in the tooltip, id 09:00 and 09.00.
    for (const lang of SUPPORTED_LANGUAGES) {
      const { fmtLabel, fmtBucketDate } = chart(lang);
      const axis = fmtLabel("2026-07-16 09");
      expect(axis, lang).toContain("09");
      expect(fmtBucketDate("2026-07-16 09"), lang).toContain(axis);
    }
  });

  it("picks the hourly format from the label's shape, not the range", () => {
    // fmtLabel takes no range: an hourly label outside the 24h range must not
    // parse "16 09" as a day number.
    const axis = chart("en").fmtLabel("2026-07-16 09");
    expect(axis).not.toContain("Jul");
    expect(axis).not.toContain("16");
  });

  it("puts the month first for en", () => {
    const out = chart("en").fmtLabel("2026-07-16");
    expect(out).toContain("Jul");
    expect(out).toContain("16");
    expect(out.indexOf("16")).toBeGreaterThan(out.search(/[A-Za-z]/));
  });

  it("puts the day first for sv and id", () => {
    for (const lang of ["sv", "id"] as const) {
      const out = chart(lang).fmtLabel("2026-07-16");
      expect(out, `${lang} must carry the day`).toContain("16");
      expect(out.indexOf("16"), `${lang} puts the day before the month`).toBeLessThan(
        out.search(/[A-Za-z]/),
      );
    }
  });

  it("uses the Chinese month and day counter for zh", () => {
    // "日" is the day counter zh ICU appends. Gluing the translated month name
    // onto the day number produced "7月 16", which never carried one.
    const out = chart("zh").fmtLabel("2026-07-16");
    expect(out).toContain("7月");
    expect(out).toContain("16");
    expect(out).toContain("日");
    expect(out).not.toBe("7月 16");
  });

  it("spells the year out on a monthly bucket", () => {
    // The glued form rendered a two-digit year, so a zh viewer read "7月 26"
    // as the 26th of July. A two-digit year is not an option either: zh ICU
    // renders it "26年7月", which reads as the year 26.
    const out = chart("zh").fmtLabel("2026-07");
    expect(out).toContain("2026");
    expect(out).toContain("7月");
    expect(out).not.toContain("NaN");
  });

  it("keeps a monthly bucket distinct from the month's first day", () => {
    // A monthly label is built on the 1st. Falling through to the daily shape
    // would render that day instead, which is the bug this pins.
    const { fmtLabel } = chart("zh");
    expect(fmtLabel("2026-07")).not.toBe(fmtLabel("2026-07-01"));
  });

  it("shows the month and day of a weekly bucket", () => {
    // The 1y range and a long all range bucket by week and emit YYYY-MM-DD,
    // the same shape as a daily bucket. The label must show the week's day,
    // not collapse to the month.
    const out = chart("en").fmtLabel("2026-07-13");
    expect(out).toContain("Jul");
    expect(out).toContain("13");
    expect(out).not.toContain("2026");
  });

  it("adds the year to a daily label on request", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const { fmtLabel } = chart(lang);
      expect(fmtLabel("2025-10-20", true), lang).toContain("2025");
      expect(fmtLabel("2025-10-20", true), lang).toContain("20");
      expect(fmtLabel("2025-10-20", false), lang).not.toContain("2025");
    }
  });

  it("renders no NaN, undefined or empty label for any bucket shape or language", () => {
    const labels = ["2026-07-16 09", "2026-07-16", "2026-07-13", "2026-07"];
    for (const lang of SUPPORTED_LANGUAGES) {
      const { fmtLabel, fmtBucketDate } = chart(lang);
      for (const label of labels) {
        for (const out of [fmtLabel(label), fmtLabel(label, true), fmtBucketDate(label)]) {
          const where = `${lang} ${label}`;
          expect(out, where).not.toContain("NaN");
          expect(out, where).not.toContain("undefined");
          expect(out.trim(), where).not.toBe("");
        }
      }
    }
  });
});

describe("client.ts axisLabels", () => {
  it("ends on the today label", () => {
    const buckets = weeklyBuckets(Date.UTC(2026, 0, 5), 10);
    const labels = chart("en").axisLabels(buckets, chartXs(10), 1, TODAY);
    expect(labels.at(-1)).toEqual({ x: chartXs(10)[9], text: TODAY });
  });

  it("marks the year where a weekly axis crosses into a new one", () => {
    // 1y range on 2026-10-20: 53 weekly buckets from 2025-10-20. Without a
    // year, "Oct 20" (2025) and "Oct 5" (2026) on the same axis read as the
    // same October.
    const n = 53;
    const buckets = weeklyBuckets(Date.UTC(2025, 9, 20), n);
    for (const lang of SUPPORTED_LANGUAGES) {
      const labels = chart(lang).axisLabels(buckets, chartXs(n), dotInterval(n), TODAY);
      const dated = labels.slice(0, -1);
      const withYear = dated.filter((l) => /20\d\d/.test(l.text));
      expect(withYear.length, lang).toBe(2);
      expect(dated[0].text, `${lang} first label`).toContain("2025");
      const firstIn2026 = dated.findIndex((l) => l.text.includes("2026"));
      expect(firstIn2026, lang).toBeGreaterThan(0);
      expect(dated.slice(firstIn2026 + 1).some((l) => /20\d\d/.test(l.text)), lang).toBe(false);
    }
  });

  it("marks the year where a daily axis crosses into a new one", () => {
    // 30d range on 2026-01-10: daily buckets from 2025-12-12.
    const n = 30;
    const buckets = Array.from({ length: n }, (_, i) => ({
      label: new Date(Date.UTC(2025, 11, 12) + i * 86_400_000).toISOString().slice(0, 10),
    }));
    const labels = chart("en").axisLabels(buckets, chartXs(n), dotInterval(n), TODAY);
    expect(labels[0].text).toContain("2025");
    expect(labels.some((l) => l.text.includes("2026"))).toBe(true);
  });

  it("leaves the year off an axis inside one year", () => {
    const n = 30;
    const buckets = Array.from({ length: n }, (_, i) => ({
      label: new Date(Date.UTC(2026, 5, 1) + i * 86_400_000).toISOString().slice(0, 10),
    }));
    for (const lang of SUPPORTED_LANGUAGES) {
      const labels = chart(lang).axisLabels(buckets, chartXs(n), dotInterval(n), TODAY);
      expect(labels.every((l) => !l.text.includes("2026")), lang).toBe(true);
    }
  });

  it("drops the label that would collide with the today label", () => {
    // all range with 26 monthly buckets: labels at 0, 3, ..., 24 and today at
    // 25. Bucket 24 sits 30 units from today, and "Sep 2026" (en), "2026年9月"
    // (zh) and "sep. 2026" (sv) are too wide to share that gap with "Today".
    const n = 26;
    const xs = chartXs(n);
    const buckets = monthlyBuckets(2024, 8, n);
    for (const lang of SUPPORTED_LANGUAGES) {
      const labels = chart(lang).axisLabels(buckets, xs, dotInterval(n), TODAY);
      expect(labels.at(-1)!.text, lang).toBe(TODAY);
      expect(labels.at(-2)!.x, `${lang} keeps bucket 21, drops 24`).toBe(xs[21]);
      expect(labels.length, lang).toBe(9);
    }
  });

  it("keeps every label when today sits a full interval from its neighbor", () => {
    // 25 monthly buckets: today lands on index 24, three steps after 21.
    const n = 25;
    const xs = chartXs(n);
    const labels = chart("en").axisLabels(monthlyBuckets(2024, 8, n), xs, dotInterval(n), TODAY);
    expect(labels.map((l) => l.x)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24].map((i) => xs[i]));
  });
});
