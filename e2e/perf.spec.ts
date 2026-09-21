// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test, expect, type Page } from "@playwright/test";
import { loadSeed, watchErrors } from "./helpers";
import { AUTH_STATE } from "./env";
import { collectVitals, formatVitals, kb, recordResponses, throttle, VITALS_INIT_SCRIPT } from "./perf-metrics";

/**
 * Page weight, layout stability and accessibility of the pages as a browser
 * loads them. Pinned after the web performance review of 2026-09-21, when a
 * cold admin load weighed 4.1 MB (3.98 MB of it one icon font) and no page
 * had a heading, a hidden icon, or a labelled quick URL box.
 *
 * Byte budgets and DOM invariants fail the run: they are deterministic.
 * Timing (TTFB, FCP, LCP, TBT) is printed for the reviewer and never
 * asserted, since it depends on the machine and the network of the run.
 * `yarn perf` runs this spec alone under a Fast 3G / 4x CPU profile to show
 * what a user on a slow phone meets.
 */
const THROTTLED = !!process.env.PERF_THROTTLE;

/** Wire bytes of a cold admin load. Measured 421 KB after the review; the icon font alone was 3.98 MB before it. */
const ADMIN_COLD_BUDGET = 900 * 1024;
/** Wire bytes of a cold signed-out landing page. Measured 55 KB. */
const LANDING_COLD_BUDGET = 200 * 1024;
/** No single response above this. The icon font (322 KB) is the largest legitimate one. */
const SINGLE_RESPONSE_BUDGET = 400 * 1024;
/** Core Web Vitals "good" threshold for CLS (web.dev/articles/vitals). */
const CLS_BUDGET = 0.1;

const ADMIN_PAGES: { name: string; path: () => string }[] = [
  { name: "dashboard", path: () => "/_/admin/dashboard" },
  { name: "links", path: () => "/_/admin/links" },
  { name: "link detail", path: () => `/_/admin/links/${loadSeed().newest.id}` },
  { name: "bundles", path: () => "/_/admin/bundles" },
  { name: "keys", path: () => "/_/admin/keys" },
  { name: "settings", path: () => "/_/admin/settings" },
];

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle");
  // Let buffered observers flush and late widgets paint.
  await page.waitForTimeout(THROTTLED ? 1500 : 400);
}

const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, "");

test.describe("cold load weight", () => {
  test("a cold dashboard stays inside the weight budget and every response answers", async ({ browser }) => {
    // A fresh context has an empty cache: everything comes over the wire.
    const context = await browser.newContext({ storageState: AUTH_STATE });
    await context.addInitScript(VITALS_INIT_SCRIPT);
    const page = await context.newPage();
    const errors = watchErrors(page);
    const responses = await recordResponses(context, page);
    if (THROTTLED) await throttle(context, page);

    await page.goto("/_/admin/dashboard");
    await settle(page);

    const records = responses();
    const wire = records.reduce((n, r) => n + r.encodedBytes, 0);
    const vitals = await collectVitals(page);
    console.log(formatVitals("dashboard (cold)", vitals, wire));
    for (const r of [...records].sort((a, b) => b.encodedBytes - a.encodedBytes).slice(0, 5)) {
      console.log(`    ${kb(r.encodedBytes).padStart(7)}  ${path(r.url).slice(0, 90)}`);
    }

    const failed = records.filter((r) => r.status >= 400).map((r) => `${r.status} ${path(r.url)}`);
    expect(failed, "every response the page requests answers").toEqual([]);
    expect(wire, "cold wire bytes").toBeLessThan(ADMIN_COLD_BUDGET);
    const oversized = records.filter((r) => r.encodedBytes > SINGLE_RESPONSE_BUDGET).map((r) => `${kb(r.encodedBytes)} ${path(r.url)}`);
    expect(oversized, "no single response above budget").toEqual([]);
    expect(vitals.cls, "cumulative layout shift").toBeLessThan(CLS_BUDGET);

    // Fonts are self-hosted: nothing on the critical path leaves the origin.
    const origin = new URL(page.url()).origin;
    const thirdParty = records.filter((r) => !r.url.startsWith(origin)).map((r) => r.url);
    expect(thirdParty, "every request stays on the origin").toEqual([]);

    // The icon font is the static instance (322 KB), not the 3.98 MB
    // variable font, and it arrives with the text fonts.
    const iconFont = records.find((r) => /\/fonts\/material-symbols-outlined-v\d+\.woff2$/.test(r.url));
    expect(iconFont, "icon font requested").toBeDefined();
    expect(iconFont!.encodedBytes).toBeLessThan(SINGLE_RESPONSE_BUDGET);
    for (const family of ["manrope", "space-grotesk"]) {
      expect(records.some((r) => r.url.includes(`/fonts/${family}-v`)), `${family} requested`).toBe(true);
    }

    // Version-stamped files served as immutable (public/_headers).
    const immutable = records.filter((r) => /\/fonts\/|\/htmx-[\d.]+\.min\.js$/.test(r.url));
    expect(immutable.length, "versioned assets requested").toBeGreaterThan(0);
    const revalidating = immutable.filter((r) => !r.cacheControl?.includes("immutable")).map((r) => path(r.url));
    expect(revalidating, "versioned assets cached as immutable").toEqual([]);

    errors.assertClean();
    await context.close();
  });

  test("a cold signed-out landing page stays inside the weight budget", async ({ browser }) => {
    // browser.newContext() inherits the project's signed-in storageState;
    // dropping the cookies leaves an anonymous visitor with an empty cache.
    const context = await browser.newContext();
    await context.clearCookies();
    await context.addInitScript(VITALS_INIT_SCRIPT);
    const page = await context.newPage();
    const errors = watchErrors(page);
    const responses = await recordResponses(context, page);
    if (THROTTLED) await throttle(context, page);

    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await settle(page);

    const records = responses();
    const wire = records.reduce((n, r) => n + r.encodedBytes, 0);
    const vitals = await collectVitals(page);
    console.log(formatVitals("landing (cold)", vitals, wire));

    expect(records.filter((r) => r.status >= 400).map((r) => `${r.status} ${path(r.url)}`)).toEqual([]);
    expect(wire, "cold wire bytes").toBeLessThan(LANDING_COLD_BUDGET);
    expect(vitals.cls).toBeLessThan(CLS_BUDGET);
    errors.assertClean();
    await context.close();
  });
});

