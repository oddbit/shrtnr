// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, BundleRepository, ClickRepository, SettingRepository } from "../db";

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
