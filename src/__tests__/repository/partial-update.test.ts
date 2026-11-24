// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Two requests that change different fields of the same row must both land.
//
// Each test lets the update under test start, lands a second writer's change
// just before the update's own write reaches D1 (interleaveDb), and then reads
// the row: the second writer's field must still hold what it wrote. The tests
// say nothing about how the update is built, only what survives it.
//
// The case that matters most for a link shortener is the first one: an edit to
// a label must never bring a link back to life that its owner just disabled.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, interleaveDb, resetData } from "../setup";
import { BundleRepository, LinkRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

const LINK_WRITE = /^\s*UPDATE\s+links\b/i;
const BUNDLE_WRITE = /^\s*UPDATE\s+bundles\b/i;

async function linkRow(id: number) {
  const row = await LinkRepository.getById(env.DB, id);
  if (!row) throw new Error("link vanished");
  return row;
}

describe("LinkRepository.update: a concurrent change to another field survives", () => {
  it("a label edit does not re-enable a link disabled in the meantime", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "aaa" });
    const racing = interleaveDb(LINK_WRITE, () => LinkRepository.disable(env.DB, link.id));

    await LinkRepository.update(racing, link.id, { label: "Named" });

    const after = await linkRow(link.id);
    expect(after.label).toBe("Named");
    expect(after.expires_at, "the disable must survive the label edit").not.toBeNull();
  });

  it("a label edit does not undo a retarget made in the meantime", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/old", slug: "bbb" });
    const racing = interleaveDb(LINK_WRITE, () =>
      LinkRepository.update(env.DB, link.id, { url: "https://example.com/new" }),
    );

    await LinkRepository.update(racing, link.id, { label: "Named" });

    const after = await linkRow(link.id);
    expect(after.label).toBe("Named");
    expect(after.url).toBe("https://example.com/new");
  });

  it("a retarget does not erase a label set in the meantime", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/old", slug: "ccc" });
    const racing = interleaveDb(LINK_WRITE, () => LinkRepository.update(env.DB, link.id, { label: "Typed meanwhile" }));

    await LinkRepository.update(racing, link.id, { url: "https://example.com/new" });

    const after = await linkRow(link.id);
    expect(after.url).toBe("https://example.com/new");
    expect(after.label).toBe("Typed meanwhile");
  });

  it("a scheduled expiry does not undo a retarget made in the meantime", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/old", slug: "ddd" });
    const racing = interleaveDb(LINK_WRITE, () =>
      LinkRepository.update(env.DB, link.id, { url: "https://example.com/new" }),
    );

    await LinkRepository.update(racing, link.id, { expires_at: 2_000_000_000 });

    const after = await linkRow(link.id);
    expect(after.expires_at).toBe(2_000_000_000);
    expect(after.url).toBe("https://example.com/new");
  });
});

describe("LinkRepository.update: what a patch means", () => {
  it("applies every supplied field together", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "eee", label: "Old" });
    const updated = await LinkRepository.update(env.DB, link.id, {
      url: "https://example.org/new",
      label: null,
      expires_at: 2_000_000_000,
    });
    expect(updated).toMatchObject({ url: "https://example.org/new", label: null, expires_at: 2_000_000_000 });
  });

  it("leaves a field alone when the patch does not name it", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "fff",
      label: "Keep",
      expiresAt: 2_000_000_000,
    });
    const updated = await LinkRepository.update(env.DB, link.id, { url: "https://example.org" });
    expect(updated).toMatchObject({ url: "https://example.org", label: "Keep", expires_at: 2_000_000_000 });
  });

  it("null clears a field; an absent field is not a null", async () => {
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com",
      slug: "ggg",
      label: "Keep",
      expiresAt: 2_000_000_000,
    });
    const updated = await LinkRepository.update(env.DB, link.id, { expires_at: null });
    expect(updated).toMatchObject({ label: "Keep", expires_at: null });
  });

  it("an empty patch returns the link as it is", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "hhh", label: "Keep" });
    const updated = await LinkRepository.update(env.DB, link.id, {});
    expect(updated).toMatchObject({ id: link.id, url: "https://example.com", label: "Keep", expires_at: null });
  });

  it("returns null for a link that does not exist, whatever the patch, and creates nothing", async () => {
    expect(await LinkRepository.update(env.DB, 99999, { label: "x" })).toBeNull();
    expect(await LinkRepository.update(env.DB, 99999, {})).toBeNull();
    expect(await LinkRepository.count(env.DB)).toBe(0);
  });
});

