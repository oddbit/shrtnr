// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, BundleRepository, ClickRepository } from "../../db";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
}

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  // resetData preserves bundle rows; clear them explicitly.
  await env.DB.exec("DELETE FROM bundles");
  await env.DB.exec("DELETE FROM bundle_links");
});

describe("Bundle detail page server render", () => {
  it("hero total_clicks and Domains panel reflect the user's self-referrer filter on first paint", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "abc",
      createdBy: "dev@local",
    });
    const bundle = await BundleRepository.create(env.DB, {
      name: "Demo",
      createdBy: "dev@local",
    });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);

    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://github.com/oddbit",
      referrerHost: "github.com",
      isBot: 0,
      isSelfReferrer: 0,
    });
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://selfref.example/",
      referrerHost: "selfref.example",
      isBot: 0,
      isSelfReferrer: 1,
    });

    // Default filter_self_referrers is true via resolveClickFilters.
    const res = await SELF.fetch(req(`/_/admin/bundles/${bundle.id}`));
    expect(res.status).toBe(200);
    const html = await res.text();

    // Hero total_clicks: only the non-self-referrer click should count.
    const heroMatch = html.match(/class="hero-metric accent"[^>]*>\s*<div class="n">([^<]+)</);
    expect(heroMatch).not.toBeNull();
    expect(heroMatch![1].trim()).toBe("1");

    // Domains panel must include the legitimate referrer host but not the self-referrer host.
    expect(html).toContain("github.com");
    expect(html).not.toContain("selfref.example");
  });
});
