// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { LinkRepository, SlugRepository } from "../db";
import { applyMigrations, resetData } from "./setup";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("Links listing page", () => {
  it("shows only the primary slug, not other aliases", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });
    // First custom slug becomes primary automatically
    await SlugRepository.addCustom(env.DB, link.id, "my-custom-alias");
    await SlugRepository.addCustom(env.DB, link.id, "another-alias");

    const res = await SELF.fetch(req("/_/admin/links"));
    expect(res.status).toBe(200);
    const html = await res.text();

    // The primary slug (first custom added) should appear
    expect(html).toContain("my-custom-alias");
    // Non-primary slugs should not appear on the listing page
    expect(html).not.toContain("another-alias");
  });

  it("shows the designated primary slug when a custom slug is set as primary", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });
    await SlugRepository.addCustom(env.DB, link.id, "branded-link");
    await SlugRepository.setPrimary(env.DB, link.id, "branded-link");

    const res = await SELF.fetch(req("/_/admin/links"));
    expect(res.status).toBe(200);
    const html = await res.text();

    // The designated primary slug should appear
    expect(html).toContain("branded-link");
  });

  it("clicks column header includes a range indicator", async () => {
    await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });
    const res = await SELF.fetch(req("/_/admin/links"));
    const html = await res.text();
    // Expect the header row to contain a range window (e.g. "Clicks (30d)")
    expect(html).toMatch(/Clicks\s*\(30d\)/i);
  });

  it("delta pct renders inside the created column, not the clicks column", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });
    // Seed clicks in both the current and previous 30d windows so a delta is computed
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)")
      .bind(link.slugs[0].slug, now - 60)
      .run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)")
      .bind(link.slugs[0].slug, now - 40 * 86400)
      .run();

    const res = await SELF.fetch(req("/_/admin/links"));
    const html = await res.text();
    // Delta pill should be present somewhere
    expect(html).toMatch(/class="delta /);
    // The delta should appear in a created-column cell, not a clicks-column cell
    expect(html).toMatch(/<td[^>]*class="[^"]*col-date[^"]*"[^>]*>[\s\S]*?class="delta /);
  });

  it("pagination shows a '1–N of Total' summary", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links"));
    const html = await res.text();
    expect(html).toMatch(/1\s*[–-]\s*25\s+of\s+30/);
  });
});
