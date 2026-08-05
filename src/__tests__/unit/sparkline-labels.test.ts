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

  it("produces 30 daily labels for the 30d range", () => {
    const labels = sparklineBucketLabels("30d", TS);
    expect(labels).toHaveLength(30);
    expect(labels[labels.length - 1]).toBe("2026-07-16");
    // 30 buckets: the current day plus the 29 preceding days.
    expect(labels[0]).toBe("2026-06-17");
  });
});
