import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { BundleRepository, LinkRepository } from "../../db";
import * as svc from "../../services/bundle-management";
import type { Env } from "../../types";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

const e = env as unknown as Env;

describe("createBundle", () => {
  it("creates a bundle for the caller", async () => {
    const res = await svc.createBundle(e, { name: "OSS" }, "a@b");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.name).toBe("OSS");
      expect(res.data.created_by).toBe("a@b");
      expect(res.status).toBe(201);
    }
  });

  it("rejects blank name", async () => {
    const res = await svc.createBundle(e, { name: "" }, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("rejects invalid accent", async () => {
    const res = await svc.createBundle(e, { name: "OSS", accent: "neon" as unknown as "orange" }, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});

describe("listBundles", () => {
  it("returns every bundle regardless of creator (open read by design)", async () => {
    await BundleRepository.create(env.DB, { name: "Mine", createdBy: "a@b" });
    await BundleRepository.create(env.DB, { name: "Theirs", createdBy: "other@x" });
    const res = await svc.listBundles(e, "a@b", {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      expect(res.data.map((b) => b.name).sort()).toEqual(["Mine", "Theirs"]);
    }
  });

  it("hides archived by default", async () => {
    const b = await BundleRepository.create(env.DB, { name: "Old", createdBy: "a@b" });
    await BundleRepository.archive(env.DB, b.id);
    await BundleRepository.create(env.DB, { name: "Active", createdBy: "a@b" });
    const res = await svc.listBundles(e, "a@b", {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.map((b) => b.name)).toEqual(["Active"]);
    }
  });

  it("includes archived when requested", async () => {
    const b = await BundleRepository.create(env.DB, { name: "Old", createdBy: "a@b" });
    await BundleRepository.archive(env.DB, b.id);
    const res = await svc.listBundles(e, "a@b", { includeArchived: true });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toHaveLength(1);
  });

  it("attaches total_clicks and link_count summaries", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode) VALUES (?, ?, 'link')")
      .bind(link.slugs[0].slug, now).run();

    const res = await svc.listBundles(e, "a@b", {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].link_count).toBe(1);
      expect(res.data[0].total_clicks).toBe(1);
      expect(Array.isArray(res.data[0].sparkline)).toBe(true);
    }
  });
});

describe("getBundle / updateBundle", () => {
  it("returns 404 for unknown id", async () => {
    const res = await svc.getBundle(e, 99999, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it("returns the bundle to any caller (open read by design)", async () => {
    const b = await BundleRepository.create(env.DB, { name: "Mine", createdBy: "a@b" });
    const res = await svc.getBundle(e, b.id, "not-owner@x");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe(b.id);
      expect(res.data.created_by).toBe("a@b");
    }
  });

  it("enforces ownership on update", async () => {
    const b = await BundleRepository.create(env.DB, { name: "Mine", createdBy: "a@b" });
    const res = await svc.updateBundle(e, b.id, { name: "Stolen" }, "not-owner@x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("returns 404 when updating a non-existent bundle", async () => {
    const res = await svc.updateBundle(e, 99999, { name: "Stolen" }, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });
});

describe("addLinkToBundle / removeLinkFromBundle", () => {
  it("adds a link to a bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });

    const res = await svc.addLinkToBundle(e, b.id, link.id, "a@b");
    expect(res.ok).toBe(true);
    expect(await BundleRepository.countLinks(env.DB, b.id)).toBe(1);
  });

  it("any authenticated caller can add a link to any bundle (open append by design)", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await svc.addLinkToBundle(e, b.id, link.id, "collaborator@x");
    expect(res.ok).toBe(true);
    expect(await BundleRepository.countLinks(env.DB, b.id)).toBe(1);
  });

  it("is idempotent on add", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await svc.addLinkToBundle(e, b.id, link.id, "a@b");
    const again = await svc.addLinkToBundle(e, b.id, link.id, "a@b");
    expect(again.ok).toBe(true);
    expect(await BundleRepository.countLinks(env.DB, b.id)).toBe(1);
  });

  it("404s when link does not exist", async () => {
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await svc.addLinkToBundle(e, b.id, 99999, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it("removes a link from a bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, b.id, link.id);
    const res = await svc.removeLinkFromBundle(e, b.id, link.id, "a@b");
    expect(res.ok).toBe(true);
    expect(await BundleRepository.countLinks(env.DB, b.id)).toBe(0);
  });

  it("only the bundle owner can remove a link from the bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, b.id, link.id);
    const res = await svc.removeLinkFromBundle(e, b.id, link.id, "intruder@x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(await BundleRepository.countLinks(env.DB, b.id)).toBe(1);
  });

  it("returns 404 when removing a link from a non-existent bundle", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const res = await svc.removeLinkFromBundle(e, 99999, link.id, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });
});

describe("archive / unarchive / delete", () => {
  it("archives and unarchives", async () => {
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const archived = await svc.archiveBundle(e, b.id, "a@b");
    expect(archived.ok).toBe(true);
    if (archived.ok) expect(archived.data.archived_at).not.toBeNull();

    const unarchived = await svc.unarchiveBundle(e, b.id, "a@b");
    expect(unarchived.ok).toBe(true);
    if (unarchived.ok) expect(unarchived.data.archived_at).toBeNull();
  });

  it("non-owner cannot archive", async () => {
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await svc.archiveBundle(e, b.id, "x@x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("returns 404 when archiving a non-existent bundle", async () => {
    const res = await svc.archiveBundle(e, 99999, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it("non-owner cannot unarchive", async () => {
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.archive(env.DB, b.id);
    const res = await svc.unarchiveBundle(e, b.id, "x@x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("returns 404 when unarchiving a non-existent bundle", async () => {
    const res = await svc.unarchiveBundle(e, 99999, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it("deletes the bundle", async () => {
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await svc.deleteBundle(e, b.id, "a@b");
    expect(res.ok).toBe(true);
    expect(await BundleRepository.getById(env.DB, b.id)).toBeNull();
  });

  it("non-owner cannot delete", async () => {
    const b = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await svc.deleteBundle(e, b.id, "x@x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("returns 404 when deleting a non-existent bundle", async () => {
    const res = await svc.deleteBundle(e, 99999, "a@b");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });
});

describe("getBundleAnalytics", () => {
  it("returns BundleStats for the owner", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, bundle.id, link.id);
    const res = await svc.getBundleAnalytics(e, bundle.id, "30d", "a@b");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.link_count).toBe(1);
      expect(res.data.bundle.id).toBe(bundle.id);
    }
  });

  it("returns analytics to any caller (open read by design)", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "B", createdBy: "a@b" });
    const res = await svc.getBundleAnalytics(e, bundle.id, "30d", "x@x");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.bundle.id).toBe(bundle.id);
  });
});

describe("listBundlesForLink", () => {
  it("returns active bundles a link is in, excluding archived", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://a.com", slug: "aaa", createdBy: "a@b" });
    const b1 = await BundleRepository.create(env.DB, { name: "Active", createdBy: "a@b" });
    const b2 = await BundleRepository.create(env.DB, { name: "Archived", createdBy: "a@b" });
    await BundleRepository.addLink(env.DB, b1.id, link.id);
    await BundleRepository.addLink(env.DB, b2.id, link.id);
    await BundleRepository.archive(env.DB, b2.id);

    const res = await svc.listBundlesForLink(e, link.id, "a@b");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe("Active");
    }
  });
});
