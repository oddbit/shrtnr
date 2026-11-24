// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// An update names the columns it changes and writes those alone. Reading the
// row, merging in memory and writing every column back turns two concurrent
// writers into a lost update: a label edit that read the row before a disable
// landed would write the old expires_at back and switch the link on again.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData, spyDb } from "../setup";
import { BundleRepository, LinkRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

function writes(log: string[], table: string): string[] {
  return log.filter((sql) => new RegExp(`^\\s*UPDATE ${table}\\b`, "i").test(sql));
}

describe("LinkRepository.update writes only the supplied columns", () => {
  it("a label edit does not write url or expires_at", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "aaa" });
    const log: string[] = [];
    await LinkRepository.update(spyDb(log), link.id, { label: "Named" });
    const updates = writes(log, "links");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/label\s*=/);
    expect(updates[0]).not.toMatch(/expires_at/);
    expect(updates[0]).not.toMatch(/url\s*=/);
  });

  it("a url edit does not write label or expires_at", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "bbb" });
    const log: string[] = [];
    await LinkRepository.update(spyDb(log), link.id, { url: "https://example.org" });
    const updates = writes(log, "links");
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toMatch(/label/);
    expect(updates[0]).not.toMatch(/expires_at/);
  });

  it("an empty patch writes nothing and returns the link unchanged", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ccc", label: "Keep" });
    const log: string[] = [];
    const updated = await LinkRepository.update(spyDb(log), link.id, {});
    expect(writes(log, "links")).toHaveLength(0);
    expect(updated?.label).toBe("Keep");
    expect(updated?.url).toBe("https://example.com");
  });

  it("still applies every supplied column together", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ddd", label: "Old" });
    const updated = await LinkRepository.update(env.DB, link.id, {
      url: "https://example.org/new",
      label: null,
      expires_at: 2_000_000_000,
    });
    expect(updated?.url).toBe("https://example.org/new");
    expect(updated?.label).toBeNull();
    expect(updated?.expires_at).toBe(2_000_000_000);
  });

  it("returns null for a link that does not exist, whatever the patch", async () => {
    expect(await LinkRepository.update(env.DB, 99999, { label: "x" })).toBeNull();
    expect(await LinkRepository.update(env.DB, 99999, {})).toBeNull();
  });
});

describe("LinkRepository.setLabelIfEmpty", () => {
  it("labels a link that has no label", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "eee" });
    expect(await LinkRepository.setLabelIfEmpty(env.DB, link.id, "Page title")).toBe(true);
    expect((await LinkRepository.getById(env.DB, link.id))?.label).toBe("Page title");
  });

  it("leaves a label that is already set", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "fff", label: "Mine" });
    expect(await LinkRepository.setLabelIfEmpty(env.DB, link.id, "Page title")).toBe(false);
    expect((await LinkRepository.getById(env.DB, link.id))?.label).toBe("Mine");
  });

  it("reports false for a link that does not exist", async () => {
    expect(await LinkRepository.setLabelIfEmpty(env.DB, 99999, "Page title")).toBe(false);
  });
});

describe("BundleRepository.update writes only the supplied columns", () => {
  it("a rename does not write description, icon or accent", async () => {
    const bundle = await BundleRepository.create(env.DB, {
      name: "Old",
      description: "About",
      icon: "star",
      accent: "blue",
      createdBy: "a@example.com",
    });
    const log: string[] = [];
    const updated = await BundleRepository.update(spyDb(log), bundle.id, { name: "New" });
    const updates = writes(log, "bundles");
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toMatch(/description/);
    expect(updates[0]).not.toMatch(/icon/);
    expect(updates[0]).not.toMatch(/accent/);
    expect(updated).toMatchObject({ name: "New", description: "About", icon: "star", accent: "blue" });
  });

  it("clears description and icon when they are null", async () => {
    const bundle = await BundleRepository.create(env.DB, {
      name: "B",
      description: "About",
      icon: "star",
      createdBy: "a@example.com",
    });
    const updated = await BundleRepository.update(env.DB, bundle.id, { description: null, icon: null });
    expect(updated?.description).toBeNull();
    expect(updated?.icon).toBeNull();
    expect(updated?.name).toBe("B");
  });

  it("returns null for a bundle that does not exist", async () => {
    expect(await BundleRepository.update(env.DB, 99999, { name: "x" })).toBeNull();
  });
});
