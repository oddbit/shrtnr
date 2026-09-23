// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  test,
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { loadSeed, watchErrors } from "./helpers";
import { BASE_URL, IDENTITY, type Seed } from "./env";

/**
 * The authorization model as the admin UI presents it. These tests are the
 * requirement: CLAUDE.md lists the same eight rules in prose, and the vitest
 * suites pin the service and handler answers. What only a browser can show
 * is which control a given visitor is offered on a given row.
 *
 * 1. Anyone can create a link.
 * 2. Anyone can see everyone's links.
 * 3. Anyone can add a custom slug to anyone's link.
 * 4. The owner deletes a link or a custom slug while it has zero clicks.
 * 5. Once clicked, the owner disables instead. The UI offers one of the two.
 * 6. The link owner owns its slugs.
 * 7. The bundle owner deletes the bundle and removes links from it.
 * 8. Anyone contributes links to any bundle.
 *
 * Runs in its own project after the counting specs. Every fixture is a seeded
 * link the setup project owns, chosen so the listing spec's assertions hold:
 * no link is created that survives the run, and the one custom slug that
 * keeps its click hands the primary chip back to the system slug.
 */

/** A second identity, signed in through the same dev login the setup uses. */
const OTHER = "authz-other@example.com";

let seed: Seed;
let ownerApi: APIRequestContext;
let otherApi: APIRequestContext;

test.beforeAll(async () => {
  seed = loadSeed();
  ownerApi = await request.newContext({ baseURL: BASE_URL });
  expect((await ownerApi.get(`/_/dev/login?as=${encodeURIComponent(IDENTITY)}`)).ok()).toBe(true);
  otherApi = await request.newContext({ baseURL: BASE_URL });
  expect((await otherApi.get(`/_/dev/login?as=${encodeURIComponent(OTHER)}`)).ok()).toBe(true);
});

test.afterAll(async () => {
  await ownerApi.dispose();
  await otherApi.dispose();
});

async function asOther(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: await otherApi.storageState() });
  return { context, page: await context.newPage() };
}

// Seeded links picked away from the rows the listing spec asserts: not the
// newest, not the three clicked, not the two disabled.
const ownerLinkA = () => seed.links[40];
const ownerLinkB = () => seed.links[41];

const moreActions = (page: Page) => page.getByRole("button", { name: "More actions" });
const menuItem = (page: Page, name: string) =>
  page.locator("#detail-menu").getByRole("button", { name, exact: true });
const modalButton = (page: Page, name: string) =>
  page.locator(".modal-actions").getByRole("button", { name, exact: true });
const slugRow = (page: Page, slug: string) => page.locator(`.slugs-row[data-slug-id="${slug}"]`);
const bundleLinkRow = (page: Page, linkId: number) =>
  page.locator(`a.bundle-link-row[href="/_/admin/links/${linkId}"]`);

interface ApiLink {
  id: number;
  created_by: string;
  total_clicks: number;
  slugs: { slug: string; is_custom: number; is_primary: number; click_count: number }[];
}

