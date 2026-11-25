// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { sparklineBucketLabels } from "../../db/click-repository";

// 2026-07-16 12:00:00 UTC.
const TS = Math.floor(Date.UTC(2026, 6, 16, 12, 0, 0) / 1000);

describe("sparklineBucketLabels", () => {
  it("emits one label per bucket, oldest first, current period last", () => {
    const labels = sparklineBucketLabels("7d", TS);
    expect(labels).toHaveLength(7);
    expect(labels[labels.length - 1]).toBe("2026-07-16");
    expect(labels[0]).toBe("2026-07-10");
    // Chronological, ascending.
    expect([...labels].sort()).toEqual(labels);
  });

  it("uses hourly labels for the 24h range", () => {
    const labels = sparklineBucketLabels("24h", TS);
    expect(labels).toHaveLength(24);
    expect(labels[labels.length - 1]).toBe("2026-07-16 12");
  });

  it("uses monthly labels for the 1y and all ranges", () => {
    for (const range of ["1y", "all"] as const) {
      const labels = sparklineBucketLabels(range, TS);
      expect(labels).toHaveLength(12);
      expect(labels[labels.length - 1]).toBe("2026-07");
    }
  });

  // The monthly series used to step back 30 days at a time. Twelve such steps
  // span 330 days, not twelve calendar months, so on about one day in six two
  // steps landed in the same month (charted twice) and, around the turn of
  // February, a month was skipped outright.
  it("names twelve consecutive calendar months when 30-day steps would skip February", () => {
    // 2027-03-01 12:00 UTC: 30 days back is 2027-01-30, which jumps February.
    const ts = Math.floor(Date.UTC(2027, 2, 1, 12, 0, 0) / 1000);
    for (const range of ["1y", "all"] as const) {
      expect(sparklineBucketLabels(range, ts)).toEqual([
        "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
        "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03",
      ]);
    }
  });

  it("names each month once when 30-day steps would repeat the current month", () => {
    // 2026-12-31 12:00 UTC: 30 days back is 2026-12-01, December again.
    const ts = Math.floor(Date.UTC(2026, 11, 31, 12, 0, 0) / 1000);
    for (const range of ["1y", "all"] as const) {
      expect(sparklineBucketLabels(range, ts)).toEqual([
        "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
        "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
      ]);
    }
  });

  it("never repeats or skips a month on any day of a year, leap day included", () => {
    const start = Date.UTC(2028, 0, 1, 12, 0, 0) / 1000;
    for (let day = 0; day < 366; day++) {
      const ts = start + day * 86400;
      const labels = sparklineBucketLabels("1y", ts);
      expect(new Set(labels).size).toBe(12);
      // Distinct labels alone allow a gap: each must be the month after the
      // one before it, ending on the month the series is read in.
      expect(labels[11]).toBe(new Date(ts * 1000).toISOString().slice(0, 7));
      for (let i = 1; i < labels.length; i++) {
        const [y, m] = labels[i - 1].split("-").map(Number);
        expect(labels[i]).toBe(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7));
      }
    }
  });

  it("produces 30 daily labels for the 30d range", () => {
    const labels = sparklineBucketLabels("30d", TS);
    expect(labels).toHaveLength(30);
    expect(labels[labels.length - 1]).toBe("2026-07-16");
    // 30 buckets: the current day plus the 29 preceding days.
    expect(labels[0]).toBe("2026-06-17");
  });
});
