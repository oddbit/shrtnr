import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import {
  addVanitySlugToLink,
  createManagedLink,
  getManagedLink,
  updateManagedLink,
} from "../services/link-management";
import { setSetting } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("link-management service", () => {
  it("rejects invalid URL input when creating links", async () => {
    const result = await createManagedLink(env as any, { url: "notaurl" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("url must be a valid URL");
    }
  });

  it("uses configured default slug length when slug_length is omitted", async () => {
    await setSetting(env.DB, "slug_default_length", "6");

    const result = await createManagedLink(env as any, { url: "https://example.com" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const autoSlug = result.data.slugs.find((s) => s.is_vanity === 0);
      expect(autoSlug).toBeDefined();
      expect(autoSlug?.slug).toHaveLength(6);
    }
  });

  it("enforces one vanity slug per link", async () => {
    const created = await createManagedLink(env as any, {
      url: "https://example.com",
      vanity_slug: "initial-vanity",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await addVanitySlugToLink(env as any, created.data.id, { slug: "second-vanity" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe("Link already has a vanity slug");
    }
  });

  it("requires read scope semantics for get and create scope semantics for update", async () => {
    const created = await createManagedLink(env as any, { url: "https://example.com" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const fetched = await getManagedLink(env as any, created.data.id);
    expect(fetched.ok).toBe(true);

    const updated = await updateManagedLink(env as any, created.data.id, { label: "Updated" });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.label).toBe("Updated");
    }
  });
});
