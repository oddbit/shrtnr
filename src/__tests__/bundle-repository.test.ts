import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { BundleRepository, LinkRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

describe("BundleRepository.create", () => {
  it("creates a bundle with defaults", async () => {
    const bundle = await BundleRepository.create(env.DB, {
      name: "OSS",
      createdBy: "dennis@oddbit.id",
    });
    expect(bundle.id).toBeGreaterThan(0);
    expect(bundle.name).toBe("OSS");
    expect(bundle.description).toBeNull();
    expect(bundle.icon).toBeNull();
    expect(bundle.accent).toBe("orange");
    expect(bundle.archived_at).toBeNull();
    expect(bundle.created_by).toBe("dennis@oddbit.id");
    expect(bundle.created_at).toBeGreaterThan(0);
    expect(bundle.updated_at).toBe(bundle.created_at);
  });

  it("stores description, icon and accent when provided", async () => {
    const bundle = await BundleRepository.create(env.DB, {
      name: "Spring Launch",
      description: "All launch links",
      icon: "campaign",
      accent: "red",
      createdBy: "dennis@oddbit.id",
    });
    expect(bundle.description).toBe("All launch links");
    expect(bundle.icon).toBe("campaign");
    expect(bundle.accent).toBe("red");
  });
});

describe("BundleRepository.getById", () => {
  it("returns the bundle when found", async () => {
    const created = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    const fetched = await BundleRepository.getById(env.DB, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
  });

  it("returns null for unknown id", async () => {
    expect(await BundleRepository.getById(env.DB, 99999)).toBeNull();
  });
});

describe("BundleRepository.list", () => {
  it("returns only the caller's bundles", async () => {
    await BundleRepository.create(env.DB, { name: "Mine 1", createdBy: "a@b" });
    await BundleRepository.create(env.DB, { name: "Mine 2", createdBy: "a@b" });
    await BundleRepository.create(env.DB, { name: "Theirs", createdBy: "other@x" });

    const mine = await BundleRepository.list(env.DB, { createdBy: "a@b" });
    expect(mine).toHaveLength(2);
    expect(mine.map((b) => b.name).sort()).toEqual(["Mine 1", "Mine 2"]);
  });

  it("excludes archived bundles by default", async () => {
    const b1 = await BundleRepository.create(env.DB, { name: "Active", createdBy: "a@b" });
    const b2 = await BundleRepository.create(env.DB, { name: "Old", createdBy: "a@b" });
    await BundleRepository.archive(env.DB, b2.id);

    const list = await BundleRepository.list(env.DB, { createdBy: "a@b" });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b1.id);
  });

  it("includes archived bundles when includeArchived=true", async () => {
    await BundleRepository.create(env.DB, { name: "Active", createdBy: "a@b" });
    const b2 = await BundleRepository.create(env.DB, { name: "Old", createdBy: "a@b" });
    await BundleRepository.archive(env.DB, b2.id);

    const list = await BundleRepository.list(env.DB, { createdBy: "a@b", includeArchived: true });
    expect(list).toHaveLength(2);
  });

  it("returns only archived when archivedOnly=true", async () => {
    await BundleRepository.create(env.DB, { name: "Active", createdBy: "a@b" });
    const b2 = await BundleRepository.create(env.DB, { name: "Old", createdBy: "a@b" });
    await BundleRepository.archive(env.DB, b2.id);

    const list = await BundleRepository.list(env.DB, { createdBy: "a@b", archivedOnly: true });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b2.id);
  });
});

describe("BundleRepository.update", () => {
  it("updates provided fields and bumps updated_at", async () => {
    const created = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    const before = created.updated_at;
    // Wait so updated_at actually advances (resolution is seconds)
    await new Promise((r) => setTimeout(r, 1100));

    const updated = await BundleRepository.update(env.DB, created.id, {
      name: "OSS project",
      description: "Updated",
      accent: "green",
      icon: "rocket_launch",
    });
    expect(updated!.name).toBe("OSS project");
    expect(updated!.description).toBe("Updated");
    expect(updated!.accent).toBe("green");
    expect(updated!.icon).toBe("rocket_launch");
    expect(updated!.updated_at).toBeGreaterThan(before);
  });

  it("returns null for unknown id", async () => {
    expect(await BundleRepository.update(env.DB, 99999, { name: "X" })).toBeNull();
  });

  it("clears description when set to null", async () => {
    const created = await BundleRepository.create(env.DB, {
      name: "OSS",
      description: "something",
      createdBy: "a@b",
    });
    const updated = await BundleRepository.update(env.DB, created.id, { description: null });
    expect(updated!.description).toBeNull();
  });
});