async function readLink(api: APIRequestContext, id: number): Promise<ApiLink> {
  const res = await api.get(`/_/admin/api/links/${id}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as ApiLink;
}

test.describe("rules 1, 2 and 4: create, see, delete while unclicked", () => {
  test("a second identity creates a link, sees the owner's link, and deletes its own from the page", async ({ browser, page }) => {
    // Rule 1: the other identity creates a link through the admin surface.
    const created = await otherApi.post("/_/admin/api/links", {
      data: { url: `https://e2e.example/authz-${Date.now()}`, label: "Authz temp link" },
    });
    expect(created.status()).toBe(201);
    const mine = (await created.json()) as ApiLink;
    expect(mine.created_by).toBe(OTHER);

    // Rule 2: the seed owner opens the other identity's link and reads it.
    const errors = watchErrors(page);
    await page.goto(`/_/admin/links/${mine.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(slugRow(page, mine.slugs[0].slug)).toBeVisible();
    errors.assertClean();

    // Rule 4: the creator sees Delete on a zero-click link and it lands.
    const { context, page: otherPage } = await asOther(browser);
    await otherPage.goto(`/_/admin/links/${mine.id}`);
    await moreActions(otherPage).click();
    await expect(menuItem(otherPage, "Delete")).toBeVisible();
    await expect(menuItem(otherPage, "Disable")).toHaveCount(0);
    await menuItem(otherPage, "Delete").click();
    await modalButton(otherPage, "Delete").click();
    await expect(otherPage).toHaveURL(/\/_\/admin\/links$/);
    expect((await otherApi.get(`/_/admin/api/links/${mine.id}`)).status()).toBe(404);
    await context.close();
  });
});

test.describe("rules 3, 4 and 6: slugs on someone else's link", () => {
  test("a non-owner adds a custom slug and is offered nothing else; the owner deletes it", async ({ browser, page }) => {
    const link = ownerLinkA();
    const slug = `authz-tmp-${Date.now()}`;

    // Rule 3: the non-owner's menu offers Add custom slug and Add to bundle,
    // and none of the owner's actions.
    const { context, page: otherPage } = await asOther(browser);
    const otherErrors = watchErrors(otherPage);
    await otherPage.goto(`/_/admin/links/${link.id}`);
    await moreActions(otherPage).click();
    await expect(menuItem(otherPage, "Add custom slug")).toBeVisible();
    await expect(menuItem(otherPage, "Add to bundle")).toBeVisible();
    await expect(menuItem(otherPage, "Delete")).toHaveCount(0);
    await expect(menuItem(otherPage, "Disable")).toHaveCount(0);
    await expect(menuItem(otherPage, "Enable")).toHaveCount(0);

    await menuItem(otherPage, "Add custom slug").click();
    await otherPage.locator("#m-new-slug").fill(slug);
    await modalButton(otherPage, "Add").click();
    await expect(slugRow(otherPage, slug)).toBeVisible();

    // Rule 6: the slug belongs to the link owner. The non-owner who added it
    // gets no row action on it.
    await expect(slugRow(otherPage, slug).getByTitle("Delete slug")).toHaveCount(0);
    await expect(slugRow(otherPage, slug).getByTitle("Disable slug")).toHaveCount(0);
    otherErrors.assertClean();
    await context.close();

    // Rule 4: the owner sees Delete slug on the zero-click custom slug and
    // never Disable slug, and the delete lands.
    const errors = watchErrors(page);
    await page.goto(`/_/admin/links/${link.id}`);
    await expect(slugRow(page, slug).getByTitle("Delete slug")).toBeVisible();
    await expect(slugRow(page, slug).getByTitle("Disable slug")).toHaveCount(0);
    await slugRow(page, slug).getByTitle("Delete slug").click();
    await modalButton(page, "Delete slug").click();
    await expect(slugRow(page, slug)).toHaveCount(0);
    errors.assertClean();

    const after = await readLink(ownerApi, link.id);
    expect(after.slugs.map((s) => s.slug)).not.toContain(slug);
    // The system slug carries the primary chip again, as the listing expects.
    expect(after.slugs.find((s) => s.is_primary === 1)?.slug).toBe(link.slug);
  });
});

test.describe("rule 5: clicked means disable, not delete", () => {
  test("the owner's menu offers Delete at zero clicks and Disable after the first", async ({ page }) => {
    const unclicked = ownerLinkA();
    const clicked = seed.popular[0].link;

    await page.goto(`/_/admin/links/${unclicked.id}`);
    await moreActions(page).click();
    await expect(menuItem(page, "Delete")).toBeVisible();
    await expect(menuItem(page, "Disable")).toHaveCount(0);

    await page.goto(`/_/admin/links/${clicked.id}`);
    await moreActions(page).click();
    await expect(menuItem(page, "Disable")).toBeVisible();
    await expect(menuItem(page, "Delete")).toHaveCount(0);
  });

  test("a disabled link offers Enable and neither Delete nor Disable", async ({ page }) => {
    const disabled = seed.disabledLinks[0];
    await page.goto(`/_/admin/links/${disabled.id}`);
    await moreActions(page).click();
    await expect(menuItem(page, "Enable")).toBeVisible();
    await expect(menuItem(page, "Delete")).toHaveCount(0);
    await expect(menuItem(page, "Disable")).toHaveCount(0);
  });

  test("a clicked custom slug offers Disable slug; the system slug offers neither", async ({ page }) => {
    // The fixture lives on the most clicked link, so its click lands where
    // the popular order already puts it first. The first custom slug takes
    // the primary chip, so the fixture hands it back before the listing spec
    // could notice. Idempotent across runs against a reused server.
    const link = seed.popular[0].link;
    const slug = "authz-clicked";
    const before = await readLink(ownerApi, link.id);
    if (!before.slugs.some((s) => s.slug === slug)) {
      expect((await ownerApi.post(`/_/admin/api/links/${link.id}/slugs`, { data: { slug } })).ok()).toBe(true);
      expect(
        (await ownerApi.put(`/_/admin/api/links/${link.id}/slugs/primary`, { data: { slug: link.slug } })).ok(),
      ).toBe(true);
      const hit = await ownerApi.get(`/${slug}`, { maxRedirects: 0 });
      expect(hit.status()).toBeGreaterThanOrEqual(300);
      expect(hit.status()).toBeLessThan(400);
    }
    await expect
      .poll(async () => (await readLink(ownerApi, link.id)).slugs.find((s) => s.slug === slug)?.click_count ?? 0, {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(1);
    expect((await readLink(ownerApi, link.id)).slugs.find((s) => s.is_primary === 1)?.slug).toBe(link.slug);

    const errors = watchErrors(page);
    await page.goto(`/_/admin/links/${link.id}`);
    await expect(slugRow(page, slug).getByTitle("Disable slug")).toBeVisible();
    await expect(slugRow(page, slug).getByTitle("Delete slug")).toHaveCount(0);
    // The system-generated slug is the link's address: never removed or
    // disabled on its own, at any click count.
    await expect(slugRow(page, link.slug).getByTitle("Delete slug")).toHaveCount(0);
    await expect(slugRow(page, link.slug).getByTitle("Disable slug")).toHaveCount(0);
    errors.assertClean();
  });
});

test.describe("rules 7 and 8: bundles", () => {
  test("anyone files a link into a bundle; only the owner curates and deletes it", async ({ browser, page }) => {
    const created = await ownerApi.post("/_/admin/api/bundles", {
      data: { name: `Authz bundle ${Date.now()}` },
    });
    expect(created.status()).toBe(201);
    const bundle = (await created.json()) as { id: number; created_by: string };
    expect(bundle.created_by).toBe(IDENTITY);
    const link = ownerLinkB();

    // Rule 8: the non-owner adds the link from the link page.
    const { context, page: otherPage } = await asOther(browser);
    const otherErrors = watchErrors(otherPage);
    await otherPage.goto(`/_/admin/links/${link.id}`);
    await moreActions(otherPage).click();
    await menuItem(otherPage, "Add to bundle").click();
    await otherPage.locator(`.add-to-bundle-row[data-bundle-id="${bundle.id}"]`).click();
    await modalButton(otherPage, "Save").click();
    await expect
      .poll(async () => {
        const res = await otherApi.get(`/_/admin/api/bundles/${bundle.id}/links`);
        return ((await res.json()) as { id: number }[]).map((l) => l.id);
      })
      .toContain(link.id);

    // Rule 7, the negative half: the non-owner sees the bundle and its rows,
    // and none of the owner's controls.
    await otherPage.goto(`/_/admin/bundles/${bundle.id}`);
    await expect(bundleLinkRow(otherPage, link.id)).toBeVisible();
    await expect(moreActions(otherPage)).toHaveCount(0);
    await expect(otherPage.getByRole("button", { name: "Add a link to this bundle" })).toHaveCount(0);
    await expect(otherPage.getByTitle("Remove from bundle")).toHaveCount(0);
    otherErrors.assertClean();
    await context.close();

    // Rule 7: the owner removes the link and deletes the bundle.
    const errors = watchErrors(page);
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto(`/_/admin/bundles/${bundle.id}`);
    await expect(page.getByRole("button", { name: "Add a link to this bundle" })).toBeVisible();
    await bundleLinkRow(page, link.id).getByTitle("Remove from bundle").click();
    await expect(bundleLinkRow(page, link.id)).toHaveCount(0);

    await moreActions(page).click();
    await page.locator('[data-bundle-action="delete"]').click();
    await expect(page).toHaveURL(/\/_\/admin\/bundles$/);
    expect((await ownerApi.get(`/_/admin/api/bundles/${bundle.id}`)).status()).toBe(404);
    errors.assertClean();
  });
});
