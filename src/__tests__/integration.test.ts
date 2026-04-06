import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  LinkRepository,
  SlugRepository,
  ClickRepository,
  SettingRepository,
  ApiKeyRepository,
} from "../db";
import { generateUniqueSlug } from "../slugs";
import { applyMigrations, resetData } from "./setup";

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Link CRUD ----

describe("Link CRUD", () => {
  it("should create a link with an auto-generated slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(link.url).toBe("https://example.com");
    expect(link.slugs).toHaveLength(1);
    expect(link.slugs[0].slug).toBe("abc");
    expect(link.slugs[0].is_custom).toBe(0);
    expect(link.total_clicks).toBe(0);
    expect(link.expires_at).toBeNull();
  });

  it("should create a link with a label", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", label: "My Label" });
    expect(link.label).toBe("My Label");
  });

  it("should create a link with an expires_at timestamp", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", expiresAt: future });
    expect(link.expires_at).toBe(future);
  });

  it("should support adding a custom slug after link creation", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    expect(fetched.slugs).toHaveLength(2);
    const auto = fetched.slugs.find((s) => s.is_custom === 0);
    const custom = fetched.slugs.find((s) => s.is_custom === 1);
    expect(auto!.slug).toBe("abc");
    expect(custom!.slug).toBe("my-custom");
  });

  it("should always return auto-generated slug at index 0 and custom at index 1", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    expect(fetched.slugs[0].is_custom).toBe(0);
    expect(fetched.slugs[0].slug).toBe("abc");
    expect(fetched.slugs[1].is_custom).toBe(1);
    expect(fetched.slugs[1].slug).toBe("my-custom");
  });

  it("should preserve slug ordering after adding a custom slug later", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "later-custom");
    const fetched = await LinkRepository.getById(env.DB, link.id);
    expect(fetched!.slugs).toHaveLength(2);
    expect(fetched!.slugs[0].is_custom).toBe(0);
    expect(fetched!.slugs[0].slug).toBe("abc");
    expect(fetched!.slugs[1].is_custom).toBe(1);
    expect(fetched!.slugs[1].slug).toBe("later-custom");
  });

  it("should preserve slug ordering in list", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const links = await LinkRepository.list(env.DB);
    expect(links[0].slugs[0].is_custom).toBe(0);
    expect(links[0].slugs[1].is_custom).toBe(1);
  });

  it("should fetch all links sorted by created_at descending", async () => {
    await LinkRepository.create(env.DB, { url: "https://first.com", slug: "aaa" });
    await LinkRepository.create(env.DB, { url: "https://second.com", slug: "bbb" });
    const links = await LinkRepository.list(env.DB);
    expect(links).toHaveLength(2);
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://first.com");
    expect(urls).toContain("https://second.com");
  });

  it("should include slugs and total click count in fetched links", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const links = await LinkRepository.list(env.DB);
    expect(links[0].slugs).toHaveLength(1);
    expect(links[0].total_clicks).toBe(1);
  });

  it("should fetch a single link by ID", async () => {
    const created = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const fetched = await LinkRepository.getById(env.DB, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.url).toBe("https://example.com");
    expect(fetched!.slugs).toHaveLength(1);
  });

  it("should return null for a non-existent link ID", async () => {
    const result = await LinkRepository.getById(env.DB, 99999);
    expect(result).toBeNull();
  });

  it("should update a link URL without affecting slugs", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://old.com", slug: "abc" });
    const updated = await LinkRepository.update(env.DB, link.id, { url: "https://new.com" });
    expect(updated!.url).toBe("https://new.com");
    expect(updated!.slugs).toHaveLength(1);
    expect(updated!.slugs[0].slug).toBe("abc");
  });

  it("should clear label when set to null", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", label: "A Label" });
    expect(link.label).toBe("A Label");
    const updated = await LinkRepository.update(env.DB, link.id, { label: null });
    expect(updated!.label).toBeNull();
  });

  it("should clear expires_at when set to null (re-enable)", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", expiresAt: future });
    expect(link.expires_at).toBe(future);
    const updated = await LinkRepository.update(env.DB, link.id, { expires_at: null });
    expect(updated!.expires_at).toBeNull();
  });

  it("should set a scheduled expiry via update", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const future = Math.floor(Date.now() / 1000) + 7200;
    const updated = await LinkRepository.update(env.DB, link.id, { expires_at: future });
    expect(updated!.expires_at).toBe(future);
  });

  it("should return null when updating a non-existent link", async () => {
    const result = await LinkRepository.update(env.DB, 99999, { url: "https://nope.com" });
    expect(result).toBeNull();
  });
});

// ---- Disable / Enable ----

