// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Page-weight and accessibility invariants of the admin shell, pinned after
// the web performance review of 2026-09-21. The browser perf spec
// (e2e/perf.spec.ts) measures the same things against real network
// responses; this suite catches a regression in the emitted HTML before a
// browser ever loads it.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository } from "../../db";
import { adminClientScript } from "../../client";
import en from "../../i18n/en";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
}

async function fetchHtml(path: string): Promise<string> {
  const res = await SELF.fetch(req(path));
  expect(res.status, path).toBe(200);
  return res.text();
}

/** Every opening tag that carries the icon class, with its full attribute list. */
function iconTags(html: string): string[] {
  return html.match(/<span\b[^>]*\bclass="icon[^"]*"[^>]*>/g) ?? [];
}

beforeAll(applyMigrations);
beforeEach(resetData);

async function adminPages(): Promise<{ name: string; path: string }[]> {
  const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
  return [
    { name: "dashboard", path: "/_/admin/dashboard" },
    { name: "links", path: "/_/admin/links" },
    { name: "link detail", path: `/_/admin/links/${link.id}` },
    { name: "bundles", path: "/_/admin/bundles" },
    { name: "keys", path: "/_/admin/keys" },
    { name: "settings", path: "/_/admin/settings" },
  ];
}

describe("admin layout head", () => {
  it("requests the Material Symbols static instance, not the 4 MB variable font", async () => {
    const html = await fetchHtml("/_/admin/settings");
    const iconFont = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols[^"]*)"/);
    expect(iconFont, "icon font stylesheet is linked").not.toBeNull();
    const href = iconFont![1];
    // The full variable font (opsz, wght, FILL, GRAD ranges) weighs 3.98 MB;
    // the static instance weighs 322 KB and the stylesheet only ever sets
    // FILL 0 and wght 400.
    expect(href).not.toMatch(/opsz|wght|FILL|GRAD|@/);
    // Icon fonts show their ligature text ("dashboard", "menu") until the
    // font arrives unless display=block hides it.
    expect(href).toContain("display=block");
  });

  it("keeps display=swap on the text fonts so copy renders in a fallback face immediately", async () => {
    const html = await fetchHtml("/_/admin/settings");
    const textFont = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?family=Space\+Grotesk[^"]*)"/);
    expect(textFont).not.toBeNull();
    expect(textFont![1]).toContain("display=swap");
  });

  it("loads htmx from a version-stamped path so it can be cached as immutable", async () => {
    const html = await fetchHtml("/_/admin/settings");
    expect(html).toMatch(/<script src="\/htmx-\d+\.\d+\.\d+\.min\.js" defer(?:="")?>/);
    expect(html).not.toContain('src="/htmx.min.js"');
  });
});

describe("admin pages: decorative icons are hidden from assistive technology", () => {
  it("every server-rendered icon span carries aria-hidden", async () => {
    for (const { name, path } of await adminPages()) {
      const html = await fetchHtml(path);
      const tags = iconTags(html);
      expect(tags.length, `${name} renders icons`).toBeGreaterThan(0);
      const exposed = tags.filter((tag) => !tag.includes('aria-hidden="true"'));
      expect(exposed, `${name}: icon spans without aria-hidden`).toEqual([]);
    }
  });

  it("every icon span the client script renders carries aria-hidden", () => {
    const script = adminClientScript("1.0.0", en);
    const tags = iconTags(script);
    expect(tags.length).toBeGreaterThan(0);
    const exposed = tags.filter((tag) => !tag.includes('aria-hidden="true"'));
    expect(exposed).toEqual([]);
  });
});

describe("admin pages: document outline", () => {
  it("each page has exactly one h1 and it is the page title", async () => {
    for (const { name, path } of await adminPages()) {
      const html = await fetchHtml(path);
      const h1s = html.match(/<h1\b[^>]*>/g) ?? [];
      expect(h1s, `${name}: h1 count`).toHaveLength(1);
      expect(h1s[0], `${name}: h1 carries the page-title class`).toMatch(/class="page-title"/);
      expect(html, `${name}: no div page title remains`).not.toMatch(/<div class="page-title"/);
    }
  });
});

describe("admin pages: form controls have accessible names", () => {
  it("settings labels point at their controls", async () => {
    const html = await fetchHtml("/_/admin/settings");
    for (const id of ["language-picker", "slug-length-input", "default-range-picker"]) {
      expect(html, `label for ${id}`).toMatch(new RegExp(`<label[^>]*\\bfor="${id}"`));
    }
  });

  it("the quick URL box on the dashboard and links pages is labelled", async () => {
    for (const path of ["/_/admin/dashboard", "/_/admin/links"]) {
      const html = await fetchHtml(path);
      const input = html.match(/<input\b[^>]*\bid="quick-url"[^>]*>/);
      expect(input, path).not.toBeNull();
      expect(input![0], path).toContain(`aria-label="${en["links.inputPlaceholder"]}"`);
    }
  });

  it("link detail inline editors and the back arrow are named", async () => {
    const [detail] = (await adminPages()).filter((p) => p.name === "link detail");
    const html = await fetchHtml(detail.path);

    const back = html.match(/<a\b[^>]*\bclass="detail-back"[^>]*>/);
    expect(back).not.toBeNull();
    expect(back![0]).toContain(`aria-label="${en["linkDetail.backToLinks"]}"`);

    const label = html.match(/<input\b[^>]*\bid="detail-label"[^>]*>/);
    expect(label![0]).toContain(`aria-label="${en["linkDetail.setLabel"]}"`);
    const expires = html.match(/<input\b[^>]*\bid="detail-expires"[^>]*>/);
    expect(expires![0]).toContain(`aria-label="${en["linkDetail.expiresAt"]}"`);

    const editButtons = html.match(/<button\b[^>]*\bclass="inline-edit-btn[^"]*"[^>]*>/g) ?? [];
    expect(editButtons.length).toBe(4);
    const unnamed = editButtons.filter((tag) => !/aria-label="[^"]+"/.test(tag));
    expect(unnamed).toEqual([]);
  });

  it("the links table declares column headers", async () => {
    // The table only renders once a link exists.
    await adminPages();
    const html = await fetchHtml("/_/admin/links");
    const ths = html.match(/<th\b[^>]*>/g) ?? [];
    expect(ths.length).toBeGreaterThan(0);
    const unscoped = ths.filter((tag) => !tag.includes('scope="col"'));
    expect(unscoped).toEqual([]);
  });
});
