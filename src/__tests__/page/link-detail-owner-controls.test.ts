// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Rule 6 (CLAUDE.md, "Authorization model"): the link owner owns its slugs,
// set primary included. The server answers 403 to anyone else, so the menu
// offers Change primary to the owner alone, the way it already offers the
// per-slug row actions.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, SlugRepository } from "../../db";

// DEV_IDENTITY in the test pool: the identity every unauthenticated request gets.
const VIEWER = "dev@local";
const SOMEONE_ELSE = "other@example.com";

async function detailHtml(id: number): Promise<string> {
  const res = await SELF.fetch(new Request(`https://shrtnr.test/_/admin/links/${id}`));
  expect(res.status).toBe(200);
  return res.text();
}

async function seed(owner: string, expiresAt?: number): Promise<number> {
  const link = await LinkRepository.create(env.DB, {
    url: "https://example.com/page",
    slug: "sys",
    label: "A label",
    createdBy: owner,
    expiresAt,
  });
  await SlugRepository.addCustom(env.DB, link.id, "custom-one");
  return link.id;
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("link detail: Change primary belongs to the owner", () => {
  it("offers the owner Change primary once the link has a custom slug", async () => {
    const html = await detailHtml(await seed(VIEWER));
    expect(html).toContain("showChangePrimaryModal(");
  });

  it("does not offer it to a non-owner", async () => {
    const html = await detailHtml(await seed(SOMEONE_ELSE));
    expect(html).not.toContain("showChangePrimaryModal(");
  });

  it("still offers a non-owner the two open actions and Duplicate", async () => {
    const html = await detailHtml(await seed(SOMEONE_ELSE));
    expect(html).toContain("showAddSlugModal(");
    expect(html).toContain("showAddToBundleModal(");
    expect(html).toContain("data-duplicate-link=");
  });
});

describe("link detail: the expiry editor carries an instant, not a wall-clock time", () => {
  // The editor used to be prefilled with the expiry's UTC wall time, which the
  // browser then read back as local time: saving it unchanged moved the expiry
  // by the viewer's UTC offset. The page now hands over the instant and the
  // browser renders it in its own time zone (toLocalInputValue in client.ts).
  it("hands the epoch to the browser and prefills no UTC wall time", async () => {
    const expiresAt = 2_000_000_000; // 2033-05-18T03:33:20Z
    const html = await detailHtml(await seed(VIEWER, expiresAt));
    const input = html.match(/<input\b[^>]*\bid="detail-expires"[^>]*>/);
    expect(input).not.toBeNull();
    expect(input![0]).toContain(`data-expires-at="${expiresAt}"`);
    expect(input![0]).not.toContain("2033-05-18T03:33");
  });

  it("hands over nothing for a link that never expires", async () => {
    const html = await detailHtml(await seed(VIEWER));
    const input = html.match(/<input\b[^>]*\bid="detail-expires"[^>]*>/);
    expect(input).not.toBeNull();
    expect(input![0]).not.toMatch(/data-expires-at="\d/);
  });
});

describe("link detail: the expiry line", () => {
  function expiryDisplay(html: string): string {
    const m = html.match(/<span\b[^>]*\bid="expiry-display"[^>]*>([\s\S]*?)<div\b[^>]*\bid="expiry-form"/);
    expect(m).not.toBeNull();
    return m![1];
  }

  // Epoch 0 is a valid expiry the API accepts, and a visit to such a link
  // answers 404. The page must not call it a link that never expires.
  it("shows a date for an expiry of epoch 0, not Never expires", async () => {
    const html = await detailHtml(await seed(VIEWER, 0));
    const display = expiryDisplay(html);
    expect(display).not.toContain("Never expires");
    expect(display).toContain("1970");
  });

  it("says Never expires for a link with no expiry", async () => {
    const html = await detailHtml(await seed(VIEWER));
    expect(expiryDisplay(html)).toContain("Never expires");
  });

  // The Worker formats in UTC. The browser repaints the date in the viewer's
  // zone, so the line and the editor name the same day; for that it needs the
  // instant.
  it("hands the browser the instant behind the date it shows", async () => {
    const expiresAt = 2_000_000_000;
    const html = await detailHtml(await seed(VIEWER, expiresAt));
    expect(expiryDisplay(html)).toMatch(new RegExp(`<strong\\b[^>]*\\bdata-local-date="${expiresAt}"[^>]*>[^<]*2033`));
  });
});