test.describe("every admin page", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(VITALS_INIT_SCRIPT);
  });

  for (const { name, path: pagePath } of ADMIN_PAGES) {
    test(`${name}: stable layout and an accessible DOM`, async ({ page, context }) => {
      const errors = watchErrors(page);
      const responses = await recordResponses(context, page);
      if (THROTTLED) await throttle(context, page);

      await page.goto(pagePath());
      await settle(page);

      const vitals = await collectVitals(page);
      console.log(formatVitals(name, vitals));
      expect(vitals.cls, "cumulative layout shift").toBeLessThan(CLS_BUDGET);
      expect(responses().filter((r) => r.status >= 400).map((r) => `${r.status} ${path(r.url)}`)).toEqual([]);

      const a11y = await page.evaluate(() => {
        const short = (el: Element) => el.outerHTML.replace(/\s+/g, " ").slice(0, 120);
        const exposedIcons = [...document.querySelectorAll(".icon")].filter((el) => el.getAttribute("aria-hidden") !== "true").map(short);
        const h1s = [...document.querySelectorAll("h1")].map((el) => el.textContent?.trim() ?? "");
        const unlabelled = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
          .filter((el) => {
            if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return false;
            if (el.id && document.querySelector(`label[for="${el.id}"]`)) return false;
            return !el.closest("label");
          })
          .map(short);
        const unnamed = [...document.querySelectorAll("button, a[href], [role=button]")]
          .filter((el) => {
            if (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("aria-labelledby")) return false;
            const clone = el.cloneNode(true) as Element;
            clone.querySelectorAll("[aria-hidden=true]").forEach((hidden) => hidden.remove());
            return !clone.textContent?.trim() && !clone.querySelector("img[alt]:not([alt=''])");
          })
          .map(short);
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        return { lang: document.documentElement.lang, exposedIcons, h1s, unlabelled, unnamed, duplicateIds };
      });

      expect(a11y.lang, "html lang").toBeTruthy();
      expect(a11y.exposedIcons, "icon glyphs read out by screen readers").toEqual([]);
      expect(a11y.h1s, "exactly one h1").toHaveLength(1);
      expect(a11y.unlabelled, "form controls without a label").toEqual([]);
      expect(a11y.unnamed, "controls without an accessible name").toEqual([]);
      expect(a11y.duplicateIds, "duplicate ids").toEqual([]);
      errors.assertClean();
    });
  }
});
