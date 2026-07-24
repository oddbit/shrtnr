// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, ClickRepository, SettingRepository } from "../../db";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
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

  it("escapes an apostrophe in the link URL for the Duplicate menu item (XSS guard)", async () => {
    // A single quote in the destination URL must not be able to close the
    // single-quoted JS string in the Duplicate button's onclick attribute.
    const evilUrl = "https://example.com/x');alert(1);//";
    const link = await LinkRepository.create(env.DB, { url: evilUrl, slug: "abc" });

    const res = await SELF.fetch(req(`/_/admin/links/${link.id}`));
    const html = await res.text();

    // The renderer HTML-entity-escapes every apostrophe (&#39;) in the onclick
    // attribute, including the JS-string delimiters. The browser decodes those
    // entities back to literal quotes before handing the code to the JS engine,
    // so entity-escaping alone can't stop the string from closing early — the
    // fix must keep a literal backslash in front of the URL's apostrophe so it
    // still reads as an escaped quote (not a string terminator) after decoding.
    expect(html).toContain(`showDuplicateModal(${link.id}, &#39;https://example.com/x\\&#39;);alert(1);//&#39;)`);
    expect(html).not.toContain(`showDuplicateModal(${link.id}, &#39;https://example.com/x&#39;);alert(1);//&#39;)`);
  });
});
