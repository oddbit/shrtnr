import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, SlugRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("SlugRepository.findByValue", () => {
  it("returns slug with url and expires_at for a known slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const found = await SlugRepository.findByValue(env.DB, "abc");
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("abc");
    expect(found!.url).toBe("https://example.com");
    expect(found!.link_id).toBe(link.id);
    expect(found!.expires_at).toBeNull();
  });

  it("returns null for a non-existent slug", async () => {
    expect(await SlugRepository.findByValue(env.DB, "nope")).toBeNull();
  });

  it("includes expires_at from the parent link", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "exp", expiresAt: future });
    const found = await SlugRepository.findByValue(env.DB, "exp");
    expect(found!.expires_at).toBe(future);
  });
});

describe("SlugRepository.exists", () => {
  it("returns true for a slug that exists", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(await SlugRepository.exists(env.DB, "abc")).toBe(true);
  });

  it("returns false for a slug that does not exist", async () => {
    expect(await SlugRepository.exists(env.DB, "nonexistent")).toBe(false);
  });
});

describe("SlugRepository.addCustom", () => {
  it("inserts a custom slug with is_custom = 1", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.is_custom).toBe(1);
    expect(custom.slug).toBe("my-custom");
    expect(custom.link_id).toBe(link.id);
  });

  it("returns the newly inserted slug row", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.id).toBeGreaterThan(0);
    expect(custom.click_count).toBe(0);
  });

  it("sets first custom slug as primary automatically", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.is_primary).toBe(1);
    // random slug should no longer be primary
    const updated = await LinkRepository.getById(env.DB, link.id);
    const random = updated!.slugs.find((s) => !s.is_custom);
    expect(random!.is_primary).toBe(0);
  });

  it("does not change primary when adding second custom slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const first = await SlugRepository.addCustom(env.DB, link.id, "first-custom");
    await SlugRepository.addCustom(env.DB, link.id, "second-custom");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("first-custom");
  });

  it("allows multiple custom slugs on the same link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom-1");
    await SlugRepository.addCustom(env.DB, link.id, "custom-2");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const vanities = updated!.slugs.filter((s) => s.is_custom);
    expect(vanities).toHaveLength(2);
  });
});

describe("SlugRepository.setPrimary", () => {
  it("sets the specified slug as primary and clears others", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom-1");
    await SlugRepository.addCustom(env.DB, link.id, "custom-2");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const second = updated!.slugs.find((s) => s.slug === "custom-2")!;
    await SlugRepository.setPrimary(env.DB, link.id, second.id);
    const final = await LinkRepository.getById(env.DB, link.id);
    expect(final!.slugs.find((s) => s.slug === "custom-2")!.is_primary).toBe(1);
    expect(final!.slugs.find((s) => s.slug === "custom-1")!.is_primary).toBe(0);
    expect(final!.slugs.find((s) => s.slug === "abc")!.is_primary).toBe(0);
  });
});

describe("SlugRepository.disable", () => {
  it("sets disabled_at on the slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const disabled = await SlugRepository.disable(env.DB, custom.id);
    expect(disabled!.disabled_at).toBeGreaterThan(0);
  });

  it("falls back primary to random slug when disabling the primary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, custom.id);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("abc");
    expect(primary!.is_custom).toBe(0);
  });
});

describe("SlugRepository.enable", () => {
  it("clears disabled_at on the slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, custom.id);
    const enabled = await SlugRepository.enable(env.DB, custom.id);
    expect(enabled!.disabled_at).toBeNull();
  });
});

describe("SlugRepository.remove", () => {
  it("deletes a custom slug with zero clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const removed = await SlugRepository.remove(env.DB, custom.id);
    expect(removed).toBe(true);
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs).toHaveLength(1);
  });

  it("refuses to delete a slug with clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await env.DB.prepare("INSERT INTO clicks (slug_id, clicked_at, link_mode) VALUES (?, ?, 'link')").bind(custom.id, Math.floor(Date.now() / 1000)).run();
    const removed = await SlugRepository.remove(env.DB, custom.id);
    expect(removed).toBe(false);
  });

  it("refuses to delete a random (non-custom) slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const random = link.slugs.find((s) => !s.is_custom)!;
    const removed = await SlugRepository.remove(env.DB, random.id);
    expect(removed).toBe(false);
  });

  it("falls back primary to random slug when removing the primary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.remove(env.DB, custom.id);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("abc");
  });
});
