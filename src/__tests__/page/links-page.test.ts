// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { LinkRepository, SlugRepository } from "../../db";
import { applyMigrations, resetData } from "../setup";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, init);
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

  it("renders a range picker linking to the same path", async () => {
    const res = await SELF.fetch(req("/_/admin/links"));
    const html = await res.text();
    expect(html).toMatch(/class="range-picker"/);
    expect(html).toMatch(/href="\/_\/admin\/links\?[^"]*range=7d/);
    expect(html).toMatch(/href="\/_\/admin\/links\?[^"]*range=all/);
  });

  it("localizes the range picker's aria-label and option labels instead of hardcoding English", async () => {
    const res = await SELF.fetch(req("/_/admin/links", { headers: { Cookie: "lang=id" } }));
    const html = await res.text();
    expect(html).toContain('aria-label="Pilih rentang waktu"');
    expect(html).toMatch(/data-range="all"[^>]*>SEMUA</);
    expect(html).not.toContain('aria-label="Select time range"');
  });

  it("the range query param overrides the default and updates the column header", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const res = await SELF.fetch(req("/_/admin/links?range=7d"));
    const html = await res.text();
    expect(html).toMatch(/Clicks\s*\(7d\)/i);
  });

  it("localizes the range in the clicks column header instead of showing the raw range key", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const res = await SELF.fetch(req("/_/admin/links?range=24h", { headers: { Cookie: "lang=id" } }));
    const html = await res.text();
    // id.ts localizes "range.24h" to "24J"; the raw internal key "24h"
    // must not leak through untranslated.
    expect(html).toContain("Klik (24J)");
    expect(html).not.toContain("(24h)");
  });

  it("the displayed click total reflects the selected range", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();

    const all = await SELF.fetch(req("/_/admin/links?range=all"));
    const allHtml = await all.text();
    const allMatch = allHtml.match(/class="col-clicks-value">([^<]+)</);
    expect(allMatch?.[1]).toBe("2");

    const last7 = await SELF.fetch(req("/_/admin/links?range=7d"));
    const last7Html = await last7.text();
    const last7Match = last7Html.match(/class="col-clicks-value">([^<]+)</);
    expect(last7Match?.[1]).toBe("1");
  });

  it("changing filter or sort preserves the active range in URLs", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const res = await SELF.fetch(req("/_/admin/links?range=7d"));
    const html = await res.text();
    // Param order is implementation-defined; assert that range=7d co-occurs with each navigation link.
    const sortHrefs = [...html.matchAll(/href="(\/_\/admin\/links\?[^"]*sort=popular[^"]*)"/g)].map((m) => m[1]);
    const filterHrefs = [...html.matchAll(/href="(\/_\/admin\/links\?[^"]*filter=disabled[^"]*)"/g)].map((m) => m[1]);
    expect(sortHrefs.some((h) => h.includes("range=7d"))).toBe(true);
    expect(filterHrefs.some((h) => h.includes("range=7d"))).toBe(true);
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

  it("delta pct of 4+ digits uses locale thousands separators", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });
    const now = Math.floor(Date.now() / 1000);
    // 1 click in the previous 30d window, 15 clicks in the current → pct = 1400
    const insertClick = env.DB.prepare("INSERT INTO clicks (slug, clicked_at) VALUES (?, ?)");
    await insertClick.bind(link.slugs[0].slug, now - 40 * 86400).run();
    for (let i = 0; i < 15; i++) {
      await insertClick.bind(link.slugs[0].slug, now - 60 - i).run();
    }

    // Pin lang=en so the comma-grouping assertion is deterministic regardless of
    // future default-locale changes.
    const res = await SELF.fetch(req("/_/admin/links", { headers: { Cookie: "lang=en" } }));
    const html = await res.text();
    expect(html).toMatch(/class="delta-label">\+1,400%</);
    expect(html).not.toMatch(/class="delta-label">\+1400%</);
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

  it("clamps a negative page param instead of producing an empty, out-of-range slice", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?page=-3"));
    const html = await res.text();
    expect(html).toMatch(/1\s*[–-]\s*25\s+of\s+30/);
  });

  it("marks the active page with aria-current and renders ellipses outside the window", async () => {
    // per_page=1 gives 8 pages from 8 links, past the 7-item compact window.
    for (let i = 0; i < 8; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=1&page=1"));
    const html = await res.text();
    // Page 1 is the active link and carries aria-current.
    expect(html).toMatch(/<a[^>]*class="page-btn active"[^>]*aria-current="page"[^>]*>1</);
    // Pages 6 and 7 are outside the window, replaced by an ellipsis span.
    expect(html).toMatch(/<span class="page-ellipsis"/);
    expect(html).not.toMatch(/class="page-btn[^"]*"[^>]*>6</);
  });

  it("clamps a negative per_page param instead of an inverted slice range", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=-5"));
    const html = await res.text();
    expect(html).toMatch(/1\s*[–-]\s*1\s+of\s+30/);
  });
});

