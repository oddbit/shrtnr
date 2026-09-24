// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect, type Page } from "@playwright/test";
import { loadSeed, watchErrors } from "./helpers";
import { BASE_URL, SHORT_ORIGIN, type Seed } from "./env";

/**
 * A deployment can answer on several domains. With SHORT_ORIGIN set, the
 * admin hands out that one origin no matter which host the operator opened it
 * on: the copy button, the toast it raises and the QR modal all name it
 * instead of the host in the address bar. The e2e server pins a value that is
 * deliberately not BASE_URL, so a build that ignored the setting fails here
 * rather than passing by coincidence.
 */
let seed: Seed;
test.beforeAll(() => {
  seed = loadSeed();
});

const toast = (page: Page) => page.locator("#toast");

// Writing to the clipboard and reading it back both need the permission
// granted; without it the client's writeText() rejects and the page logs an
// error that assertClean() would flag.
test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
});

test.describe("pinned short origin", () => {
  test("the shell carries it and the copy button builds the URL from it", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links");

    await expect(page.locator("html")).toHaveAttribute("data-short-origin", SHORT_ORIGIN);

    const chip = page.locator(".col-short-chip").first();
    const slug = await chip.getAttribute("data-copy-slug");
    expect(slug).toBeTruthy();

    await chip.click();
    await expect(toast(page)).toHaveText(`Copied ${SHORT_ORIGIN}/${slug}`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${SHORT_ORIGIN}/${slug}`);

    errors.assertClean();
  });

  test("the QR modal names it rather than the host in the address bar", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/_/admin/links/${seed.newest.id}`);

    // Read the slug the page itself is showing, so the two assertions cannot
    // drift apart over which slug is primary.
    const displaySlug = await page.locator(".short-url-row button[data-copy-slug]").getAttribute("data-copy-slug");
    expect(displaySlug).toBeTruthy();

    await page.locator('.short-url-row button[onclick^="showQRModal"]').click();
    await expect(page.locator("#modal p").first()).toHaveText(`${SHORT_ORIGIN}/${displaySlug}`);

    errors.assertClean();
  });
});
