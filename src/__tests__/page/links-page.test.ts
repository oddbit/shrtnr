// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { LinkRepository, SlugRepository } from "../../db";
import { applyMigrations, resetData } from "../setup";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, init);
}

/**
 * The rendered empty state, or "" when the page has rows. The layout embeds
 * every translation string in the admin client script, so a page-wide match
 * on empty copy hits that blob instead of the markup.
 */
function emptyState(html: string): string {
  return html.match(/<div class="empty-state">.*?<\/div>/s)?.[0] ?? "";
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

  it("preserves the active search in pagination URLs", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://pdf.co/document-${i}`,
        slug: `pdf-${i}`,
      });
    }

    const res = await SELF.fetch(req("/_/admin/links?search=pdf.co"));
    const html = await res.text();
    const pageTwoHref = html.match(
      /class="page-btn[^"]*" href="([^"]+)"[^>]*>\s*2\s*<\/a>/,
    )?.[1];
    const decodedHref = pageTwoHref?.replaceAll("&amp;", "&");

    expect(pageTwoHref).toBeDefined();
    expect(decodedHref).toContain("page=2");
    expect(decodedHref).toContain("search=pdf.co");
  });

  // Pull hrefs out of anchors carrying `className`, independent of attribute
  // order, with entity-encoded ampersands decoded for plain substring checks.
  // `label` matches the anchor's visible text once tags are stripped.
  function anchorHrefs(html: string, className: string, label?: string): string[] {
    const found: string[] = [];
    const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = anchor.exec(html)) !== null) {
      const [, attrs, inner] = m;
      if (!new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`).test(attrs)) continue;
      if (label !== undefined && inner.replace(/<[^>]*>/g, "").trim() !== label) continue;
      const href = attrs.match(/href="([^"]*)"/)?.[1];
      if (href) found.push(href.replaceAll("&amp;", "&"));
    }
    return found;
  }

  async function seedSearchFixture(): Promise<void> {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://pdf.co/document-${i}`,
        slug: `pdf-${i}`,
      });
    }
    for (let i = 0; i < 10; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://other.example/note-${i}`,
        slug: `other-${i}`,
      });
    }
  }

  it("lists only matching links when page two of a search is opened", async () => {
    await seedSearchFixture();

    const first = await SELF.fetch(req("/_/admin/links?search=pdf.co"));
    const [pageTwo] = anchorHrefs(await first.text(), "page-btn", "2");
    expect(pageTwo).toBeDefined();

    const res = await SELF.fetch(req(pageTwo));
    expect(res.status).toBe(200);
    const html = await res.text();

    // 30 matches, not the 40 links in the table.
    expect(html).toMatch(/26\s*[–-]\s*30\s+of\s+30/);
    expect(html).not.toContain("other.example");
    // The search box stays populated so the query is still editable.
    expect(html).toMatch(/id="quick-url"[^>]*value="pdf\.co"/);
  });

  it("carries the active search through sort, filter, and page-size URLs", async () => {
    await seedSearchFixture();

    const res = await SELF.fetch(req("/_/admin/links?search=pdf.co"));
    const html = await res.text();
    const perPageHrefs = [...html.matchAll(/<option value="([^"]*)"/g)].map((m) =>
      m[1].replaceAll("&amp;", "&"),
    );
    const controls = [
      ...anchorHrefs(html, "sort-btn"),
      ...anchorHrefs(html, "filter-chip"),
      ...perPageHrefs,
    ];

    expect(controls).toHaveLength(8);
    // Each control resets to page one but must keep the query.
    for (const href of controls) {
      expect(href).toContain("search=pdf.co");
      expect(href).toContain("page=1");
    }
  });

  it("drops the search from pagination URLs once the query is cleared", async () => {
    await seedSearchFixture();

    const res = await SELF.fetch(req("/_/admin/links"));
    const [pageTwo] = anchorHrefs(await res.text(), "page-btn", "2");

    expect(pageTwo).toBeDefined();
    expect(pageTwo).not.toContain("search=");
  });

  it("gives every row an anchor to its detail page so the keyboard can reach it", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/some/deep/path",
      slug: "abc",
      label: "Example link",
    });

    const html = await (await SELF.fetch(req("/_/admin/links"))).text();

    // A real anchor is a tab stop and answers Enter. The row onclick is a
    // mouse convenience and reaches neither.
    const row = html.match(
      new RegExp(`<a\\b([^>]*href="/_/admin/links/${link.id}"[^>]*)>([\\s\\S]*?)</a>`),
    );
    expect(row).not.toBeNull();
    expect(row![2].replace(/<[^>]*>/g, "").trim()).toBe("Example link");
    // The row handler bails on this target, so the anchor navigates once
    // instead of racing `location.href` to the same URL.
    expect(row![1]).toContain("no-row-nav");
  });

  it("keeps the disabled badge out of the row anchor's accessible name", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "gone",
      label: "Expired link",
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });

    const html = await (
      await SELF.fetch(req("/_/admin/links?filter=all"))
    ).text();

    const row = html.match(
      new RegExp(`<a\\b[^>]*href="/_/admin/links/${link.id}"[^>]*>([\\s\\S]*?)</a>`),
    );
    expect(row).not.toBeNull();
    // "Expired link", not "Expired link Disabled".
    expect(row![1].replace(/<[^>]*>/g, "").trim()).toBe("Expired link");
  });

  it("leaves the row onclick in place as the mouse shortcut", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
    });

    const html = await (await SELF.fetch(req("/_/admin/links"))).text();

    // JSX entity-encodes the quotes inside the attribute value.
    expect(html).toContain(
      `location.href=&#39;/_/admin/links/${link.id}&#39;`,
    );
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

  it("gives the prev/next chevrons accessible names and hides the glyph text", async () => {
    for (let i = 0; i < 8; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=1&page=4"));
    const html = await res.text();
    expect(html).toMatch(/<a[^>]*class="page-btn"[^>]*aria-label="Previous page"/);
    expect(html).toMatch(/<a[^>]*class="page-btn"[^>]*aria-label="Next page"/);
    // The icon-font glyph is decorative and must not reach the accessibility tree.
    expect(html).toMatch(/<span class="icon icon-sm" aria-hidden="true">chevron_left<\/span>/);
    expect(html).toMatch(/<span class="icon icon-sm" aria-hidden="true">chevron_right<\/span>/);
  });

  it("keeps the disabled prev control out of the tab order on the first page", async () => {
    for (let i = 0; i < 8; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=1&page=1"));
    const html = await res.text();
    const prev = html.match(/<[a-z]+[^>]*class="page-btn disabled"[^>]*aria-label="Previous page"[^>]*>/);
    expect(prev).not.toBeNull();
    const tag = prev![0];
    // No href means no keyboard focus and no dead navigation to "#".
    expect(tag).not.toContain("href");
    expect(tag).toContain('aria-disabled="true"');
    expect(tag).toContain('role="link"');
    // The next control is still live on page 1.
    const next = html.match(/<a[^>]*aria-label="Next page"[^>]*>/);
    expect(next).not.toBeNull();
    expect(next![0]).toContain("href=");
  });

  it("keeps the disabled next control out of the tab order on the last page", async () => {
    for (let i = 0; i < 8; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=1&page=8"));
    const html = await res.text();
    const next = html.match(/<[a-z]+[^>]*class="page-btn disabled"[^>]*aria-label="Next page"[^>]*>/);
    expect(next).not.toBeNull();
    expect(next![0]).not.toContain("href");
    expect(next![0]).toContain('aria-disabled="true"');
  });

  it("wraps the page links in a named navigation landmark", async () => {
    for (let i = 0; i < 8; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=1&page=1"));
    const html = await res.text();
    expect(html).toMatch(/<nav class="pagination-pages" aria-label="Pagination">/);
    expect(html).not.toMatch(/<div class="pagination-pages"/);
  });

  it("clamps an unparseable page param onto the first page", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `s${i}` });
    }
    const html = await (await SELF.fetch(req("/_/admin/links?page=abc"))).text();
    expect(html).toMatch(/1\s*[–-]\s*25\s+of\s+30/);
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

  it("hides the page buttons when a wider per_page fits every link on one page", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=100"));
    expect(res.status).toBe(200);
    const html = await res.text();
    // All 30 rows land on page 1, so there is nothing to page through.
    expect(html.match(/class="col-short-chip-slug"/g)).toHaveLength(30);
    expect(html).not.toContain('class="pagination-pages"');
    expect(html).not.toMatch(/class="page-btn/);
    // The summary and the per-page selector survive: they are the only way back to 25.
    expect(html).toContain('class="pagination"');
    expect(html).toContain('class="pagination-summary"');
    expect(html).toContain("per-page-select");
  });

  it("hides the page buttons when a filter narrows the result set to one page", async () => {
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
        expiresAt: i < 2 ? now - 3600 : null,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?filter=disabled"));
    expect(res.status).toBe(200);
    const html = await res.text();
    // Only s0 and s1 are expired; the unfiltered count must not decide this.
    expect(html.match(/class="col-short-chip-slug"/g)).toHaveLength(2);
    expect(html).toContain(">s0<");
    expect(html).toContain(">s1<");
    expect(html).not.toContain(">s2<");
    expect(html).not.toContain('class="pagination-pages"');
    expect(html).not.toMatch(/class="page-btn/);
    expect(html).toContain('class="pagination-summary"');
    expect(html).toContain("per-page-select");
  });

  it("still renders the page buttons when the result set spans more than one page", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="pagination"');
    expect(html).toContain('class="pagination-pages"');
    expect(html).toMatch(/class="page-btn[^"]*"[^>]*>2</);
    expect(html).toContain("per-page-select");
  });

  it("keeps the per-page selector reachable after widening per_page", async () => {
    for (let i = 0; i < 30; i++) {
      await LinkRepository.create(env.DB, {
        url: `https://example${i}.com`,
        slug: `s${i}`,
      });
    }
    const res = await SELF.fetch(req("/_/admin/links?per_page=50"));
    expect(res.status).toBe(200);
    const html = await res.text();
    // Every in-page link re-emits per_page, so the selector is the only route back to 25.
    expect(html).toContain("per-page-select");
    expect(html).toContain("per_page=25");
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

  it("does not claim every link is disabled when the disabled filter matched nothing", async () => {
    for (const slug of ["one", "two", "three"]) {
      await LinkRepository.create(env.DB, { url: `https://example.com/${slug}`, slug });
    }
    const html = await (
      await SELF.fetch(req("/_/admin/links?filter=disabled", { headers: { Cookie: "lang=en" } }))
    ).text();

    expect(emptyState(html)).not.toContain("All links are disabled");
    expect(emptyState(html)).toContain("No links match");
  });

  it("points the all-disabled empty state at the filter that shows them", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await LinkRepository.update(env.DB, link.id, { expires_at: Math.floor(Date.now() / 1000) - 10 });
    const html = await (await SELF.fetch(req("/_/admin/links", { headers: { Cookie: "lang=en" } }))).text();

    // The filter chips replaced the "Show disabled" toggle the copy named.
    expect(html).not.toContain("Show disabled");
  });

  it("names the query in the empty state when a search matched nothing", async () => {
    await seed(3);
    const html = await (
      await SELF.fetch(req("/_/admin/links?search=zzz", { headers: { Cookie: "lang=en" } }))
    ).text();

    // The search emptied the window, and the default Active chip is narrowing
    // too, so the copy names both. Match the whole sentence, so a bare query or
    // an unreplaced placeholder sitting next to one cannot pass.
    expect(emptyState(html)).toContain("No links match &quot;zzz&quot; in Active.");
    expect(emptyState(html)).not.toContain("current filter");
    expect(emptyState(html)).not.toContain("No links yet");
  });

  it("names the filter alongside the query when a chip is narrowing too", async () => {
    // A link matching "one" exists and is one chip away, so blaming the query
    // alone would be as wrong as blaming the filter alone.
    for (const slug of ["one", "two", "three"]) {
      await LinkRepository.create(env.DB, { url: `https://example.com/${slug}`, slug });
    }
    const html = await (
      await SELF.fetch(
        req("/_/admin/links?filter=disabled&search=one", { headers: { Cookie: "lang=en" } }),
      )
    ).text();

    expect(emptyState(html)).toContain("No links match &quot;one&quot; in Disabled.");
  });

  it("names only the query when the All chip is hiding nothing", async () => {
    await seed(3);
    const html = await (
      await SELF.fetch(
        req("/_/admin/links?filter=all&search=zzz", { headers: { Cookie: "lang=en" } }),
      )
    ).text();

    // Nothing is narrowing but the search, so there is no filter to name.
    expect(emptyState(html)).toContain("No links match &quot;zzz&quot;.");
    expect(emptyState(html)).not.toContain("in All");
  });

  it("keeps the filter wording when a filter, not a search, emptied the list", async () => {
    await seed(3);
    const html = await (
      await SELF.fetch(req("/_/admin/links?filter=disabled", { headers: { Cookie: "lang=en" } }))
    ).text();

    expect(emptyState(html)).toContain("No links match the current filter.");
  });

  it("escapes markup in a search query before naming it in the empty state", async () => {
    await seed(3);
    const html = await (
      await SELF.fetch(
        req(`/_/admin/links?search=${encodeURIComponent("<b>zzz</b>")}`, {
          headers: { Cookie: "lang=en" },
        }),
      )
    ).text();

    expect(emptyState(html)).toContain("&lt;b&gt;zzz&lt;/b&gt;");
    expect(emptyState(html)).not.toContain("<b>zzz</b>");
  });

  it("treats a whitespace-only search as no search at all", async () => {
    // The repository returns nothing for a search that trims to empty, so an
    // untrimmed query reaches the empty state and gets attributed to whatever
    // the filter happens to be. Under the default Active filter that reads
    // "All links are disabled" over a catalog where nothing is disabled.
    await seed(3);
    for (const url of ["/_/admin/links?search=%20%20", "/_/admin/links?filter=all&search=%20"]) {
      const html = await (await SELF.fetch(req(url, { headers: { Cookie: "lang=en" } }))).text();
      expect(emptyState(html)).toBe("");
      expect(rowCount(html)).toBe(3);
    }
  });

  it("does not print a row count above an empty state", async () => {
    for (const slug of ["one", "two", "three"]) {
      await LinkRepository.create(env.DB, { url: `https://example.com/${slug}`, slug });
    }
    const html = await (
      await SELF.fetch(req("/_/admin/links?search=xyzzy-nothing", { headers: { Cookie: "lang=en" } }))
    ).text();

    expect(emptyState(html)).toContain("No links match");
    expect(emptyState(html)).not.toContain("No links yet");
  });
});
