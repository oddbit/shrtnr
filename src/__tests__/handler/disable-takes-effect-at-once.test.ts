// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Disabling a link stamps it with the current second. The redirect refuses a
// link from that second on, so the admin must call it disabled from that
// second on too. The listing and the detail page used to wait for the next
// second: the page reload that follows a click on Disable could list the
// link as active and offer Disable again.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository } from "../../db";

// DEV_IDENTITY in the test pool: the identity every unauthenticated request gets.
const VIEWER = "dev@local";
const T = 2_000_000_000;

beforeAll(applyMigrations);
beforeEach(resetData);

async function html(path: string): Promise<string> {
  const res = await SELF.fetch(new Request(`https://shrtnr.test${path}`));
  expect(res.status).toBe(200);
  return res.text();
}

describe("a link disabled this second", () => {
  it("counts as disabled, not active, in the listing query at that same second", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/a", slug: "aaa", expiresAt: T });

    expect((await LinkRepository.page(env.DB, { limit: 25, status: "active", now: T })).total).toBe(0);
    expect((await LinkRepository.page(env.DB, { limit: 25, status: "disabled", now: T })).total).toBe(1);
    expect(await LinkRepository.count(env.DB, { status: "active", now: T })).toBe(0);
    expect(await LinkRepository.count(env.DB, { status: "disabled", now: T })).toBe(1);
    // One second earlier it was still live.
    expect(await LinkRepository.count(env.DB, { status: "active", now: T - 1 })).toBe(1);
  });

  // These read the pages right after the disable, as the admin's reload does.
  // Should the clock tick between the two, the old code passes as well: the
  // query test above is the one that pins the boundary on every run.
  it("leaves the Active listing and shows under Disabled on the next page load", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/a", slug: "aaa", createdBy: VIEWER });
    await LinkRepository.disable(env.DB, link.id);

    expect(await html("/_/admin/links")).not.toContain('data-copy-slug="aaa"');
    const disabled = await html("/_/admin/links?filter=disabled");
    expect(disabled).toContain('data-copy-slug="aaa"');
    expect(disabled).toContain("slug-chip-disabled");
  });

  it("is offered Enable, not Disable, on its detail page", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/a", slug: "aaa", createdBy: VIEWER });
    await LinkRepository.disable(env.DB, link.id);

    const page = await html(`/_/admin/links/${link.id}`);
    expect(page).toContain(`showEnableLinkModal(${link.id})`);
    expect(page).not.toContain(`showDisableLinkModal(${link.id})`);
  });
});
