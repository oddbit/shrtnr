// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { test as setup, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { AUTH_STATE, BASE_URL, IDENTITY, SEED_FILE, type Seed, type SeededLink } from "./env";

/**
 * Signs in through the dev login route, seeds a catalog with known shape, and
 * hands both to the specs: the cookie as Playwright storageState, the catalog
 * as seed.json.
 *
 * Shape: 60 links, 2 of them disabled, 3 of them clicked (5, 3, 1 times). That
 * gives three pages at 25 per page, a non-empty result for every status
 * filter, and a popular order that differs from the recent one.
 */
const TOTAL = 60;
const DISABLED = 2;
const CLICKS = [5, 3, 1];

setup("sign in and seed the catalog", async () => {
  const api = await request.newContext({ baseURL: BASE_URL });

  // The real login route, so the suite also proves the cookie flow works in
  // a client that follows redirects the way a browser does.
  const login = await api.get(`/_/dev/login?as=${encodeURIComponent(IDENTITY)}`);
  expect(login.ok()).toBe(true);
  expect(login.url()).toContain("/_/admin/dashboard");

  const links: SeededLink[] = [];
  for (let i = 1; i <= TOTAL; i++) {
    const res = await api.post("/_/admin/api/links", {
      data: { url: `https://e2e.example/page-${i}`, label: `E2E link ${i}` },
    });
    // 201 on a fresh database; 200 (duplicate) when a local server is reused.
    expect([200, 201]).toContain(res.status());
    const body = (await res.json()) as { id: number; label: string; url: string; slugs: { slug: string }[] };
    links.push({ id: body.id, slug: body.slugs[0].slug, label: body.label, url: body.url });
  }

  const disabledLinks = links.slice(0, DISABLED);
  for (const link of disabledLinks) {
    const res = await api.post(`/_/admin/api/links/${link.id}/disable`);
    expect(res.ok()).toBe(true);
  }

  // Clicks record through the redirect's waitUntil, so drive the redirect and
  // then wait for the count to land before handing the seed to the specs.
  const clicked = links.slice(DISABLED, DISABLED + CLICKS.length);
  for (const [i, link] of clicked.entries()) {
    for (let n = 0; n < CLICKS[i]; n++) {
      const res = await api.get(`/${link.slug}`, { maxRedirects: 0 });
      expect(res.status()).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
    }
  }
  for (const [i, link] of clicked.entries()) {
    await expect
      .poll(
        async () => {
          const res = await api.get(`/_/admin/api/links/${link.id}`);
          return ((await res.json()) as { total_clicks: number }).total_clicks;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(CLICKS[i]);
  }

  const seed: Seed = {
    identity: IDENTITY,
    links,
    active: TOTAL - DISABLED,
    disabled: DISABLED,
    popular: clicked.map((link, i) => ({ link, clicks: CLICKS[i] })),
    newest: links[links.length - 1],
    disabledLinks,
  };
  fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
  fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  await api.storageState({ path: AUTH_STATE });
  await api.dispose();
});
