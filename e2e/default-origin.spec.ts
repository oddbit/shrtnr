// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect } from "@playwright/test";
import { watchErrors } from "./helpers";
import { IDENTITY, UNPINNED_URL } from "./env";

/**
 * Most deployments never set SHORT_ORIGIN. The admin then hands out short URLs
 * on the host it was opened on. The rest of the suite runs against a server
 * that pins the variable, so this spec drives the second e2e server, which
 * leaves it unset. A build whose fallback broke, an empty data-short-origin or
 * a script that ignores location.origin, fails here.
 */
test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: UNPINNED_URL });
  await page.goto(`/_/dev/login?as=${encodeURIComponent(IDENTITY)}`);
  await expect(page).toHaveURL(/\/_\/admin\/dashboard/);
});

test("the copy button and the QR modal use the host the admin was opened on", async ({ page }) => {
  const created = await page.request.post("/_/admin/api/links", {
    data: { url: `https://e2e.example/default-origin-${Date.now()}` },
  });
  expect(created.ok()).toBe(true);
  const link = (await created.json()) as { id: number };

  const errors = watchErrors(page);
  await page.goto(`/_/admin/links/${link.id}`);
  await expect(page.locator("html")).toHaveAttribute("data-short-origin", UNPINNED_URL);

  const copy = page.locator(".short-url-row button[data-copy-slug]");
  const slug = await copy.getAttribute("data-copy-slug");
  expect(slug).toBeTruthy();

  await copy.click();
  await expect(page.locator("#toast")).toHaveText(`Copied ${UNPINNED_URL}/${slug}`);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`${UNPINNED_URL}/${slug}`);

  await page.locator('.short-url-row button[onclick^="showQRModal"]').click();
  await expect(page.locator("#modal p").first()).toHaveText(`${UNPINNED_URL}/${slug}`);

  errors.assertClean();
});
