// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { loadSeed, watchErrors } from "./helpers";
import { BASE_URL, IDENTITY, type Seed } from "./env";

/**
 * The expiry editor on the link detail page, opened by a viewer who is not in
 * UTC.
 *
 * The Worker renders in UTC and a datetime-local input reads its value in the
 * viewer's own zone. The editor used to arrive prefilled with the UTC wall
 * time, so opening it and saving without touching the field moved the expiry
 * by the viewer's UTC offset: eight hours earlier in Makassar, every time.
 * Only a browser with a non-UTC zone can show that, so the rule lives here.
 *
 * Runs in the authorization project, after the counting specs, because it
 * writes to a seeded link. The link is restored when the test ends.
 */

// 2033-05-18T03:33:20Z. Seconds are not zero on purpose: the field has minute
// precision, and an untouched save must keep them.
const EXPIRES_AT = 2_000_000_000;
// Asia/Makassar is UTC+8 all year, with no daylight saving to move the answer.
const ZONE = "Asia/Makassar";
const SHOWN_IN_ZONE = "2033-05-18T11:33";

let seed: Seed;
let ownerApi: APIRequestContext;

// Both tests write the expiry of one link and read it back, so they take
// turns: run in parallel, each reads the value the other just saved.
test.describe.configure({ mode: "serial" });

// A seeded link no other spec touches: not the newest, not clicked, not
// disabled, and not the two the authorization spec edits.
const link = () => seed.links[42];

async function storedExpiry(): Promise<number | null> {
  const res = await ownerApi.get(`/_/admin/api/links/${link().id}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { expires_at: number | null }).expires_at;
}

test.beforeAll(async () => {
  seed = loadSeed();
  ownerApi = await request.newContext({ baseURL: BASE_URL });
  expect((await ownerApi.get(`/_/dev/login?as=${encodeURIComponent(IDENTITY)}`)).ok()).toBe(true);
  const set = await ownerApi.put(`/_/admin/api/links/${link().id}`, { data: { expires_at: EXPIRES_AT } });
  expect(set.ok()).toBe(true);
});

test.afterAll(async () => {
  await ownerApi.put(`/_/admin/api/links/${link().id}`, { data: { expires_at: null } });
  await ownerApi.dispose();
});

test("opening the expiry editor and saving it untouched keeps the expiry, in any time zone", async ({ browser }) => {
  const context = await browser.newContext({ storageState: await ownerApi.storageState(), timezoneId: ZONE });
  const page = await context.newPage();
  const errors = watchErrors(page);

  await page.goto(`/_/admin/links/${link().id}`);
  await page.locator("#expiry-display").click();

  // The field shows the instant as this viewer's wall-clock time.
  const field = page.locator("#detail-expires");
  await expect(field).toBeVisible();
  await expect(field).toHaveValue(SHOWN_IN_ZONE);

  // Save without touching it. The handler reloads the page on success.
  const reloaded = page.waitForEvent("load");
  await page.locator("#expiry-form .inline-edit-btn.confirm").click();
  await reloaded;

  expect(await storedExpiry()).toBe(EXPIRES_AT);
  errors.assertClean();
  await context.close();
});

test("an edited expiry is stored as the instant the viewer picked in their own zone", async ({ browser }) => {
  const context = await browser.newContext({ storageState: await ownerApi.storageState(), timezoneId: ZONE });
  const page = await context.newPage();
  const errors = watchErrors(page);

  await page.goto(`/_/admin/links/${link().id}`);
  await page.locator("#expiry-display").click();
  // Noon on 1 June 2033 in Makassar is 04:00 UTC.
  await page.locator("#detail-expires").fill("2033-06-01T12:00");

  const reloaded = page.waitForEvent("load");
  await page.locator("#expiry-form .inline-edit-btn.confirm").click();
  await reloaded;

  expect(await storedExpiry()).toBe(Date.UTC(2033, 5, 1, 4, 0, 0) / 1000);

  // Put the first test's value back so the two can run in either order.
  expect((await ownerApi.put(`/_/admin/api/links/${link().id}`, { data: { expires_at: EXPIRES_AT } })).ok()).toBe(true);
  errors.assertClean();
  await context.close();
});
