// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin client's chart x-axis labels. A canonical bucket label becomes
// the text the axis shows: "YYYY-MM-DD HH" hourly, "YYYY-MM-DD" daily and
// weekly, "YYYY-MM" monthly. The locale decides the order of month and day.
// It also decides the separator and any counters.
//
// These tests cut the shipped code out of adminClientScript() for each
// language. The script embeds that language's translation table, so t() and
// UI_LANG come from the real wiring. Chart tests run the real renderTimeline()
// and read the SVG it writes. Its geometry and label cadence stay private.
//
// Assertions name the components that carry meaning (month, day, year, hour)
// and their order, not the whole string. ICU punctuation has shifted between
// runtime versions. The server-side formatBucketLabel is pinned the same way
// in big-chart.test.ts.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import { getTranslations, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../../i18n";
import { extractTopLevelChunk } from "../client-script";

type Bucket = { label: string; count: number };
type AxisLabel = { i: number; x: number; text: string };
type Chart = {
  fmtLabel: (label: string, withYear?: boolean) => string;
  fmtBucketDate: (label: string) => string;
  axisLabels: (buckets: Bucket[], pts: number[][], dotInterval: number, todayText: string) => AxisLabel[];
  render: (buckets: Bucket[]) => string;
  formattersBuilt: () => number;
};

