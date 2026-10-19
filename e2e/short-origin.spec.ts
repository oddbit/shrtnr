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
    // The toast waits for writeText() to settle, but the read below goes
    // through its own clipboard IPC. Poll rather than read once: a slow
    // clipboard IPC in headless Chromium answers with the previous contents,
    // which are empty on a fresh context.
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`${SHORT_ORIGIN}/${slug}`);

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

    // The image URL carries the origin as a cache key, so a browser that cached
    // the SVG before the setting changed cannot keep serving the old QR while
    // the text above names the new origin (src/client.ts qrSrc).
    const cacheKey = encodeURIComponent(SHORT_ORIGIN);
    await expect(page.locator("#qr-img")).toHaveAttribute("src", new RegExp(`[?&]origin=${cacheKey}`));

    errors.assertClean();
  });
});

/**
 * navigator.clipboard is undefined outside a secure context, which is how a
 * plain-http LAN deployment meets the admin. A copy that cannot land must not
 * be announced as one: the user moves on without the text. For the API key,
 * shown once, that loses the key.
 */
test.describe("without a clipboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    });
  });

  test("the copy button names the URL to copy by hand", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links");

    const chip = page.locator(".col-short-chip").first();
    const slug = await chip.getAttribute("data-copy-slug");
    expect(slug).toBeTruthy();

    await chip.click();
    await expect(toast(page)).toHaveText(`Clipboard unavailable. Copy it by hand: ${SHORT_ORIGIN}/${slug}`);
    await expect(toast(page)).toHaveClass(/toast-error/);

    errors.assertClean();
  });

  test("the API key copy keeps the key on screen and selected", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/keys");

    await page.getByRole("button", { name: "New key" }).click();
    await page.locator("#m-key-title").fill("No clipboard key");
    await page.getByRole("button", { name: "Create Key" }).click();

    const key = page.locator("#revealed-key");
    await expect(key).toHaveText(/\S+/);
    const raw = (await key.textContent()) ?? "";

    await page.locator("#modal").getByRole("button", { name: "Copy" }).click();
    await expect(toast(page)).toHaveText("Clipboard unavailable. The key is selected: copy it by hand.");
    await expect(toast(page)).toHaveClass(/toast-error/);
    // The modal stays open with the key, and the key is the selection.
    await expect(key).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(raw);

    errors.assertClean();
  });
});
