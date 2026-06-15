import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, SlugRepository } from "../../db";
import { SlugCache } from "../../kv";
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
} from "../../services/link-management";

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

    const result = await disableSlug(env as any, link.id, customSlug.slug, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot disable a slug on another user's link", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;

    const result = await disableSlug(env as any, link.id, customSlug.slug, OTHER);
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
    await disableSlug(env as any, link.id, customSlug.slug, OWNER);

    const result = await enableSlug(env as any, link.id, customSlug.slug, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot enable a slug on another user's link", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;
    await disableSlug(env as any, link.id, customSlug.slug, OWNER);

    const result = await enableSlug(env as any, link.id, customSlug.slug, OTHER);
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

    const result = await removeSlug(env as any, link.id, customSlug.slug, OWNER);
    expect(result.ok).toBe(true);
  });

  it("non-owner cannot remove a slug on another user's link", async () => {
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "custom-slug" });
    const refreshed = await LinkRepository.getById(env.DB, link.id);
    const customSlug = refreshed!.slugs.find((s) => s.is_custom === 1)!;

    const result = await removeSlug(env as any, link.id, customSlug.slug, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe("removeSlug: repository guard blocks the delete under a race", () => {
  it("returns 400 and does not evict the cache when remove() reports the slug was not deleted", async () => {
    // A click can land between the service pre-read and the repository's
    // transactional delete; the NOT EXISTS guard then blocks the delete and
    // remove() returns false. The slug is still present and resolving, so the
    // service must report failure, not a false success, and must not evict the
    // still-live cache entry.
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "raced-remove" });

    const removeSpy = vi.spyOn(SlugRepository, "remove").mockResolvedValueOnce(false);
    const cacheSpy = vi.spyOn(SlugCache, "delete");
    try {
      const result = await removeSlug(env as any, link.id, "raced-remove", OWNER);
      // Asserted before mockRestore clears the recorded calls.
      expect(cacheSpy).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
      }
    } finally {
      removeSpy.mockRestore();
      cacheSpy.mockRestore();
    }
  });

  it("returns 404 when the slug vanished concurrently before the delete", async () => {
    // remove() also returns false when a concurrent request already removed the
    // slug. The membership re-read then finds nothing, so the service returns
    // 404 rather than the click-history 400.
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "vanished-remove" });

    const removeSpy = vi.spyOn(SlugRepository, "remove").mockResolvedValueOnce(false);
    const findSpy = vi.spyOn(SlugRepository, "findByValue").mockResolvedValueOnce(null);
    const result = await removeSlug(env as any, link.id, "vanished-remove", OWNER).finally(() => {
      removeSpy.mockRestore();
      findSpy.mockRestore();
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("returns 404 when the slug was re-claimed by another link before the disambiguation", async () => {
    // Slug values are globally unique, so a slug freed from this link can be
    // re-claimed by a different link. The membership re-read must check link_id,
    // or a re-claimed slug would be misreported as still-here-with-clicks (400).
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "reclaimed-remove" });
    const original = (await SlugRepository.findByValue(env.DB, "reclaimed-remove"))!;

    const removeSpy = vi.spyOn(SlugRepository, "remove").mockResolvedValueOnce(false);
    // The slug now resolves to a different link than the one being operated on.
    const findSpy = vi
      .spyOn(SlugRepository, "findByValue")
      .mockResolvedValueOnce({ ...original, link_id: original.link_id + 1 });
    const result = await removeSlug(env as any, link.id, "reclaimed-remove", OWNER).finally(() => {
      removeSpy.mockRestore();
      findSpy.mockRestore();
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

describe("addCustomSlugToLink: concurrent UNIQUE violation returns 409", () => {
  it("returns 409 rather than 500 when a concurrent request claims the slug between the existence check and the insert", async () => {
    // Two concurrent requests both pass SlugRepository.exists() before either
    // commits. The second INSERT hits the UNIQUE constraint. Without a try/catch
    // in the service layer, the D1 error propagates as an unhandled 500.
    const link = await createOwnedLink();

    const spy = vi.spyOn(SlugRepository, "addCustom").mockRejectedValueOnce(
      new Error("D1_ERROR: UNIQUE constraint failed: slugs.slug"),
    );
    const result = await addCustomSlugToLink(env as any, link.id, { slug: "raced-slug" }).finally(() => spy.mockRestore());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
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

describe("searchLinks: LIKE metacharacter escaping", () => {
  it("searching for _ does not return links that have no literal underscore", async () => {
    // Without escaping, the LIKE pattern '%_%' matches any non-empty string,
    // returning every link. With correct escaping it matches only links whose
    // label, slug, or URL literally contains an underscore character.
    await createLink(env as any, { url: "https://example.com", label: "hello world", created_by: OWNER });
    await createLink(env as any, { url: "https://other.com", label: "other link", created_by: OTHER, allow_duplicate: true });

    const result = await searchLinks(env as any, "_", { includeOwner: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("searching for % does not return links that have no literal percent sign", async () => {
    // Without escaping, the LIKE pattern '%%' matches every string.
    await createLink(env as any, { url: "https://example.com", label: "hello world", created_by: OWNER });

    const result = await searchLinks(env as any, "%");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
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

describe("deleteLink: DB-level guard return value is honored", () => {
  it("returns 400 when the repository delete guard fires after the service-level check", async () => {
    // Simulate the race where a click is recorded between the service's
    // total_clicks check and the underlying DB delete: the repository
    // re-checks inside delete() and returns false. The service must surface
    // that as a 400, not silently report { deleted: true }.
    const link = await createOwnedLink();

    const spy = vi.spyOn(LinkRepository, "delete").mockResolvedValueOnce(false);
    const result = await deleteLink(env as any, link.id, OWNER).finally(() => spy.mockRestore());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 404 when the link is concurrently deleted before the repository delete", async () => {
    // The link exists at the service's getById and ownership checks, then
    // vanishes before the repository delete runs. delete() returns false for a
    // missing row exactly as it does for the click guard, so the service must
    // re-check existence and surface 404 rather than a misleading 400.
    const link = await createOwnedLink();

    const spy = vi.spyOn(LinkRepository, "delete").mockImplementationOnce(async (db, id) => {
      await db.prepare("DELETE FROM links WHERE id = ?").bind(id).run();
      return false;
    });
    const result = await deleteLink(env as any, link.id, OWNER).finally(() => spy.mockRestore());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("link is not in DB after a successful deleteLink", async () => {
    const link = await createOwnedLink();
    const result = await deleteLink(env as any, link.id, OWNER);
    expect(result.ok).toBe(true);
    expect(await LinkRepository.getById(env.DB, link.id)).toBeNull();
  });

  it("evicts a custom slug added between the read and the repository delete", async () => {
    // The link is read, then a custom slug lands before the repository delete
    // cascades the slug rows. The repository reports the slug set at delete
    // time, so the service must evict the raced slug from KV. Otherwise the
    // KV entry (no TTL) keeps the deleted link resolving on redirects.
    const link = await createOwnedLink();
    const systemSlug = link.slugs[0].slug;
    const racedSlug = "raced-slug";

    const realDelete = LinkRepository.delete;
    const spy = vi.spyOn(LinkRepository, "delete").mockImplementationOnce(async (db, id) => {
      await addCustomSlugToLink(env as any, id, { slug: racedSlug });
      return realDelete(db, id);
    });
    const result = await deleteLink(env as any, link.id, OWNER).finally(() => spy.mockRestore());

    expect(result.ok).toBe(true);
    expect(await SlugCache.get(env.SLUG_KV, systemSlug)).toBeNull();
    expect(await SlugCache.get(env.SLUG_KV, racedSlug)).toBeNull();
  });
});

describe("disableLink: null return from repository does not throw", () => {
  it("returns 404 rather than throwing when the link is concurrently deleted", async () => {
    // Simulate the narrow race: the link exists at getById time but is
    // deleted before the UPDATE inside LinkRepository.disable(). Without the
    // null check the function would crash with a TypeError on disabled!.slugs.
    const link = await createOwnedLink();

    const spy = vi.spyOn(LinkRepository, "disable").mockResolvedValueOnce(null);
    const result = await disableLink(env as any, link.id, OWNER).finally(() => spy.mockRestore());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

describe("disableSlug: null return from repository does not crash", () => {
  it("returns 404 rather than throwing when the slug is concurrently deleted", async () => {
    // SlugRepository.disable() returns null when the slug row vanishes between
    // the service's existence check and the UPDATE. Without a null guard the
    // service dereferences disabled!.disabled_at and throws a TypeError.
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "concurrent-slug" });

    const spy = vi.spyOn(SlugRepository, "disable").mockResolvedValueOnce(null);
    const result = await disableSlug(env as any, link.id, "concurrent-slug", OWNER).finally(() => spy.mockRestore());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

describe("enableSlug: null return from repository returns 404", () => {
  it("returns 404 rather than returning null data when the slug is concurrently deleted", async () => {
    // SlugRepository.enable() returns null when the slug row vanishes between
    // the service's existence check and the UPDATE. Without a null guard the
    // service returns ok(null) instead of a proper 404.
    const link = await createOwnedLink();
    await addCustomSlugToLink(env as any, link.id, { slug: "concurrent-slug" });
    await disableSlug(env as any, link.id, "concurrent-slug", OWNER);

    const spy = vi.spyOn(SlugRepository, "enable").mockResolvedValueOnce(null);
    const result = await enableSlug(env as any, link.id, "concurrent-slug", OWNER).finally(() => spy.mockRestore());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});