describe("Disable / Enable", () => {
  it("should set expires_at to the current timestamp when disabling", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const before = Math.floor(Date.now() / 1000);
    const disabled = await LinkRepository.disable(env.DB, link.id);
    const after = Math.floor(Date.now() / 1000);
    expect(disabled!.expires_at).toBeGreaterThanOrEqual(before);
    expect(disabled!.expires_at).toBeLessThanOrEqual(after);
  });

  it("should allow re-enabling by clearing expires_at", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await LinkRepository.disable(env.DB, link.id);
    const enabled = await LinkRepository.update(env.DB, link.id, { expires_at: null });
    expect(enabled!.expires_at).toBeNull();
  });

  it("should return null when disabling a non-existent link", async () => {
    const result = await LinkRepository.disable(env.DB, 99999);
    expect(result).toBeNull();
  });

  it("should update expires_at when disabling an already disabled link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const first = await LinkRepository.disable(env.DB, link.id);
    const firstExpiry = first!.expires_at;
    const second = await LinkRepository.disable(env.DB, link.id);
    expect(second!.expires_at).toBeGreaterThanOrEqual(firstExpiry!);
  });
});

// ---- Delete (zero-click links) ----

describe("Delete Link", () => {
  // TODO: Implement LinkRepository.delete for links with zero clicks.
  // The method should remove the link and all its slugs from the database.
  // It should reject deletion when any slug has clicks.

  it("should delete a link with zero clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://deleteme.com", slug: "del" });
    const deleted = await LinkRepository.delete(env.DB, link.id);
    expect(deleted).toBe(true);
    const fetched = await LinkRepository.getById(env.DB, link.id);
    expect(fetched).toBeNull();
  });

  it("should reject deletion of a link with clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://popular.com", slug: "pop" });
    await ClickRepository.record(env.DB, link.slugs[0].id);
    const deleted = await LinkRepository.delete(env.DB, link.id);
    expect(deleted).toBe(false);
    const fetched = await LinkRepository.getById(env.DB, link.id);
    expect(fetched).not.toBeNull();
  });

  it("should return false when deleting a non-existent link", async () => {
    const deleted = await LinkRepository.delete(env.DB, 99999);
    expect(deleted).toBe(false);
  });

  it("should also remove all slugs of the deleted link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://deleteme.com", slug: "del" });
    await SlugRepository.addCustom(env.DB, link.id, "custom-del");
    await LinkRepository.delete(env.DB, link.id);
    expect(await SlugRepository.exists(env.DB, "del")).toBe(false);
    expect(await SlugRepository.exists(env.DB, "custom-del")).toBe(false);
  });
});

// ---- Custom Slugs ----

describe("Custom Slugs", () => {
  it("should add a custom slug with is_custom = 1", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.is_custom).toBe(1);
    expect(custom.slug).toBe("my-custom");
    expect(custom.link_id).toBe(link.id);
  });

  it("should check slug existence correctly", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(await SlugRepository.exists(env.DB, "abc")).toBe(true);
    expect(await SlugRepository.exists(env.DB, "nonexistent")).toBe(false);
  });
});

// ---- Slug Generation with DB ----

describe("generateUniqueSlug", () => {
  it("should generate a slug that does not exist in the database", async () => {
    const slug = await generateUniqueSlug(env.DB, 3);
    expect(slug).toHaveLength(3);
    expect(await SlugRepository.exists(env.DB, slug)).toBe(false);
  });
});

// ---- Analytics ----

describe("Analytics", () => {
  it("should return zeros and empty arrays for a link with no clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(0);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
    expect(stats.clicks_over_time).toEqual([]);
  });

  it("should record a click and increment slug click_count", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, { referrer: "https://referrer.com", country: "US", deviceType: "desktop", browser: "Chrome" });
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs[0].click_count).toBe(1);
    expect(updated!.total_clicks).toBe(1);
  });

  it("should capture referrer, country, device type, and browser", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, { referrer: "https://referrer.com", country: "US", deviceType: "mobile", browser: "Safari" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([{ name: "US", count: 1 }]);
    expect(stats.referrers).toEqual([{ name: "https://referrer.com", count: 1 }]);
    expect(stats.devices).toEqual([{ name: "mobile", count: 1 }]);
    expect(stats.browsers).toEqual([{ name: "Safari", count: 1 }]);
  });

  it("should handle null values for referrer, country, and UA", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId);
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
  });

  it("should aggregate clicks across multiple slugs of a link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    const autoSlug = fetched.slugs.find((s) => s.is_custom === 0)!;
    const customSlug = fetched.slugs.find((s) => s.is_custom === 1)!;
    await ClickRepository.record(env.DB, autoSlug.id, { country: "US", deviceType: "desktop", browser: "Chrome" });
    await ClickRepository.record(env.DB, customSlug.id, { country: "DE", deviceType: "mobile", browser: "Firefox" });
    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(2);
  });

  it("should return dashboard stats with totals and top lists", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await ClickRepository.record(env.DB, link.slugs[0].id, { country: "US", deviceType: "desktop", browser: "Chrome" });
    const stats = await ClickRepository.getDashboardStats(env.DB);
    expect(stats.total_links).toBe(1);
    expect(stats.total_clicks).toBe(1);
    expect(stats.recent_links).toHaveLength(1);
    expect(stats.top_links).toHaveLength(1);
    expect(stats.top_countries).toEqual([{ name: "US", count: 1 }]);
  });

  it("should return the 5 most recent links in dashboard stats", async () => {
    for (let i = 0; i < 7; i++) {
      await LinkRepository.create(env.DB, { url: `https://example${i}.com`, slug: `s${i}${i}${i}` });
    }
    const stats = await ClickRepository.getDashboardStats(env.DB);
    expect(stats.recent_links).toHaveLength(5);
  });
});

