// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, BundleRepository, ClickRepository } from "../../db";

const ADMIN_AUTH = { "Cf-Access-Jwt-Assertion": btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + btoa(JSON.stringify({ email: "test@example.com" })) + ".sig" };

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundles");
  await env.DB.exec("DELETE FROM bundle_links");
});

const CODES = ["US", "ID", "SE", "DE", "FR", "GB", "JP", "SG", "BR", "IN", "CA", "AU"];

async function recordDescendingCountries(slug: string) {
  for (let i = 0; i < CODES.length; i++) {
    for (let j = 0; j < CODES.length - i; j++) {
      await ClickRepository.record(env.DB, slug, { country: CODES[i] });
    }
  }
}

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
  return new Request(`https://shrtnr.test${path}`, { headers: { Authorization: `Bearer ${key}` } });
}

function adminGet(path: string): Request {
  return new Request(`https://shrtnr.test${path}`, { headers: { ...ADMIN_AUTH } });
}

type Page = { items: { name: string; count: number }[]; total: number };

describe("Breakdown pagination endpoint", () => {
  it("GET /_/api/links/:id/breakdown pages countries and reports the full total", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "page1" });
    await recordDescendingCountries(link.slugs[0].slug);
    const key = await createReadKey();

    const r1 = await SELF.fetch(publicGet(`/_/api/links/${link.id}/breakdown?dimension=countries&offset=0&limit=10`, key));
    expect(r1.status).toBe(200);
    const p1 = await r1.json() as Page;
    expect(p1.total).toBe(12);
    expect(p1.items).toHaveLength(10);
    expect(p1.items[0]).toEqual({ name: "US", count: 12 });

    const r2 = await SELF.fetch(publicGet(`/_/api/links/${link.id}/breakdown?dimension=countries&offset=10&limit=10`, key));
    const p2 = await r2.json() as Page;
    expect(p2.items).toHaveLength(2);
    expect(p2.total).toBe(12);
  });

  it("rejects an unknown dimension with 400", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "baddim" });
    const key = await createReadKey();
    const res = await SELF.fetch(publicGet(`/_/api/links/${link.id}/breakdown?dimension=browsers`, key));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("GET /_/api/bundles/:id/breakdown aggregates across member links", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "bp", createdBy: "test@example.com" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "test@example.com" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    await recordDescendingCountries(link.slugs[0].slug);
    const key = await createReadKey();

    const res = await SELF.fetch(publicGet(`/_/api/bundles/${bundle.id}/breakdown?dimension=countries&offset=0&limit=10`, key));
    expect(res.status).toBe(200);
    const page = await res.json() as Page;
    expect(page.total).toBe(12);
    expect(page.items).toHaveLength(10);
  });

  it("serves the admin breakdown route used by the detail pages", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "adminbp" });
    await recordDescendingCountries(link.slugs[0].slug);

    const res = await SELF.fetch(adminGet(`/_/admin/api/links/${link.id}/breakdown?dimension=countries&offset=10&limit=10`));
    expect(res.status).toBe(200);
    const page = await res.json() as Page;
    expect(page.total).toBe(12);
    expect(page.items).toHaveLength(2);
  });
});
