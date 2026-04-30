// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { LinkRepository, SlugRepository } from "../../db";
import { SlugCache } from "../../kv";
import { applyMigrations, resetData } from "../setup";

// Matches DEV_IDENTITY in .dev.vars, used by the admin middleware in test mode
const DEV_IDENTITY = "dev@local";

function req(slug: string): Request {
  return new Request(`https://shrtnr.test/${slug}`, { redirect: "manual" });
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("Redirect with KV cache", () => {
  it("redirects via KV when entry is cached", async () => {
    // Create in D1 (for click FK) and override KV with a different URL to prove KV is used
    await LinkRepository.create(env.DB, { url: "https://d1-url.com", slug: "cached", createdBy: DEV_IDENTITY });
    await SlugCache.put(env.SLUG_KV, "cached", {
      url: "https://kv-url.com/page",
      disabled_at: null,
      expires_at: null,
    });

    const res = await SELF.fetch(req("cached"));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://kv-url.com/page");
  });

  it("falls back to D1 on KV miss and populates KV", async () => {
    await LinkRepository.create(env.DB, { url: "https://d1-target.com/page", slug: "d1only", createdBy: DEV_IDENTITY });

    // KV is empty
    expect(await SlugCache.get(env.SLUG_KV, "d1only")).toBeNull();

    const res = await SELF.fetch(req("d1only"));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://d1-target.com/page");

    // KV should now be populated (read-through)
    const cached = await SlugCache.get(env.SLUG_KV, "d1only");
    expect(cached).not.toBeNull();
    expect(cached!.url).toBe("https://d1-target.com/page");
  });

  it("returns 404 for a disabled slug from KV", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "disabled", createdBy: DEV_IDENTITY });
    await SlugCache.put(env.SLUG_KV, "disabled", {
      url: "https://example.com",
      disabled_at: 1700000000,
      expires_at: null,
    });

    const res = await SELF.fetch(req("disabled"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for an expired slug from KV", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "expired", createdBy: DEV_IDENTITY });
    await SlugCache.put(env.SLUG_KV, "expired", {
      url: "https://example.com",
      disabled_at: null,
      expires_at: past,
    });

    const res = await SELF.fetch(req("expired"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when slug is missing from both KV and D1", async () => {
    const res = await SELF.fetch(req("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("is case-insensitive for slug lookup in KV", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com/page", slug: "myslug", createdBy: DEV_IDENTITY });
    await SlugCache.put(env.SLUG_KV, "myslug", {
      url: "https://example.com/page",
      disabled_at: null,
      expires_at: null,
    });

    const res = await SELF.fetch(req("MySlug"));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/page");
  });
});

describe("KV write-through on mutations", () => {
  it("populates KV when a link is created", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://new-link.com/page" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { slugs: { slug: string }[] };
    const slug = body.slugs[0].slug;

    const cached = await SlugCache.get(env.SLUG_KV, slug);
    expect(cached).not.toBeNull();
    expect(cached!.url).toBe("https://new-link.com/page");
    expect(cached!.disabled_at).toBeNull();
    expect(cached!.expires_at).toBeNull();
  });

  it("populates KV when a custom slug is added", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/page", slug: "abc", createdBy: DEV_IDENTITY });

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "my-custom" }),
      }),
    );
    expect(res.status).toBe(201);

    const cached = await SlugCache.get(env.SLUG_KV, "my-custom");
    expect(cached).not.toBeNull();
    expect(cached!.url).toBe("https://example.com/page");
  });

  it("updates KV when link URL changes", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://old.com/page", slug: "abc", createdBy: DEV_IDENTITY });
    await SlugCache.put(env.SLUG_KV, "abc", { url: "https://old.com/page", disabled_at: null, expires_at: null });

    await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://new.com/page" }),
      }),
    );

    const cached = await SlugCache.get(env.SLUG_KV, "abc");
    expect(cached!.url).toBe("https://new.com/page");
  });

  it("updates KV when a link is disabled", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: DEV_IDENTITY });

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/disable`, {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);

    const cached = await SlugCache.get(env.SLUG_KV, "abc");
    expect(cached).not.toBeNull();
    expect(cached!.expires_at).toBeGreaterThan(0);
  });

  it("updates KV when a link is re-enabled", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: DEV_IDENTITY });
    await LinkRepository.disable(env.DB, link.id);

    await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/enable`, {
        method: "POST",
      }),
    );

    const cached = await SlugCache.get(env.SLUG_KV, "abc");
    expect(cached).not.toBeNull();
    expect(cached!.expires_at).toBeNull();
  });

  it("updates KV when a slug is disabled", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: DEV_IDENTITY });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");

    await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/slugs/my-custom/disable`, {
        method: "POST",
      }),
    );

    const cached = await SlugCache.get(env.SLUG_KV, "my-custom");
    expect(cached).not.toBeNull();
    expect(cached!.disabled_at).toBeGreaterThan(0);
  });

  it("updates KV when a slug is re-enabled", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: DEV_IDENTITY });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, "my-custom");

    await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/slugs/my-custom/enable`, {
        method: "POST",
      }),
    );

    const cached = await SlugCache.get(env.SLUG_KV, "my-custom");
    expect(cached).not.toBeNull();
    expect(cached!.disabled_at).toBeNull();
  });

  it("deletes from KV when a slug is removed", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: DEV_IDENTITY });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugCache.put(env.SLUG_KV, "my-custom", { url: "https://example.com", disabled_at: null, expires_at: null });

    await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/slugs/my-custom`, {
        method: "DELETE",
      }),
    );

    const cached = await SlugCache.get(env.SLUG_KV, "my-custom");
    expect(cached).toBeNull();
  });

  it("deletes all slugs from KV when a link is deleted", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdBy: DEV_IDENTITY });
    await SlugRepository.addCustom(env.DB, link.id, "custom-one");

    await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}`, {
        method: "DELETE",
      }),
    );

    expect(await SlugCache.get(env.SLUG_KV, "abc")).toBeNull();
    expect(await SlugCache.get(env.SLUG_KV, "custom-one")).toBeNull();
  });
});

