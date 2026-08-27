// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect, type Page } from "@playwright/test";
import { loadSeed, query, watchErrors } from "./helpers";
import type { Seed } from "./env";

/**
 * The links listing as a user drives it: every control in the toolbar and the
 * paginator, the search box, and the two ways into a link's detail page. Each
 * step asserts the URL the click produced, the state the page marks as
 * current, and the rows it serves. Counts come from the seed and are exact.
 */
const PER_PAGE = 25;
// Read once the setup project has written it: module load runs at collection,
// before any project.
let seed: Seed;
test.beforeAll(() => {
  seed = loadSeed();
});

const rows = (page: Page) => page.locator(".links-table tbody tr");
const chip = (page: Page, name: string) => page.locator(".filter-chip", { hasText: name });
const sortBtn = (page: Page, name: string) => page.locator(".sort-btn", { hasText: name });
// The chip carries the slug in data-copy-slug; its text also holds the icon
// ligature, so read the attribute rather than the text.
const slugChips = (page: Page) => rows(page).locator(".col-short-chip");
const firstSlug = (page: Page) => slugChips(page).first();
const slugList = (page: Page) => slugChips(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-copy-slug") ?? ""));
const currentPage = (page: Page) => pager(page).locator('a[aria-current="page"]');
const pager = (page: Page) => page.getByRole("navigation", { name: "Pagination" });

test.describe("links listing", () => {
  test("filter chips narrow the listing and mark the current chip", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links");
    await expect(chip(page, "Active")).toHaveClass(/active/);
    await expect(page.locator(".toolbar-count")).toHaveText(`${seed.active} links`);
    await expect(rows(page)).toHaveCount(PER_PAGE);

    await chip(page, "Disabled").click();
    await expect(page).toHaveURL(/filter=disabled/);
    await expect(chip(page, "Disabled")).toHaveClass(/active/);
    await expect(chip(page, "Active")).not.toHaveClass(/active/);
    await expect(page.locator(".toolbar-count")).toHaveText(`${seed.disabled} links`);
    await expect(rows(page)).toHaveCount(seed.disabled);
    for (const link of seed.disabledLinks) {
      await expect(page.locator(`.col-short-chip[data-copy-slug="${link.slug}"]`)).toBeVisible();
    }

    await chip(page, "All").click();
    await expect(page).toHaveURL(/filter=all/);
    await expect(chip(page, "All")).toHaveClass(/active/);
    await expect(page.locator(".toolbar-count")).toHaveText(`${seed.active + seed.disabled} links`);
    errors.assertClean();
  });

  test("sort buttons reorder the rows and mark the current sort", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links");
    await expect(sortBtn(page, "Recent")).toHaveClass(/active/);
    await expect(firstSlug(page)).toHaveAttribute("data-copy-slug", seed.newest.slug);

    await sortBtn(page, "Popular").click();
    await expect(page).toHaveURL(/sort=popular/);
    await expect(sortBtn(page, "Popular")).toHaveClass(/active/);
    await expect(sortBtn(page, "Recent")).not.toHaveClass(/active/);
    // Rows land in click order, most clicked first.
    const slugs = await slugList(page);
    expect(slugs.slice(0, seed.popular.length)).toEqual(seed.popular.map((p) => p.link.slug));

    await sortBtn(page, "Recent").click();
    await expect(page).toHaveURL(/sort=recent/);
    await expect(firstSlug(page)).toHaveAttribute("data-copy-slug", seed.newest.slug);
    errors.assertClean();
  });

  test("the paginator walks disjoint windows and disables the step past the end", async ({ page }) => {
    const errors = watchErrors(page);
    const pages = Math.ceil(seed.active / PER_PAGE);
    await page.goto("/_/admin/links");
    await expect(pager(page)).toBeVisible();
    await expect(currentPage(page)).toHaveText("1");

    const firstPage = await slugList(page);
    await pager(page).getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(currentPage(page)).toHaveText("2");
    await expect(rows(page)).toHaveCount(PER_PAGE);
    const secondPage = await slugList(page);
    expect(secondPage.some((s) => firstPage.includes(s))).toBe(false);

    await pager(page).getByRole("link", { name: String(pages) }).click();
    await expect(page).toHaveURL(new RegExp(`page=${pages}`));
    await expect(rows(page)).toHaveCount(seed.active - PER_PAGE * (pages - 1));
    // At the last page the next step has nowhere to go: no href, no tab stop,
    // and it announces why it is dimmed.
    await expect(pager(page).getByRole("link", { name: "Next page" })).toHaveAttribute("aria-disabled", "true");
    await expect(pager(page).locator('a[aria-label="Next page"]')).toHaveCount(0);

    await pager(page).getByRole("link", { name: "Previous page" }).click();
    await expect(page).toHaveURL(new RegExp(`page=${pages - 1}`));
    errors.assertClean();
  });

  test("the per-page selector resizes the window and resets to page one", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links?page=2");
    await page.getByRole("combobox", { name: "Links per page" }).selectOption("50");
    await expect(page).toHaveURL(/per_page=50/);
    expect(query(page).page).toBe("1");
    await expect(rows(page)).toHaveCount(50);
    await expect(pager(page).getByRole("link", { name: "2" })).toBeVisible();
    await expect(pager(page).getByRole("link", { name: "3" })).toHaveCount(0);
    errors.assertClean();
  });

  test("a page beyond the end clamps to the last populated window", async ({ page }) => {
    const errors = watchErrors(page);
    const pages = Math.ceil(seed.active / PER_PAGE);
    await page.goto("/_/admin/links?page=999");
    await expect(currentPage(page)).toHaveText(String(pages));
    await expect(rows(page)).toHaveCount(seed.active - PER_PAGE * (pages - 1));
    errors.assertClean();
  });

  test("filter and sort survive each other and reset the page", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links?sort=popular&page=2");
    await chip(page, "All").click();
    const q = query(page);
    expect(q.sort).toBe("popular");
    expect(q.filter).toBe("all");
    expect(q.page).toBe("1");
    await expect(sortBtn(page, "Popular")).toHaveClass(/active/);
    await expect(chip(page, "All")).toHaveClass(/active/);
    errors.assertClean();
  });

  test("the search box finds a link by label and names the query when nothing matches", async ({ page }) => {
    const errors = watchErrors(page);
    const target = seed.links[10];
    await page.goto("/_/admin/links");
    await page.getByPlaceholder("Paste URL or search links...").fill(target.label);
    await page.getByPlaceholder("Paste URL or search links...").press("Enter");
    await expect(page).toHaveURL(/search=/);
    expect(query(page).search).toBe(target.label);
    await expect(page.locator(".search-results-bar .count")).toHaveText("1 matching links");
    await expect(rows(page)).toHaveCount(1);
    await expect(firstSlug(page)).toHaveAttribute("data-copy-slug", target.slug);

    // The search rides along when the filter changes.
    await chip(page, "Disabled").click();
    expect(query(page).search).toBe(target.label);
    await expect(page.locator(".empty-state p")).toHaveText(`No links match "${target.label}" in Disabled.`);

    await page.goto("/_/admin/links?search=zzz-no-such-link&filter=all");
    await expect(page.locator(".empty-state p")).toHaveText('No links match "zzz-no-such-link".');

    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/_\/admin\/links$/);
    await expect(rows(page)).toHaveCount(PER_PAGE);
    errors.assertClean();
  });

  test("a row and its label both open the detail page", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/_/admin/links");
    const first = rows(page).first();
    const href = await first.locator(".col-link-label-link").getAttribute("href");
    expect(href).toMatch(/^\/_\/admin\/links\/\d+$/);

    // Click the destination URL cell, away from any chip, to take the row's own path.
    await first.locator(".col-link-url").click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(".page-title")).toBeVisible();

    await page.goto("/_/admin/links");
    await rows(page).first().locator(".col-link-label-link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    errors.assertClean();
  });
});
