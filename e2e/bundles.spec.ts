// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "@playwright/test";

/**
 * Bundle cards in one grid row share a layout: the stats panel, sparkline and
 * footer sit at the bottom of each card, so a one-line description and a
 * two-line one leave the stats at the same height.
 */
test("bundle cards in a row align their stats regardless of description length", async ({ page }) => {
  const stamp = Date.now();
  const bundles = [
    { name: `Align short ${stamp}`, description: "One line." },
    {
      name: `Align long ${stamp}`,
      description:
        "A description long enough to wrap onto a second line inside the card, which pushed the stats down before.",
    },
    { name: `Align none ${stamp}` },
  ];
  for (const data of bundles) {
    expect((await page.request.post("/_/admin/api/bundles", { data })).ok()).toBe(true);
  }

  // Wide enough that the three new cards share rows with their neighbours.
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto("/_/admin/bundles");

  const cards = page.locator("a.bundle-card");
  await expect(cards.filter({ hasText: `Align long ${stamp}` })).toBeVisible();

  const boxes = await cards.evaluateAll((els) =>
    els.map((el) => {
      const card = el.getBoundingClientRect();
      const stats = el.querySelector(".bundle-card-stats")!.getBoundingClientRect();
      return { title: el.querySelector(".bundle-card-title")!.textContent, top: card.top, statsTop: stats.top };
    }),
  );
  const rows = new Map<number, typeof boxes>();
  for (const box of boxes) rows.set(box.top, [...(rows.get(box.top) ?? []), box]);

  const multiCardRows = [...rows.values()].filter((row) => row.length > 1);
  expect(multiCardRows.length, "at least one row holds several cards").toBeGreaterThan(0);
  for (const row of multiCardRows) {
    const tops = row.map((b) => Math.round(b.statsTop));
    expect(new Set(tops).size, `stats align in row: ${row.map((b) => b.title).join(", ")}`).toBe(1);
  }
});