describe("LinkRepository.setLabelIfEmpty", () => {
  it("labels a link that has no label", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "iii" });
    expect(await LinkRepository.setLabelIfEmpty(env.DB, link.id, "Page title")).toBe(true);
    expect((await linkRow(link.id)).label).toBe("Page title");
  });

  it("treats an empty-string label as no label", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "jjj", label: "" });
    expect(await LinkRepository.setLabelIfEmpty(env.DB, link.id, "Page title")).toBe(true);
    expect((await linkRow(link.id)).label).toBe("Page title");
  });

  it("leaves a label that is already set, and says so", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "kkk", label: "Mine" });
    expect(await LinkRepository.setLabelIfEmpty(env.DB, link.id, "Page title")).toBe(false);
    expect((await linkRow(link.id)).label).toBe("Mine");
  });

  it("touches nothing but the label", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com/x", slug: "lll", expiresAt: 2_000_000_000 });
    await LinkRepository.setLabelIfEmpty(env.DB, link.id, "Page title");
    expect(await linkRow(link.id)).toMatchObject({ url: "https://example.com/x", expires_at: 2_000_000_000 });
  });

  it("reports false for a link that does not exist", async () => {
    expect(await LinkRepository.setLabelIfEmpty(env.DB, 99999, "Page title")).toBe(false);
  });
});

describe("BundleRepository.update: a concurrent change to another field survives", () => {
  it("a rename does not undo a description and accent changed in the meantime", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "Old", description: "Before", accent: "blue", createdBy: "a@example.com" });
    const racing = interleaveDb(BUNDLE_WRITE, () =>
      BundleRepository.update(env.DB, bundle.id, { description: "After", accent: "red" }),
    );

    await BundleRepository.update(racing, bundle.id, { name: "New" });

    expect(await BundleRepository.getById(env.DB, bundle.id)).toMatchObject({
      name: "New",
      description: "After",
      accent: "red",
    });
  });

  it("a rename does not unarchive a bundle archived in the meantime", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "Old", createdBy: "a@example.com" });
    const racing = interleaveDb(BUNDLE_WRITE, () => BundleRepository.archive(env.DB, bundle.id));

    await BundleRepository.update(racing, bundle.id, { name: "New" });

    const after = await BundleRepository.getById(env.DB, bundle.id);
    expect(after?.name).toBe("New");
    expect(after?.archived_at).not.toBeNull();
  });
});

describe("BundleRepository.update: what a patch means", () => {
  it("leaves a field alone when the patch does not name it", async () => {
    const bundle = await BundleRepository.create(env.DB, {
      name: "B",
      description: "About",
      icon: "star",
      accent: "blue",
      createdBy: "a@example.com",
    });
    const updated = await BundleRepository.update(env.DB, bundle.id, { name: "Renamed" });
    expect(updated).toMatchObject({ name: "Renamed", description: "About", icon: "star", accent: "blue" });
  });

  it("null clears description and icon", async () => {
    const bundle = await BundleRepository.create(env.DB, { name: "B", description: "About", icon: "star", createdBy: "a@example.com" });
    const updated = await BundleRepository.update(env.DB, bundle.id, { description: null, icon: null });
    expect(updated).toMatchObject({ name: "B", description: null, icon: null });
  });

  it("returns null for a bundle that does not exist", async () => {
    expect(await BundleRepository.update(env.DB, 99999, { name: "x" })).toBeNull();
  });
});