describe("BundleRepository.archive / unarchive", () => {
  it("sets archived_at on archive and clears on unarchive", async () => {
    const created = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    const archived = await BundleRepository.archive(env.DB, created.id);
    expect(archived!.archived_at).not.toBeNull();
    const unarchived = await BundleRepository.unarchive(env.DB, created.id);
    expect(unarchived!.archived_at).toBeNull();
  });
});

describe("BundleRepository.delete", () => {
  it("removes the bundle", async () => {
    const created = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    expect(await BundleRepository.delete(env.DB, created.id)).toBe(true);
    expect(await BundleRepository.getById(env.DB, created.id)).toBeNull();
  });

  it("cascades to bundle_links", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    await BundleRepository.delete(env.DB, bundle.id);

    const row = await env.DB
      .prepare("SELECT COUNT(*) as cnt FROM bundle_links WHERE bundle_id = ?")
      .bind(bundle.id)
      .first<{ cnt: number }>();
    expect(row!.cnt).toBe(0);
  });

  it("does not delete member links themselves", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    await BundleRepository.delete(env.DB, bundle.id);

    expect(await LinkRepository.getById(env.DB, link.id)).not.toBeNull();
  });

  it("returns false for unknown id", async () => {
    expect(await BundleRepository.delete(env.DB, 99999)).toBe(false);
  });
});

describe("BundleRepository.addLink / removeLink", () => {
  it("adds a link to a bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    expect(await BundleRepository.countLinks(env.DB, bundle.id)).toBe(1);
  });

  it("is idempotent — adding the same link twice is a no-op", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    expect(await BundleRepository.countLinks(env.DB, bundle.id)).toBe(1);
  });

  it("removes a link from a bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    expect(await BundleRepository.removeLink(env.DB, bundle.id, link.id)).toBe(true);
    expect(await BundleRepository.countLinks(env.DB, bundle.id)).toBe(0);
  });

  it("removeLink returns false when not a member", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    expect(await BundleRepository.removeLink(env.DB, bundle.id, link.id)).toBe(false);
  });

  it("cascades membership away when a link is deleted", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    await LinkRepository.delete(env.DB, link.id);
    expect(await BundleRepository.countLinks(env.DB, bundle.id)).toBe(0);
  });
});

describe("BundleRepository.listLinks", () => {
  it("returns all member links with slugs and total_clicks", async () => {
    const link1 = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const link2 = await LinkRepository.create(env.DB, { url: "https://b.com", slug: "bbb", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link1.id);
    await BundleRepository.addLink(env.DB, bundle.id, link2.id);

    const links = await BundleRepository.listLinks(env.DB, bundle.id);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.id).sort()).toEqual([link1.id, link2.id].sort());
    expect(links[0].slugs.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty bundle", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    expect(await BundleRepository.listLinks(env.DB, bundle.id)).toEqual([]);
  });
});

describe("BundleRepository.listBundlesForLink", () => {
  it("returns all bundles a link belongs to", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    const b1 = await BundleRepository.create(env.DB, { name: "OSS", createdBy: "a@b" });
    const b2 = await BundleRepository.create(env.DB, { name: "Launch", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, b1.id, link.id);
    await BundleRepository.addLink(env.DB, b2.id, link.id);

    const bundles = await BundleRepository.listBundlesForLink(env.DB, link.id);
    expect(bundles).toHaveLength(2);
    expect(bundles.map((b) => b.id).sort()).toEqual([b1.id, b2.id].sort());
  });

  it("returns empty array when link is not in any bundles", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://e.com", slug: "abc", createdBy: "a@b" });
    expect(await BundleRepository.listBundlesForLink(env.DB, link.id)).toEqual([]);
  });
});