// ---- Settings ----

describe("Settings", () => {
  it("should return the current slug_default_length setting", async () => {
    const val = await SettingRepository.get(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("3");
  });

  it("should persist an updated setting", async () => {
    await SettingRepository.set(env.DB, "anonymous", "slug_default_length", "5");
    const val = await SettingRepository.get(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("5");
  });

  it("should return null for a non-existent setting", async () => {
    const val = await SettingRepository.get(env.DB, "anonymous", "nonexistent_key");
    expect(val).toBeNull();
  });
});

// ---- API Keys ----

describe("API Keys", () => {
  async function hashKey(raw: string): Promise<string> {
    const encoded = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function createTestKey(identity: string, title: string, scope: string) {
    const rawKey = "sk_" + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 7);
    const key = await ApiKeyRepository.create(env.DB, { identity, title, keyPrefix, keyHash, scope });
    return { key, rawKey, keyHash };
  }

  it("should create a key and return the raw key starting with sk_", async () => {
    const { key, rawKey } = await createTestKey("anonymous", "Test Key", "create");
    expect(rawKey).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(key.title).toBe("Test Key");
    expect(key.scope).toBe("create");
    expect(key.key_prefix).toBe(rawKey.slice(0, 7));
    expect(key.last_used_at).toBeNull();
  });

  it("should authenticate with a valid raw key", async () => {
    const { rawKey } = await createTestKey("anonymous", "Auth Key", "read");
    const keyHash = await hashKey(rawKey);
    const found = await ApiKeyRepository.findByHash(env.DB, keyHash);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Auth Key");
  });

  it("should reject an invalid key hash", async () => {
    const found = await ApiKeyRepository.findByHash(env.DB, "a".repeat(64));
    expect(found).toBeNull();
  });

  it("should update last_used_at on authentication", async () => {
    const { key } = await createTestKey("anonymous", "Usage Key", "create");
    expect(key.last_used_at).toBeNull();
    await ApiKeyRepository.updateLastUsed(env.DB, key.id);
    const keys = await ApiKeyRepository.list(env.DB, "anonymous");
    expect(keys[0].last_used_at).not.toBeNull();
  });

  it("should list all keys for an identity", async () => {
    await createTestKey("anonymous", "Key A", "create");
    await createTestKey("anonymous", "Key B", "read");
    const keys = await ApiKeyRepository.list(env.DB, "anonymous");
    expect(keys).toHaveLength(2);
    const titles = keys.map((k) => k.title);
    expect(titles).toContain("Key A");
    expect(titles).toContain("Key B");
  });

  it("should not expose the raw key in listed keys", async () => {
    const { rawKey } = await createTestKey("anonymous", "Secret", "create");
    const keys = await ApiKeyRepository.list(env.DB, "anonymous");
    expect(keys[0].key_hash).not.toBe(rawKey);
    expect(keys[0].key_prefix).toHaveLength(7);
  });

  it("should delete a key by id and identity", async () => {
    const { key } = await createTestKey("anonymous", "Deletable", "create");
    const deleted = await ApiKeyRepository.delete(env.DB, "anonymous", key.id);
    expect(deleted).toBe(true);
    const keys = await ApiKeyRepository.list(env.DB, "anonymous");
    expect(keys).toHaveLength(0);
  });

  it("should not delete a key owned by a different identity", async () => {
    const { key } = await createTestKey("user-a@example.com", "Shared Key", "create");
    const deleted = await ApiKeyRepository.delete(env.DB, "user-b@example.com", key.id);
    expect(deleted).toBe(false);
    const keys = await ApiKeyRepository.list(env.DB, "user-a@example.com");
    expect(keys).toHaveLength(1);
  });

  it("should support create,read combined scope", async () => {
    const { key } = await createTestKey("anonymous", "Full Access", "create,read");
    expect(key.scope).toBe("create,read");
  });
});
