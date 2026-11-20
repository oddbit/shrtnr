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
// series for the 1y and all ranges. Its points are calendar months, so every
// click in the window lands on exactly one point.
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
