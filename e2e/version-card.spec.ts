// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { watchErrors } from "./helpers";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { version: string };

/**
 * The Version card on the settings page asks GitHub for the latest release.
 * GitHub is answered here, so the card's states do not depend on the network
 * or on what upstream has released.
 *
 * The server under test is a local checkout, which records no build: the
 * card shows the version alone. The build line and the unreleased state need
 * a recorded commit and are pinned in src/__tests__/unit/version-status.test.ts.
 */
async function answerLatestRelease(page: Page, version: string | null): Promise<void> {
  await page.route("https://api.github.com/**", (route) =>
    version === null
      ? route.fulfill({ status: 503, body: "" })
      : route.fulfill({
          json: { tag_name: `app-v${version}`, html_url: `https://github.com/oddbit/shrtnr/releases/tag/app-v${version}` },
        }),
  );
}

const card = (page: Page) => page.locator("#version-status");

test("the Version card names the running version and says it is up to date", async ({ page }) => {
  const errors = watchErrors(page);
  await answerLatestRelease(page, pkg.version);
  await page.goto("/_/admin/settings");

  await expect(card(page)).toContainText("Up to date");
  await expect(card(page).locator(".version-number")).toHaveText(pkg.version);
  await expect(card(page).locator(".version-build")).toHaveCount(0);
  await expect(card(page).getByRole("link", { name: /What's new/ })).toHaveAttribute(
    "href",
    `https://github.com/oddbit/shrtnr/releases/tag/app-v${pkg.version}`,
  );
  errors.assertClean();
});

test("the Version card offers a newer release", async ({ page }) => {
  await answerLatestRelease(page, "999.0.0");
  await page.goto("/_/admin/settings");

  await expect(card(page).locator(".version-number")).toHaveText(pkg.version);
  await expect(card(page)).toContainText("999.0.0");
  await expect(card(page)).not.toContainText("app-v");
  await expect(card(page).getByRole("link", { name: /Release notes/ })).toBeVisible();
});

test("the Version card still names the version when the update check fails", async ({ page }) => {
  await answerLatestRelease(page, null);
  await page.goto("/_/admin/settings");

  await expect(card(page).locator(".version-number")).toHaveText(pkg.version);
  await expect(card(page)).toContainText("Could not check for updates");
});
