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

describe("SlugRepository.addVanity", () => {
  it("inserts a vanity slug with is_vanity = 1", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    expect(vanity.is_vanity).toBe(1);
    expect(vanity.slug).toBe("my-custom");
    expect(vanity.link_id).toBe(link.id);
  });

  it("returns the newly inserted slug row", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    expect(vanity.id).toBeGreaterThan(0);
    expect(vanity.click_count).toBe(0);
  });

  it("sets first vanity slug as primary automatically", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    expect(vanity.is_primary).toBe(1);
    // random slug should no longer be primary
    const updated = await LinkRepository.getById(env.DB, link.id);
    const random = updated!.slugs.find((s) => !s.is_vanity);
    expect(random!.is_primary).toBe(0);
  });

  it("does not change primary when adding second vanity slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const first = await SlugRepository.addVanity(env.DB, link.id, "first-custom");
    await SlugRepository.addVanity(env.DB, link.id, "second-custom");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("first-custom");
  });

  it("allows multiple vanity slugs on the same link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addVanity(env.DB, link.id, "custom-1");
    await SlugRepository.addVanity(env.DB, link.id, "custom-2");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const vanities = updated!.slugs.filter((s) => s.is_vanity);
    expect(vanities).toHaveLength(2);
  });
});

describe("SlugRepository.setPrimary", () => {
  it("sets the specified slug as primary and clears others", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addVanity(env.DB, link.id, "custom-1");
    await SlugRepository.addVanity(env.DB, link.id, "custom-2");
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
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    const disabled = await SlugRepository.disable(env.DB, vanity.id);
    expect(disabled!.disabled_at).toBeGreaterThan(0);
  });

  it("falls back primary to random slug when disabling the primary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, vanity.id);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("abc");
    expect(primary!.is_vanity).toBe(0);
  });
});

describe("SlugRepository.enable", () => {
  it("clears disabled_at on the slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, vanity.id);
    const enabled = await SlugRepository.enable(env.DB, vanity.id);
    expect(enabled!.disabled_at).toBeNull();
  });
});

describe("SlugRepository.remove", () => {
  it("deletes a vanity slug with zero clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    const removed = await SlugRepository.remove(env.DB, vanity.id);
    expect(removed).toBe(true);
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs).toHaveLength(1);
  });

  it("refuses to delete a slug with clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    await env.DB.prepare("UPDATE slugs SET click_count = 5 WHERE id = ?").bind(vanity.id).run();
    const removed = await SlugRepository.remove(env.DB, vanity.id);
    expect(removed).toBe(false);
  });

  it("refuses to delete a random (non-vanity) slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const random = link.slugs.find((s) => !s.is_vanity)!;
    const removed = await SlugRepository.remove(env.DB, random.id);
    expect(removed).toBe(false);
  });

  it("falls back primary to random slug when removing the primary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const vanity = await SlugRepository.addVanity(env.DB, link.id, "my-custom");
    await SlugRepository.remove(env.DB, vanity.id);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("abc");
  });
});
