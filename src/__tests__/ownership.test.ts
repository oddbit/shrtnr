import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository } from "../db";
import {
  createLink,
  disableLink,
  enableLink,
  deleteLink,
  disableSlug,
  enableSlug,
  removeSlug,
  addCustomSlugToLink,
  searchLinks,
  listLinksByOwner,
} from "../services/link-management";

beforeAll(applyMigrations);
beforeEach(resetData);

const OWNER = "owner@example.com";
const OTHER = "other@example.com";

async function createOwnedLink(owner: string = OWNER) {
  const result = await createLink(env as any, {
    url: "https://example.com",
    created_by: owner,
  });
  if (!result.ok) throw new Error("Failed to create link");
  return result.data;
}

describe("Link ownership: disable", () => {
  it("owner can disable their link", async () => {
    const link = await createOwnedLink();
    const before = Math.floor(Date.now() / 1000);
    const result = await disableLink(env as any, link.id, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expires_at).toBeGreaterThanOrEqual(before);
    }
  });

  it("non-owner cannot disable another user's link", async () => {
    const link = await createOwnedLink();
    const result = await disableLink(env as any, link.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("Link ownership: enable", () => {
  it("owner can enable their disabled link", async () => {
    const link = await createOwnedLink();
    await disableLink(env as any, link.id, OWNER);
    const result = await enableLink(env as any, link.id, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expires_at).toBeNull();
    }
  });

  it("non-owner cannot enable another user's link", async () => {
    const link = await createOwnedLink();
    await disableLink(env as any, link.id, OWNER);
    const result = await enableLink(env as any, link.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("Link ownership: delete", () => {
  it("owner can delete their zero-click link", async () => {
    const link = await createOwnedLink();
    const result = await deleteLink(env as any, link.id, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot delete another user's link", async () => {
    const link = await createOwnedLink();
    const result = await deleteLink(env as any, link.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("Slug ownership: disable", () => {
  it("link owner can disable a custom slug", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;

    const result = await disableSlug(env as any, link.id, customSlug.id, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot disable a slug on another user's link", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;

    const result = await disableSlug(env as any, link.id, customSlug.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("Slug ownership: enable", () => {
  it("link owner can enable a disabled slug", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;
    await disableSlug(env as any, link.id, customSlug.id, OWNER);

    const result = await enableSlug(env as any, link.id, customSlug.id, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot enable a slug on another user's link", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;
    await disableSlug(env as any, link.id, customSlug.id, OWNER);

    const result = await enableSlug(env as any, link.id, customSlug.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("Slug ownership: remove", () => {
  it("link owner can remove a zero-click custom slug", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;

    const result = await removeSlug(env as any, link.id, customSlug.id, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot remove a slug on another user's link", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;

    const result = await removeSlug(env as any, link.id, customSlug.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("Collaboration: adding slugs", () => {
  it("non-owner can add a custom slug to another user's link", async () => {
    const link = await createOwnedLink();
    const result = await addCustomSlugToLink(env as any, link.id, { slug: "collab-slug" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("collab-slug");
    }
  });
});

describe("Link disable via expires_at", () => {
  it("disabling a link sets expires_at to now", async () => {
    const link = await createOwnedLink();
    const before = Math.floor(Date.now() / 1000);
    const result = await disableLink(env as any, link.id, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expires_at).toBeGreaterThanOrEqual(before);
    }
  });

  it("enabling a link clears expires_at", async () => {
    const link = await createOwnedLink();
    await disableLink(env as any, link.id, OWNER);
    const result = await enableLink(env as any, link.id, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expires_at).toBeNull();
    }
  });

  it("disabling a link does not mutate child slug disabled_at values", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "keep-enabled" });

    await disableLink(env as any, link.id, OWNER);

    const refreshed = await LinkRepository.getById(env.DB, link.id);
    for (const slug of refreshed!.slugs) {
      expect(slug.disabled_at).toBeNull();
    }
  });
});

describe("UI search includes created_by", () => {
  it("finds a link when searching by owner email with includeOwner", async () => {
    await createOwnedLink(OWNER);
    await createLink(env as any, { url: "https://other.com", created_by: OTHER });

    const result = await searchLinks(env as any, OWNER, { includeOwner: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].created_by).toBe(OWNER);
    }
  });

  it("finds links by partial owner email match", async () => {
    await createOwnedLink(OWNER);

    const result = await searchLinks(env as any, "owner@", { includeOwner: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });

  it("does not match owner email without includeOwner flag", async () => {
    await createOwnedLink(OWNER);

    const result = await searchLinks(env as any, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });
});

describe("List links by owner", () => {
  it("returns only links owned by the specified identity", async () => {
    await createOwnedLink(OWNER);
    await createLink(env as any, { url: "https://second.com", created_by: OWNER, allow_duplicate: true });
    await createLink(env as any, { url: "https://other.com", created_by: OTHER });

    const result = await listLinksByOwner(env as any, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      for (const link of result.data) {
        expect(link.created_by).toBe(OWNER);
      }
    }
  });

  it("returns empty array when owner has no links", async () => {
    await createOwnedLink(OWNER);

    const result = await listLinksByOwner(env as any, "nobody@example.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });
});
