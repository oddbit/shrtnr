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

describe("fonts: self-hosted, preloaded, with metric-matched fallbacks", () => {
  const PAGES = ["/_/admin/settings", "/", "/no-such-page-for-fonts"];

  it("no page links a third-party font stylesheet or preconnects to one", async () => {
    for (const path of PAGES) {
      const res = await SELF.fetch(req(path));
      const html = await res.text();
      expect(html, path).not.toContain("fonts.googleapis.com");
      expect(html, path).not.toContain("fonts.gstatic.com");
    }
  });

  it("every page declares the text fonts from /fonts with display=swap and preloads the latin files", async () => {
    for (const path of PAGES) {
      const res = await SELF.fetch(req(path));
      const html = await res.text();
      expect(html, path).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Manrope'[^}]*font-display:\s*swap[^}]*url\(\/fonts\/manrope-v\d+-latin\.woff2\)/);
      expect(html, path).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Space Grotesk'[^}]*font-display:\s*swap[^}]*url\(\/fonts\/space-grotesk-v\d+-latin\.woff2\)/);
      expect(html, path).toMatch(/<link rel="preload" href="\/fonts\/manrope-v\d+-latin\.woff2" as="font" type="font\/woff2" crossorigin/);
      expect(html, path).toMatch(/<link rel="preload" href="\/fonts\/space-grotesk-v\d+-latin\.woff2" as="font" type="font\/woff2" crossorigin/);
    }
  });

  it("text fonts fall back to a local face with adjusted metrics so the swap does not shift layout", async () => {
    const html = await fetchHtml("/_/admin/settings");
    for (const family of ["Manrope Fallback", "Space Grotesk Fallback"]) {
      const face = html.match(new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*\\}`));
      expect(face, `${family} face`).not.toBeNull();
      expect(face![0]).toMatch(/src:\s*local\(/);
      expect(face![0]).toMatch(/size-adjust:\s*[\d.]+%/);
      expect(face![0]).toMatch(/ascent-override:\s*[\d.]+%/);
      expect(face![0]).toMatch(/descent-override:\s*[\d.]+%/);
    }
    // The fallback sits between the web font and the generic family.
    expect(html).toMatch(/--font-family-body:\s*'Manrope',\s*'Manrope Fallback'/);
    expect(html).toMatch(/--font-family-display:\s*'Space Grotesk',\s*'Space Grotesk Fallback'/);
  });

  it("the admin shell self-hosts the Material Symbols static instance with display=block and preloads it", async () => {
    const html = await fetchHtml("/_/admin/settings");
    // The static instance weighs 322 KB against 3.98 MB for the variable
    // font with every axis; display=block hides the ligature text ("menu")
    // that swap would flash until the file arrives.
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Material Symbols Outlined'[^}]*font-display:\s*block[^}]*url\(\/fonts\/material-symbols-outlined-v\d+\.woff2\)/);
    expect(html).toMatch(/<link rel="preload" href="\/fonts\/material-symbols-outlined-v\d+\.woff2" as="font" type="font\/woff2" crossorigin/);
  });

  it("standalone pages do not pull the icon font they never use", async () => {
    for (const path of ["/", "/no-such-page-for-fonts"]) {
      const html = await (await SELF.fetch(req(path))).text();
      expect(html, path).not.toContain("Material Symbols");
    }
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
