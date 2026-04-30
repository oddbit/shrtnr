// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, BundleRepository, ClickRepository, SettingRepository } from "../../db";

const ADMIN_AUTH = { "Cf-Access-Jwt-Assertion": btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ email: "test@example.com" })) + ".sig" };

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundles");
  await env.DB.exec("DELETE FROM bundle_links");
});

async function createReadKey(): Promise<string> {
  const res = await SELF.fetch(new Request("https://shrtnr.test/_/admin/api/keys", {
    method: "POST",
    headers: { ...ADMIN_AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Reader", scope: "read" }),
  }));
  const { raw_key } = await res.json() as { raw_key: string };
  return raw_key;
}

function publicGet(path: string, key: string): Request {
  return new Request(`https://shrtnr.test${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
}

describe("Public API: ?range= on list/get link and bundle endpoints", () => {
  it("GET /_/api/links/:id (no range) returns lifetime total_clicks and no delta_pct", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/control", slug: "ctrl1" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    // One recent click, one old click — both count without a range filter
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 30 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}`, key));
    expect(res.status).toBe(200);
    const body = await res.json() as { total_clicks: number; delta_pct?: number };
    expect(body.total_clicks).toBe(2);
    expect(body.delta_pct).toBeUndefined();
  });

  it("GET /_/api/links/:id?range=7d scopes total_clicks and includes delta_pct", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/ranged", slug: "rng1" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    // One click within the current 7d window
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();
    // One click in the previous 7d window (7d–14d ago) so delta is computable
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 10 * 86400).run();
    // One click older than 14d — outside both windows, visible only in lifetime
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 30 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}?range=7d`, key));
    expect(res.status).toBe(200);
    const body = await res.json() as { total_clicks: number; delta_pct?: number };
    // Only the one recent click falls within 7d; total is less than lifetime (3)
    expect(body.total_clicks).toBe(1);
    expect(typeof body.delta_pct).toBe("number");
  });

  it("GET /_/api/links?range=7d scopes totals for each link and includes delta_pct", async () => {
    const now = Math.floor(Date.now() / 1000);
    const recentLink = await LinkRepository.create(env.DB, { url: "https://example.com/recent", slug: "rec1" });
    const oldLink = await LinkRepository.create(env.DB, { url: "https://example.com/old", slug: "old1" });

    // Recent link: one click in current window, one in previous window so delta is computable
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(recentLink.slugs[0].slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(recentLink.slugs[0].slug, now - 10 * 86400).run();
    // Old link: one click older than 14d — zero within the 7d or 7d–14d windows
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(oldLink.slugs[0].slug, now - 30 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet("/_/api/links?range=7d", key));
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: number; total_clicks: number; delta_pct?: number }>;

    const recent = body.find((l) => l.id === recentLink.id);
    const old = body.find((l) => l.id === oldLink.id);

    expect(recent?.total_clicks).toBe(1);
    expect(typeof recent?.delta_pct).toBe("number");
    // Old link has zero clicks within the 7d window
    expect(old?.total_clicks).toBe(0);
  });

  it("GET /_/api/bundles/:id?range=30d returns total_clicks scoped to 30d", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/bndl", slug: "bndl1", createdBy: "test@example.com" });
    const bundle = await BundleRepository.create(env.DB, { name: "RangeBundle", createdBy: "test@example.com" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    const now = Math.floor(Date.now() / 1000);
    // One click within 30d, one click older than 30d
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(link.slugs[0].slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(link.slugs[0].slug, now - 60 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/bundles/${bundle.id}?range=30d`, key));
    expect(res.status).toBe(200);
    const body = await res.json() as { total_clicks: number };
    expect(body.total_clicks).toBe(1);
  });

  it("GET /_/api/bundles?range=30d returns range-scoped totals on every bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/blist", slug: "blist1", createdBy: "test@example.com" });
    const bundle = await BundleRepository.create(env.DB, { name: "ListRangeBundle", createdBy: "test@example.com" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    const now = Math.floor(Date.now() / 1000);
    // One click within 30d
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(link.slugs[0].slug, now - 60).run();
    // One click outside 30d (should not appear in range-scoped total)
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(link.slugs[0].slug, now - 60 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet("/_/api/bundles?range=30d", key));
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ id: number; total_clicks: number; sparkline?: number[] }>;
    const found = body.find((b) => b.id === bundle.id);
    expect(found?.total_clicks).toBe(1);
    expect(Array.isArray(found?.sparkline)).toBe(true);
  });

  it("GET /_/api/links/:id?range=99d returns 400 with {error: string}", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/inv", slug: "inv1" });
    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}?range=99d`, key));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
  });
});

describe("Public API: range defaults to all and accepts ?range=", () => {
  it("/_/api/links/:id/analytics returns lifetime totals when no range is given", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}/analytics`, key));
    const body = await res.json() as { total_clicks: number };
    expect(res.status).toBe(200);
    expect(body.total_clicks).toBe(2);
  });

  it("/_/api/links/:id/analytics scopes results when ?range=7d is given", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}/analytics?range=7d`, key));
    const body = await res.json() as { total_clicks: number };
    expect(body.total_clicks).toBe(1);
  });

  it("/_/api/links/:id/analytics ignores the API key owner's filter preferences", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 1 });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 0 });

    // Owner has bot filter on; public API still returns raw data.
    await SettingRepository.set(env.DB, "test@example.com", "filter_bots", "true");

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}/analytics`, key));
    const body = await res.json() as { total_clicks: number };
    expect(body.total_clicks).toBe(2);
  });

  it("/_/api/bundles/:id/analytics defaults to all-time", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: "test@example.com" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "test@example.com" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60 * 86400).run();
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    ).bind(slug, now - 60).run();

    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/bundles/${bundle.id}/analytics`, key));
    expect(res.status).toBe(200);
    const body = await res.json() as { total_clicks: number };
    expect(body.total_clicks).toBe(2);
  });

  it("/_/api/links and /_/api/links/:id return raw lifetime click counts", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 1 });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 0 });

    await SettingRepository.set(env.DB, "test@example.com", "filter_bots", "true");

    const key = await createReadKey();
    const single = await SELF.fetch(publicGet(`/_/api/links/${link.id}`, key));
    const singleBody = await single.json() as { total_clicks: number };
    expect(singleBody.total_clicks).toBe(2);

    const list = await SELF.fetch(publicGet("/_/api/links", key));
    const listBody = await list.json() as Array<{ id: number; total_clicks: number }>;
    const found = listBody.find((l) => l.id === link.id);
    expect(found?.total_clicks).toBe(2);
  });
});
