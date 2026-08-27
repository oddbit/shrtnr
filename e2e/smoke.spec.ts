// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "@playwright/test";
import { loadSeed, watchErrors } from "./helpers";

/**
 * Every admin page loads in a browser with a clean console, and every
 * same-origin link it renders answers below 400. A control that leads
 * nowhere, a route that 500s under real data, or a script that throws on load
 * fails here even when no spec targets that page yet.
 */
const PAGES: { name: string; path: () => string }[] = [
  { name: "/_/admin/dashboard", path: () => "/_/admin/dashboard" },
  { name: "/_/admin/links", path: () => "/_/admin/links" },
  // Seed is read inside the test: module load runs at collection, before setup.
  { name: "/_/admin/links/:id", path: () => `/_/admin/links/${loadSeed().newest.id}` },
  { name: "/_/admin/bundles", path: () => "/_/admin/bundles" },
  { name: "/_/admin/keys", path: () => "/_/admin/keys" },
  { name: "/_/admin/settings", path: () => "/_/admin/settings" },
];

/** Links that sign out or leave the origin are not part of the crawl. */
const SKIP = [/^\/_\/dev\/logout/, /^\/_\/admin\/logout/, /^mailto:/, /^https?:\/\//, /^#/, /^javascript:/];

for (const { name, path } of PAGES) {
  test(`${name} renders and every link it offers answers`, async ({ page, request }) => {
    const errors = watchErrors(page);
    const response = await page.goto(path());
    expect(response?.status()).toBe(200);
    await expect(page.locator(".page-title").first()).toBeVisible();

    const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors.map((a) => a.getAttribute("href") ?? ""),
    );
    const targets = [...new Set(hrefs)].filter((h) => h && !SKIP.some((re) => re.test(h)));
    expect(targets.length, "page offers at least one link").toBeGreaterThan(0);

    const broken: string[] = [];
    for (const href of targets) {
      const res = await request.get(href, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${res.status()} ${href}`);
    }
    expect(broken, "every rendered link answers").toEqual([]);
    errors.assertClean();
  });
}

test("the landing page redirects a signed-in browser to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/_\/admin\/dashboard$/);
});

test("dev logout drops the identity and the landing page stays on the landing page", async ({ browser }) => {
  // A fresh context: signing out must not disturb the shared storage state.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/_/dev/login?as=other@example.com");
  await expect(page).toHaveURL(/\/_\/admin\/dashboard$/);
  await page.goto("/_/dev/logout");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});
