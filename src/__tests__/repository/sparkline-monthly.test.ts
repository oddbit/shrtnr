// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { ClickRepository, LinkRepository, sparklineBucketLabels } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

async function clickAt(slug: string, at: number) {
  await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode) VALUES (?, ?, 'link')").bind(slug, at).run();
}

const utc = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d, 12, 0, 0) / 1000);

// The dashboard "clicks over time" chart and the KPI sparklines read this
// series for the 1y and all ranges. Its points are the current calendar month
// and the eleven before it, each charted whole. A click older than the first
// of those months is on no point, though the 1y total still counts it while
// it is under 365 days old.
describe("ClickRepository.getSparkline monthly series", () => {
  it("charts February when the series is read on the first of March", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await clickAt("abc", utc(2027, 1, 10));
    await clickAt("abc", utc(2027, 1, 20));
    await clickAt("abc", utc(2027, 0, 15));

    const now = utc(2027, 2, 1);
    for (const range of ["1y", "all"] as const) {
      const values = await ClickRepository.getSparkline(env.DB, range, now);
      const byMonth = Object.fromEntries(sparklineBucketLabels(range, now).map((label, i) => [label, values[i]]));
      expect(byMonth["2027-02"]).toBe(2);
      expect(byMonth["2027-01"]).toBe(1);
      expect(values.reduce((a, b) => a + b, 0)).toBe(3);
    }
  });

  // With 29 February in the window, the last day of a month is 365 days
  // after the second of the oldest charted month. A 365-day floor on the query
  // then cuts that month's first day off.
  it("charts the whole oldest month when the window holds a leap day", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await clickAt("abc", Math.floor(Date.UTC(2027, 3, 1, 6, 0, 0) / 1000));

    const now = Math.floor(Date.UTC(2028, 2, 31, 18, 0, 0) / 1000);
    for (const range of ["1y", "all"] as const) {
      const values = await ClickRepository.getSparkline(env.DB, range, now);
      expect(sparklineBucketLabels(range, now)[0]).toBe("2027-04");
      expect(values[0], range).toBe(1);
    }
  });

  it("charts the current month once on the last day of a 31-day month", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await clickAt("abc", utc(2026, 11, 5));
    await clickAt("abc", utc(2026, 11, 30));

    const now = utc(2026, 11, 31);
    for (const range of ["1y", "all"] as const) {
      const values = await ClickRepository.getSparkline(env.DB, range, now);
      expect(values).toHaveLength(12);
      expect(values[values.length - 1]).toBe(2);
      // The two December clicks used to appear on the last two points.
      expect(values.reduce((a, b) => a + b, 0)).toBe(2);
    }
  });
});