const CHUNKS = [
  /^var T = /,
  /^function t\(/,
  /^var UI_LANG = /,
  /^function fmtNum\(/,
  /^function niceStep\(/,
  /^function bucketDate\(/,
  /^var bucketFormatCache = /,
  /^function bucketFormats\(/,
  /^function fmtLabel\(/,
  /^function fmtBucketDate\(/,
  /^var AXIS_FONT_SIZE = /,
  /^function labelWidth\(/,
  /^function labelsOverlap\(/,
  /^function axisLabels\(/,
  /^function renderTimeline\(/,
];

// The real esc() and getElementById() need a DOM. These stand-ins escape the
// same characters and hand renderTimeline() a container to write into. The
// Intl stand-in counts the formatters the script builds.
const HARNESS = `
var built = 0;
var Intl = { DateTimeFormat: function(lang, opts) { built++; return new globalThis.Intl.DateTimeFormat(lang, opts); } };
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
var container = { innerHTML: '' };
var document = { getElementById: function() { return container; } };
`;

function loadChart(lang: SupportedLanguage): Chart {
  const script = adminClientScript("1.0.0", getTranslations(lang));
  const code = [
    HARNESS,
    ...CHUNKS.map((re) => extractTopLevelChunk(script, re)),
    `return {
      fmtLabel: fmtLabel,
      fmtBucketDate: fmtBucketDate,
      axisLabels: axisLabels,
      render: function(buckets) { renderTimeline({ buckets: buckets }); return container.innerHTML; },
      formattersBuilt: function() { return built; }
    };`,
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return (new Function(code) as () => Chart)();
}

const charts = new Map(SUPPORTED_LANGUAGES.map((lang) => [lang, loadChart(lang)]));
function chart(lang: SupportedLanguage): Chart {
  return charts.get(lang)!;
}

function today(lang: SupportedLanguage): string {
  return getTranslations(lang)["linkDetail.today"];
}

const DAY = 86_400_000;

function dailyBuckets(startUtc: number, count: number, stepDays = 1): Bucket[] {
  return Array.from({ length: count }, (_, i) => ({
    label: new Date(startUtc + i * stepDays * DAY).toISOString().slice(0, 10),
    count: i % 4,
  }));
}

function monthlyBuckets(year: number, month: number, count: number): Bucket[] {
  return Array.from({ length: count }, (_, i) => ({
    label: new Date(Date.UTC(year, month - 1 + i, 1)).toISOString().slice(0, 7),
    count: i % 4,
  }));
}

// The x-axis labels and the emphasized dots renderTimeline() drew.
function readAxis(svg: string): { labels: Array<{ x: number; text: string }>; dots: number[] } {
  const labels = [...svg.matchAll(/<text x="([\d.]+)" [^>]*text-anchor="middle"[^>]*>([^<]*)<\/text>/g)].map(
    (m) => ({ x: Number(m[1]), text: m[2] }),
  );
  const dots = [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1]));
  return { labels, dots };
}

describe("client.ts fmtLabel", () => {
  it("formats an hourly bucket as the time the tooltip shows, in every language", () => {
    // The axis glued "HH:00" while the tooltip used the locale's clock. en
    // read 09:00 on the axis and 09:00 AM in the tooltip. id read 09:00
    // against 09.00.
    for (const lang of SUPPORTED_LANGUAGES) {
      const { fmtLabel, fmtBucketDate } = chart(lang);
      for (const label of ["2026-07-16 09", "2026-07-16 13"]) {
        expect(fmtBucketDate(label), `${lang} ${label}`).toContain(fmtLabel(label));
      }
    }
  });

  it("writes the hour in the locale's own form, without a forced leading zero", () => {
    // hour: '2-digit' rendered en as "01:00 PM", which no en reader writes.
    const en = chart("en").fmtLabel("2026-07-16 13");
    expect(en).toContain("1:00");
    expect(en).not.toMatch(/^0/);
    expect(chart("id").fmtLabel("2026-07-16 09")).toContain("9.00");
    expect(chart("sv").fmtLabel("2026-07-16 13")).toContain("13:00");
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
    // the same shape as a daily bucket. The label must show the week's day.
    // It must not collapse to the month.
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

  it("shows a label in no known shape as it arrived instead of throwing", () => {
    // Intl.DateTimeFormat#format throws a RangeError on an invalid date. The
    // old toLocaleDateString path printed "Invalid Date" and the panel lived.
    for (const lang of SUPPORTED_LANGUAGES) {
      const { fmtLabel, fmtBucketDate } = chart(lang);
      for (const label of ["2026-W29", "", "soon"]) {
        expect(fmtLabel(label), `${lang} ${label}`).toBe(label);
        expect(fmtBucketDate(label), `${lang} ${label}`).toBe(label);
      }
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

  it("builds the date formatters on first use, once per page", () => {
    // Every admin page loads this script. Only the link detail page draws the
    // chart, so the other pages must not pay for the formatters.
    const fresh = loadChart("en");
    expect(fresh.formattersBuilt()).toBe(0);
    fresh.fmtLabel("2026-07-16");
    const afterFirst = fresh.formattersBuilt();
    expect(afterFirst).toBeGreaterThan(0);
    fresh.fmtLabel("2026-07-17");
    fresh.fmtBucketDate("2026-07-16 09");
    expect(fresh.formattersBuilt()).toBe(afterFirst);
  });
});

describe("client.ts renderTimeline axis", () => {
  // Range shapes the analytics API emits, with dates that cross New Year.
  const SCENARIOS: Array<[string, Bucket[]]> = [
    ["24h hourly", Array.from({ length: 25 }, (_, i) => ({ label: `2026-07-${i < 15 ? 15 : 16} ${String((9 + i) % 24).padStart(2, "0")}`, count: i % 3 }))],
    ["7d daily", dailyBuckets(Date.UTC(2025, 11, 27), 8)],
    ["30d daily across New Year", dailyBuckets(Date.UTC(2025, 11, 12), 31)],
    ["90d daily", dailyBuckets(Date.UTC(2026, 3, 1), 91)],
    ["1y weekly", dailyBuckets(Date.UTC(2025, 9, 20), 53, 7)],
    ["14-day all range across New Year", dailyBuckets(Date.UTC(2025, 11, 20), 14)],
    ["all monthly, 26 buckets", monthlyBuckets(2024, 8, 26)],
    ["all monthly, 25 buckets", monthlyBuckets(2024, 8, 25)],
  ];

  it("ends on the locale's today label", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [name, buckets] of SCENARIOS) {
        const { labels } = readAxis(chart(lang).render(buckets));
        expect(labels.at(-1)!.text, `${lang} ${name}`).toBe(today(lang));
      }
    }
  });

  it("draws an emphasized dot under every label and nowhere else", () => {
    // A label dropped for overlap used to keep its dot, so the marked points
    // and the labels stopped lining up.
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [name, buckets] of SCENARIOS) {
        const { labels, dots } = readAxis(chart(lang).render(buckets));
        expect(dots, `${lang} ${name}`).toEqual(labels.map((l) => l.x));
      }
    }
  });

  it("keeps a full label interval between today and its neighbor", () => {
    // The cadence used to start at the first bucket. Today could then sit one
    // step from its neighbor: "Sep 2026" and "Today" 30 units apart, overlapping.
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [name, buckets] of SCENARIOS) {
        const { labels } = readAxis(chart(lang).render(buckets));
        const gaps = labels.slice(1).map((l, k) => l.x - labels[k].x);
        const step = Math.min(...gaps);
        expect(gaps.at(-1)!, `${lang} ${name}`).toBeCloseTo(step, 0);
      }
    }
  });

  it("marks the year where a weekly axis crosses into a new one", () => {
    // 1y range on 2026-10-20. Without a year, "Oct 20" (2025) and "Oct 5"
    // (2026) on the same axis read as the same October.
    const buckets = dailyBuckets(Date.UTC(2025, 9, 20), 53, 7);
    for (const lang of SUPPORTED_LANGUAGES) {
      const dated = readAxis(chart(lang).render(buckets)).labels.slice(0, -1);
      expect(dated.filter((l) => /20\d\d/.test(l.text)).length, lang).toBe(2);
      expect(dated[0].text, `${lang} first label`).toContain("2025");
      const firstIn2026 = dated.findIndex((l) => l.text.includes("2026"));
      expect(firstIn2026, lang).toBeGreaterThan(0);
      expect(dated.slice(firstIn2026 + 1).some((l) => /20\d\d/.test(l.text)), lang).toBe(false);
    }
  });

  it("marks the year where a daily axis crosses into a new one", () => {
    // 30d range on 2026-01-11.
    const buckets = dailyBuckets(Date.UTC(2025, 11, 12), 31);
    for (const lang of SUPPORTED_LANGUAGES) {
      const { labels } = readAxis(chart(lang).render(buckets));
      expect(labels[0].text, lang).toContain("2025");
      expect(labels.some((l) => l.text.includes("2026")), lang).toBe(true);
    }
  });

  it("leaves the year off an axis inside one year", () => {
    const buckets = dailyBuckets(Date.UTC(2026, 5, 1), 31);
    for (const lang of SUPPORTED_LANGUAGES) {
      const { labels } = readAxis(chart(lang).render(buckets));
      expect(labels.every((l) => !l.text.includes("2026")), lang).toBe(true);
    }
  });

  it("drops a regular label that would overlap a wide year label before it", () => {
    // A 14-day all range across New Year labels every day. zh's
    // "2025年12月20日" is too wide to share a step with "12月21日". en's
    // "Dec 20, 2025" fits beside "Dec 21".
    const buckets = dailyBuckets(Date.UTC(2025, 11, 20), 14);
    const zh = readAxis(chart("zh").render(buckets)).labels.map((l) => l.text);
    expect(zh[0]).toContain("2025");
    expect(zh).not.toContain("12月21日");
    expect(zh).toContain("12月22日");
    expect(zh).toHaveLength(13);
    expect(readAxis(chart("en").render(buckets)).labels).toHaveLength(14);
  });

  it("drops today's neighbor, not today, when the two would overlap", () => {
    // The cadence keeps a full interval before today on every real chart, so
    // this pins the guard with explicit positions.
    const buckets = dailyBuckets(Date.UTC(2026, 6, 14), 3);
    const pts = [[0, 0], [100, 0], [110, 0]];
    const labels = chart("en").axisLabels(buckets, pts, 1, "Today");
    expect(labels.map((l) => l.i)).toEqual([0, 2]);
    expect(labels.at(-1)!.text).toBe("Today");
  });

  it("draws a chart whose buckets arrive in an unknown shape", () => {
    const buckets = [
      { label: "2026-W28", count: 1 },
      { label: "2026-W29", count: 2 },
    ];
    for (const lang of SUPPORTED_LANGUAGES) {
      const { labels } = readAxis(chart(lang).render(buckets));
      expect(labels.map((l) => l.text), lang).toEqual(["2026-W28", today(lang)]);
    }
  });
});