// Single canonical assertion of the redirect-status matrix. KV is busted
// after every DB mutation so the live read goes through D1, exercising
// the redirect guard logic from end to end.
describe("redirect status by link state", () => {
  it("active, not expired -> 301", async () => {
    await LinkRepository.create(env.DB, {
      url: "https://example.com/active",
      slug: "active",
      createdBy: DEV_IDENTITY,
    });
    await SlugCache.delete(env.SLUG_KV, "active");

    const res = await SELF.fetch(req("active"));
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/active");
  });

  it("disabled -> 404", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/disabled",
      slug: "disabled-state",
      createdBy: DEV_IDENTITY,
    });
    // Disable the slug (links table has no disabled_at column on its own;
    // the redirect guard reads slugs.disabled_at via findForRedirect).
    await env.DB.prepare("UPDATE slugs SET disabled_at = ? WHERE link_id = ?")
      .bind(Math.floor(Date.now() / 1000), link.id)
      .run();
    await SlugCache.delete(env.SLUG_KV, "disabled-state");

    const res = await SELF.fetch(req("disabled-state"));
    expect(res.status).toBe(404);
  });

  it("expires_at in past -> 404", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/expired",
      slug: "expired-state",
      createdBy: DEV_IDENTITY,
    });
    await env.DB.prepare("UPDATE links SET expires_at = ? WHERE id = ?")
      .bind(1, link.id) // 1970
      .run();
    await SlugCache.delete(env.SLUG_KV, "expired-state");

    const res = await SELF.fetch(req("expired-state"));
    expect(res.status).toBe(404);
  });

  it("unknown slug -> 404", async () => {
    const res = await SELF.fetch(req("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("custom slug pointing at deleted link -> 404", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/orphan",
      slug: "primary-slug",
      createdBy: DEV_IDENTITY,
    });
    await SlugRepository.addCustom(env.DB, link.id, "custom-orphan");
    // Hard-delete the link. With ON DELETE CASCADE the slug row is gone too,
    // so the custom slug no longer resolves.
    await env.DB.prepare("DELETE FROM links WHERE id = ?").bind(link.id).run();
    await SlugCache.delete(env.SLUG_KV, "custom-orphan");

    const res = await SELF.fetch(req("custom-orphan"));
    expect(res.status).toBe(404);
  });
});
