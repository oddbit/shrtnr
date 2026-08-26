// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, ClickRepository, SettingRepository } from "../../db";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
}

// Read the back link's href regardless of attribute order.
function detailBackHref(html: string): string | undefined {
  const tag = (html.match(/<a\b[^>]*>/g) ?? []).find((t) =>
    /class="[^"]*\bdetail-back\b[^"]*"/.test(t),
  );
  return tag?.match(/href="([^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("Link detail page server render", () => {
  it("hero total_clicks reflects the user's bot filter on first paint", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 0, isSelfReferrer: 0 });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 1, isSelfReferrer: 0 });

    // Default: filter_bots is on per resolveClickFilters fallback.
    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));
    expect(res.status).toBe(200);
    const html = await res.text();

    const heroMatch = html.match(/id="hero-total-clicks"[^>]*>([^<]+)</);
    expect(heroMatch).not.toBeNull();
    expect(heroMatch![1].trim()).toBe("1");
  });

  it("slug breakdown rows reflect the user's bot filter on first paint", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 0, isSelfReferrer: 0 });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 0, isSelfReferrer: 0 });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 1, isSelfReferrer: 0 });

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));
    const html = await res.text();

    // The slug-row click count cell carries the slug as data-slug-count.
    const slugCount = html.match(new RegExp(`data-slug-count="${link.slugs[0].slug}"[^>]*>([^<]+)<`));
    expect(slugCount).not.toBeNull();
    expect(slugCount![1].trim()).toBe("2");
  });

  it("renders the duplicate action without interpolating the URL into an inline handler", async () => {
    // A URL with a literal single quote must not break out of the duplicate
    // button. The URL rides on a data-* attribute (HTML-escaped by JSX) and a
    // delegated handler reads it, so no inline onclick carries the raw URL.
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/'-alert(document.cookie)-'",
      slug: "abc",
    });

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));
    const html = await res.text();

    expect(html).toContain("data-duplicate-url=");
    // The client script still defines showDuplicateModal(); the fix is that no
    // inline onclick attribute carries the raw URL.
    expect(html).not.toContain('onclick="showDuplicateModal(');
    // The quote survives only in escaped form, never as a raw breakout.
    expect(html).not.toContain("'-alert(document.cookie)-'");
    expect(html).toContain("&#39;-alert(document.cookie)-&#39;");
  });

  it("hero total_clicks honors a user's default_range setting", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();

    await SettingRepository.set(env.DB, "dev@local", "default_range", "7d");

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));
    const html = await res.text();

    const heroMatch = html.match(/id="hero-total-clicks"[^>]*>([^<]+)</);
    expect(heroMatch).not.toBeNull();
    expect(heroMatch![1].trim()).toBe("1");
  });

  it("renders 30d as the active range when no default_range is set", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));
    const html = await res.text();
    expect(html).toMatch(/class="timeline-range-btn active"\s+data-range="30d"/);
  });
  it("back link returns to the listing the visitor came from", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://pdf.co/doc", slug: "abc" });
    const from = encodeURIComponent("sort=popular&page=2&per_page=25&filter=all&range=7d&search=pdf.co");

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}?from=${from}`));
    expect(res.status).toBe(200);
    const back = detailBackHref(await res.text());

    expect(back).toBeDefined();
    expect(back).toContain("search=pdf.co");
    expect(back).toContain("page=2");
    expect(back).toContain("sort=popular");
    expect(back).toContain("filter=all");
    expect(back).toContain("range=7d");
  });

  it("back link falls back to the bare listing with no from param", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));

    expect(detailBackHref(await res.text())).toBe("/_/admin/links");
  });

  it("back link drops unknown params from a caller-supplied from value", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const from = encodeURIComponent("search=pdf.co&redirect=https://evil.test&admin=1");

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}?from=${from}`));
    const back = detailBackHref(await res.text());

    expect(back).toBeDefined();
    expect(back!.startsWith("/_/admin/links?")).toBe(true);
    expect(back).toContain("search=pdf.co");
    expect(back).not.toContain("evil.test");
    expect(back).not.toContain("admin=1");
  });

  it("an absolute url in from cannot point the back link off the listing", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const from = encodeURIComponent("https://evil.test/steal?search=x");

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}?from=${from}`));
    const back = detailBackHref(await res.text());

    expect(back).toBeDefined();
    expect(back!.startsWith("/_/admin/links")).toBe(true);
    expect(back).not.toContain("evil.test");
  });
});
