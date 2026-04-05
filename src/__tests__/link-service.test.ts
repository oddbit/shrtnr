import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import {
  addCustomSlugToLink,
  createLink,
  getLink,
  getLinkBySlug,
  updateLink,
} from "../services/link-management";
import { SettingRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("link-management service", () => {
  it("rejects invalid URL input when creating links", async () => {
    const result = await createLink(env as any, { url: "notaurl" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("url must be a valid URL");
    }
  });

  it("uses configured default slug length when slug_length is omitted", async () => {
    await SettingRepository.set(env.DB, "anonymous", "slug_default_length", "6");

    const result = await createLink(env as any, { url: "https://example.com" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const autoSlug = result.data.slugs.find((s) => s.is_custom === 0);
      expect(autoSlug).toBeDefined();
      expect(autoSlug?.slug).toHaveLength(6);
    }
  });

  it("falls back to hardcoded default length when setting is missing", async () => {
    await env.DB.exec("DELETE FROM settings WHERE key = 'slug_default_length'");

    const result = await createLink({ DB: env.DB } as any, { url: "https://example.com" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const autoSlug = result.data.slugs.find((s) => s.is_custom === 0);
      expect(autoSlug).toBeDefined();
      expect(autoSlug?.slug).toHaveLength(3);
    }
  });

  it("allows multiple custom slugs per link", async () => {
    const created = await createLink(env as any, {
      url: "https://example.com",
      custom_slug: "initial-custom",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await addCustomSlugToLink(env as any, created.data.id, { slug: "second-custom" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("second-custom");
      expect(result.data.is_custom).toBe(1);
    }
  });

  it("rejects javascript: URL scheme", async () => {
    const result = await createLink(env as any, { url: "javascript:alert(1)" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/https?/);
    }
  });

  it("rejects data: URL scheme", async () => {
    const result = await createLink(env as any, { url: "data:text/html,<h1>hi</h1>" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects file: URL scheme", async () => {
    const result = await createLink(env as any, { url: "file:///etc/passwd" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects ftp: URL scheme", async () => {
    const result = await createLink(env as any, { url: "ftp://files.example.com/data" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("accepts http: URL scheme", async () => {
    const result = await createLink(env as any, { url: "http://example.com" });
    expect(result.ok).toBe(true);
  });

  it("accepts https: URL scheme", async () => {
    const result = await createLink(env as any, { url: "https://example.com" });
    expect(result.ok).toBe(true);
  });

  it("rejects javascript: URL in update", async () => {
    const created = await createLink(env as any, { url: "https://example.com" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateLink(env as any, created.data.id, { url: "javascript:alert(1)" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("requires read scope semantics for get and create scope semantics for update", async () => {
    const created = await createLink(env as any, { url: "https://example.com" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const fetched = await getLink(env as any, created.data.id);
    expect(fetched.ok).toBe(true);

    const updated = await updateLink(env as any, created.data.id, { label: "Updated" });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.label).toBe("Updated");
    }
  });

  it("lowercases custom_slug on create", async () => {
    const result = await createLink(env as any, {
      url: "https://example.com",
      custom_slug: "My-Custom-Slug",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const custom = result.data.slugs.find((s) => s.is_custom === 1);
      expect(custom?.slug).toBe("my-custom-slug");
    }
  });

  it("lowercases slug when adding custom slug to existing link", async () => {
    const created = await createLink(env as any, { url: "https://example.com" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await addCustomSlugToLink(env as any, created.data.id, { slug: "UPPER-CASE" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("upper-case");
    }
  });

  it("can get a link by its slug", async () => {
    const created = await createLink(env as any, {
      url: "https://example.com",
      custom_slug: "my-custom-slug",
    });
    expect(created.ok).toBe(true);

    const fetched = await getLinkBySlug(env as any, "my-custom-slug");
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.data.url).toBe("https://example.com");
      expect(fetched.data.id).toBe(created.ok ? created.data.id : -1);
    }
  });

  it("returns 404 for non-existent slug", async () => {
    const fetched = await getLinkBySlug(env as any, "non-existent");
    expect(fetched.ok).toBe(false);
    if (!fetched.ok) {
      expect(fetched.status).toBe(404);
      expect(fetched.error).toBe("Link not found");
    }
  });
});

describe("searchLinks service", () => {
  it("returns links matching a label query", async () => {
    await createLink(env as any, { url: "https://oddbit.id", label: "Oddbit website" });
    await createLink(env as any, { url: "https://example.com", label: "Some other site" });

    const { searchLinks } = await import("../services/link-management");
    const result = await searchLinks(env as any, "oddbit");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].label).toBe("Oddbit website");
    }
  });

  it("returns links matching a slug query", async () => {
    await createLink(env as any, { url: "https://oddbit.id/pricing", custom_slug: "pricing-page" });

    const { searchLinks } = await import("../services/link-management");
    const result = await searchLinks(env as any, "pricing");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });

  it("returns empty array for a blank query", async () => {
    await createLink(env as any, { url: "https://example.com" });

    const { searchLinks } = await import("../services/link-management");
    const result = await searchLinks(env as any, "");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });
});