describe("Links listing page windowing", () => {
  async function seed(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `s${i}` });
    }
  }

  function rowCount(html: string): number {
    return [...html.matchAll(/class="col-short-chip-slug">/g)].length;
  }

  it("renders only the requested window of rows, not the whole catalog", async () => {
    await seed(60);
    const res = await SELF.fetch(req("/_/admin/links?per_page=25"));
    const html = await res.text();
    expect(rowCount(html)).toBe(25);
    expect(html).toMatch(/1\s*[–-]\s*25\s+of\s+60/);
  });

  it("serves the next window on page 2 with no overlap", async () => {
    await seed(30);
    const first = await (await SELF.fetch(req("/_/admin/links?per_page=25&page=1"))).text();
    const second = await (await SELF.fetch(req("/_/admin/links?per_page=25&page=2"))).text();
    expect(rowCount(second)).toBe(5);
    expect(second).toMatch(/26\s*[–-]\s*30\s+of\s+30/);
    const slugsOn = (html: string) =>
      [...html.matchAll(/class="col-short-chip-slug">([^<]+)</g)].map((m) => m[1]);
    const firstSlugs = new Set(slugsOn(first));
    expect(slugsOn(second).some((s) => firstSlugs.has(s))).toBe(false);
  });

  it("caps per_page so a crafted query cannot pull the catalog into one page", async () => {
    await seed(120);
    const res = await SELF.fetch(req("/_/admin/links?per_page=100000"));
    const html = await res.text();
    expect(rowCount(html)).toBe(100);
    expect(html).toMatch(/1\s*[–-]\s*100\s+of\s+120/);
  });

  it("sorts popular across the whole catalog, not within the rendered page", async () => {
    await seed(30);
    // s0 is the oldest link, so recent order puts it on the last page. Its
    // click lead must still float it to the top of page 1 under popular sort.
    const now = Math.floor(Date.now() / 1000);
    const insert = env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    );
    await insert.bind("s0", now - 60).run();
    await insert.bind("s0", now - 61).run();

    const html = await (await SELF.fetch(req("/_/admin/links?sort=popular&per_page=25"))).text();
    const slugs = [...html.matchAll(/class="col-short-chip-slug">([^<]+)</g)].map((m) => m[1]);
    expect(slugs[0]).toBe("s0");
  });

  it("counts and pages the filtered set for the disabled filter", async () => {
    for (let i = 0; i < 6; i++) {
      const link = await LinkRepository.create(env.DB, { url: `https://e${i}.com`, slug: `d${i}` });
      if (i % 2 === 0) {
        await LinkRepository.update(env.DB, link.id, { expires_at: Math.floor(Date.now() / 1000) - 10 });
      }
    }
    const html = await (await SELF.fetch(req("/_/admin/links?filter=disabled&per_page=2"))).text();
    expect(html).toMatch(/1\s*[–-]\s*2\s+of\s+3/);
    expect(rowCount(html)).toBe(2);
  });

  it("windows search results and counts every match", async () => {
    await seed(30);
    const html = await (await SELF.fetch(req("/_/admin/links?search=example&per_page=10&page=2"))).text();
    expect(html).toContain("30 matching links");
    expect(rowCount(html)).toBe(10);
    expect(html).toMatch(/11\s*[–-]\s*20\s+of\s+30/);
  });

  it("keeps the all-disabled empty state when the active filter hides everything", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await LinkRepository.update(env.DB, link.id, { expires_at: Math.floor(Date.now() / 1000) - 10 });
    const html = await (await SELF.fetch(req("/_/admin/links", { headers: { Cookie: "lang=en" } }))).text();
    expect(html).toContain("All links are disabled");
  });

  it("shows the first-run empty state when there are no links at all", async () => {
    const html = await (await SELF.fetch(req("/_/admin/links", { headers: { Cookie: "lang=en" } }))).text();
    expect(html).toContain("No links yet");
  });
});
