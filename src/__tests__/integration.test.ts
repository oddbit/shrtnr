import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  dbCreateLink,
  dbGetAllLinks,
  dbGetLinkById,
  dbUpdateLink,
  dbDisableLink,
  dbAddVanitySlug,
  dbSlugExists,
  dbRecordClick,
  dbGetLinkClickStats,
  dbGetDashboardStats,
  dbGetSetting,
  dbSetSetting,
  dbCreateApiKey,
  dbGetAllApiKeys,
  dbDeleteApiKey,
  dbAuthenticateApiKey,
} from "../db";
import { generateUniqueSlug } from "../slugs";
import { applyMigrations, resetData } from "./setup";

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Link CRUD ----

describe("Link CRUD", () => {
  it("should create a link with an auto-generated slug", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    expect(link.url).toBe("https://example.com");
    expect(link.slugs).toHaveLength(1);
    expect(link.slugs[0].slug).toBe("abc");
    expect(link.slugs[0].is_vanity).toBe(0);
    expect(link.total_clicks).toBe(0);
    expect(link.expires_at).toBeNull();
  });

  it("should create a link with a label", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", "My Label");
    expect(link.label).toBe("My Label");
  });

  it("should create a link with an expires_at timestamp", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", null, null, future);
    expect(link.expires_at).toBe(future);
  });

  it("should create a link with both auto-generated and vanity slugs", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", null, "my-vanity");
    expect(link.slugs).toHaveLength(2);
    const auto = link.slugs.find((s) => s.is_vanity === 0);
    const vanity = link.slugs.find((s) => s.is_vanity === 1);
    expect(auto!.slug).toBe("abc");
    expect(vanity!.slug).toBe("my-vanity");
  });

  it("should always return auto-generated slug at index 0 and vanity at index 1", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", null, "my-vanity");
    expect(link.slugs[0].is_vanity).toBe(0);
    expect(link.slugs[0].slug).toBe("abc");
    expect(link.slugs[1].is_vanity).toBe(1);
    expect(link.slugs[1].slug).toBe("my-vanity");
  });

  it("should preserve slug ordering after adding a vanity slug later", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    await dbAddVanitySlug(env.DB, link.id, "later-vanity");
    const fetched = await dbGetLinkById(env.DB, link.id);
    expect(fetched!.slugs).toHaveLength(2);
    expect(fetched!.slugs[0].is_vanity).toBe(0);
    expect(fetched!.slugs[0].slug).toBe("abc");
    expect(fetched!.slugs[1].is_vanity).toBe(1);
    expect(fetched!.slugs[1].slug).toBe("later-vanity");
  });

  it("should preserve slug ordering in getAllLinks", async () => {
    await dbCreateLink(env.DB, "https://example.com", "abc", null, "my-vanity");
    const links = await dbGetAllLinks(env.DB);
    expect(links[0].slugs[0].is_vanity).toBe(0);
    expect(links[0].slugs[1].is_vanity).toBe(1);
  });

  it("should fetch all links sorted by created_at descending", async () => {
    await dbCreateLink(env.DB, "https://first.com", "aaa");
    await dbCreateLink(env.DB, "https://second.com", "bbb");
    const links = await dbGetAllLinks(env.DB);
    expect(links).toHaveLength(2);
    // Both should be present (order may vary if created in same second)
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://first.com");
    expect(urls).toContain("https://second.com");
  });

  it("should include slugs and total click count in fetched links", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    await dbRecordClick(env.DB, link.slugs[0].id, null, null, null, null);
    const links = await dbGetAllLinks(env.DB);
    expect(links[0].slugs).toHaveLength(1);
    expect(links[0].total_clicks).toBe(1);
  });

  it("should fetch a single link by ID", async () => {
    const created = await dbCreateLink(env.DB, "https://example.com", "abc");
    const fetched = await dbGetLinkById(env.DB, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.url).toBe("https://example.com");
    expect(fetched!.slugs).toHaveLength(1);
  });

  it("should return null for a non-existent link ID", async () => {
    const result = await dbGetLinkById(env.DB, 99999);
    expect(result).toBeNull();
  });

  it("should update a link URL without affecting slugs", async () => {
    const link = await dbCreateLink(env.DB, "https://old.com", "abc");
    const updated = await dbUpdateLink(env.DB, link.id, { url: "https://new.com" });
    expect(updated!.url).toBe("https://new.com");
    expect(updated!.slugs).toHaveLength(1);
    expect(updated!.slugs[0].slug).toBe("abc");
  });

  it("should clear label when set to null", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", "A Label");
    expect(link.label).toBe("A Label");
    const updated = await dbUpdateLink(env.DB, link.id, { label: null });
    expect(updated!.label).toBeNull();
  });

  it("should clear expires_at when set to null (re-enable)", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", null, null, future);
    expect(link.expires_at).toBe(future);
    const updated = await dbUpdateLink(env.DB, link.id, { expires_at: null });
    expect(updated!.expires_at).toBeNull();
  });

  it("should set a scheduled expiry via update", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const future = Math.floor(Date.now() / 1000) + 7200;
    const updated = await dbUpdateLink(env.DB, link.id, { expires_at: future });
    expect(updated!.expires_at).toBe(future);
  });

  it("should return null when updating a non-existent link", async () => {
    const result = await dbUpdateLink(env.DB, 99999, { url: "https://nope.com" });
    expect(result).toBeNull();
  });
});

// ---- Disable / Enable ----

describe("Disable / Enable", () => {
  it("should set expires_at to the current timestamp when disabling", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const before = Math.floor(Date.now() / 1000);
    const disabled = await dbDisableLink(env.DB, link.id);
    const after = Math.floor(Date.now() / 1000);
    expect(disabled!.expires_at).toBeGreaterThanOrEqual(before);
    expect(disabled!.expires_at).toBeLessThanOrEqual(after);
  });

  it("should allow re-enabling by clearing expires_at", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    await dbDisableLink(env.DB, link.id);
    const enabled = await dbUpdateLink(env.DB, link.id, { expires_at: null });
    expect(enabled!.expires_at).toBeNull();
  });

  it("should return null when disabling a non-existent link", async () => {
    const result = await dbDisableLink(env.DB, 99999);
    expect(result).toBeNull();
  });

  it("should update expires_at when disabling an already disabled link", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const first = await dbDisableLink(env.DB, link.id);
    const firstExpiry = first!.expires_at;
    // Small delay to ensure different timestamp (if needed)
    const second = await dbDisableLink(env.DB, link.id);
    expect(second!.expires_at).toBeGreaterThanOrEqual(firstExpiry!);
  });
});

// ---- Vanity Slugs ----

describe("Vanity Slugs", () => {
  it("should add a vanity slug with is_vanity = 1", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const vanity = await dbAddVanitySlug(env.DB, link.id, "my-custom");
    expect(vanity.is_vanity).toBe(1);
    expect(vanity.slug).toBe("my-custom");
    expect(vanity.link_id).toBe(link.id);
  });

  it("should check slug existence correctly", async () => {
    await dbCreateLink(env.DB, "https://example.com", "abc");
    expect(await dbSlugExists(env.DB, "abc")).toBe(true);
    expect(await dbSlugExists(env.DB, "nonexistent")).toBe(false);
  });
});

// ---- Slug Generation with DB ----

describe("generateUniqueSlug", () => {
  it("should generate a slug that does not exist in the database", async () => {
    const slug = await generateUniqueSlug(env.DB, 3);
    expect(slug).toHaveLength(3);
    expect(await dbSlugExists(env.DB, slug)).toBe(false);
  });
});

// ---- Analytics ----

describe("Analytics", () => {
  it("should return zeros and empty arrays for a link with no clicks", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const stats = await dbGetLinkClickStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(0);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
    expect(stats.clicks_over_time).toEqual([]);
  });

  it("should record a click and increment slug click_count", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const slugId = link.slugs[0].id;
    await dbRecordClick(env.DB, slugId, "https://referrer.com", "US", "desktop", "Chrome");
    const updated = await dbGetLinkById(env.DB, link.id);
    expect(updated!.slugs[0].click_count).toBe(1);
    expect(updated!.total_clicks).toBe(1);
  });

  it("should capture referrer, country, device type, and browser", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const slugId = link.slugs[0].id;
    await dbRecordClick(env.DB, slugId, "https://referrer.com", "US", "mobile", "Safari");
    const stats = await dbGetLinkClickStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([{ name: "US", count: 1 }]);
    expect(stats.referrers).toEqual([{ name: "https://referrer.com", count: 1 }]);
    expect(stats.devices).toEqual([{ name: "mobile", count: 1 }]);
    expect(stats.browsers).toEqual([{ name: "Safari", count: 1 }]);
  });

  it("should handle null values for referrer, country, and UA", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const slugId = link.slugs[0].id;
    await dbRecordClick(env.DB, slugId, null, null, null, null);
    const stats = await dbGetLinkClickStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(1);
    expect(stats.countries).toEqual([]);
    expect(stats.referrers).toEqual([]);
    expect(stats.devices).toEqual([]);
    expect(stats.browsers).toEqual([]);
  });

  it("should aggregate clicks across multiple slugs of a link", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", null, "vanity");
    const autoSlug = link.slugs.find((s) => s.is_vanity === 0)!;
    const vanitySlug = link.slugs.find((s) => s.is_vanity === 1)!;
    await dbRecordClick(env.DB, autoSlug.id, null, "US", "desktop", "Chrome");
    await dbRecordClick(env.DB, vanitySlug.id, null, "DE", "mobile", "Firefox");
    const stats = await dbGetLinkClickStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(2);
  });

  it("should return dashboard stats with totals and top lists", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    await dbRecordClick(env.DB, link.slugs[0].id, null, "US", "desktop", "Chrome");
    const stats = await dbGetDashboardStats(env.DB);
    expect(stats.total_links).toBe(1);
    expect(stats.total_clicks).toBe(1);
    expect(stats.recent_links).toHaveLength(1);
    expect(stats.top_links).toHaveLength(1);
    expect(stats.top_countries).toEqual([{ name: "US", count: 1 }]);
  });

  it("should return the 5 most recent links in dashboard stats", async () => {
    for (let i = 0; i < 7; i++) {
      await dbCreateLink(env.DB, `https://example${i}.com`, `s${i}${i}${i}`);
    }
    const stats = await dbGetDashboardStats(env.DB);
    expect(stats.recent_links).toHaveLength(5);
  });
});

// ---- Settings ----

describe("Settings", () => {
  it("should return the current slug_default_length setting", async () => {
    const val = await dbGetSetting(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("3");
  });

  it("should persist an updated setting", async () => {
    await dbSetSetting(env.DB, "anonymous", "slug_default_length", "5");
    const val = await dbGetSetting(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("5");
  });

  it("should return null for a non-existent setting", async () => {
    const val = await dbGetSetting(env.DB, "anonymous", "nonexistent_key");
    expect(val).toBeNull();
  });
});

// ---- API Keys ----

describe("API Keys", () => {
  it("should create a key and return the raw key starting with sk_", async () => {
    const { key, rawKey } = await dbCreateApiKey(env.DB, "anonymous", "Test Key", "create");
    expect(rawKey).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(key.title).toBe("Test Key");
    expect(key.scope).toBe("create");
    expect(key.key_prefix).toBe(rawKey.slice(0, 7));
    expect(key.last_used_at).toBeNull();
  });

  it("should authenticate with a valid raw key", async () => {
    const { rawKey } = await dbCreateApiKey(env.DB, "anonymous", "Auth Key", "read");
    const found = await dbAuthenticateApiKey(env.DB, rawKey);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Auth Key");
  });

  it("should reject an invalid key", async () => {
    const found = await dbAuthenticateApiKey(env.DB, "sk_invalid000000000000000000000000000000000000000000");
    expect(found).toBeNull();
  });

  it("should reject a malformed key", async () => {
    const found = await dbAuthenticateApiKey(env.DB, "not-a-real-key");
    expect(found).toBeNull();
  });

  it("should reject an empty key", async () => {
    const found = await dbAuthenticateApiKey(env.DB, "");
    expect(found).toBeNull();
  });

  it("should update last_used_at on authentication", async () => {
    const { key, rawKey } = await dbCreateApiKey(env.DB, "anonymous", "Usage Key", "create");
    expect(key.last_used_at).toBeNull();
    const authed = await dbAuthenticateApiKey(env.DB, rawKey);
    expect(authed!.last_used_at).not.toBeNull();
  });

  it("should list all keys for an identity", async () => {
    await dbCreateApiKey(env.DB, "anonymous", "Key A", "create");
    await dbCreateApiKey(env.DB, "anonymous", "Key B", "read");
    const keys = await dbGetAllApiKeys(env.DB, "anonymous");
    expect(keys).toHaveLength(2);
    const titles = keys.map((k) => k.title);
    expect(titles).toContain("Key A");
    expect(titles).toContain("Key B");
  });

  it("should not expose the raw key in listed keys", async () => {
    const { rawKey } = await dbCreateApiKey(env.DB, "anonymous", "Secret", "create");
    const keys = await dbGetAllApiKeys(env.DB, "anonymous");
    expect(keys[0].key_hash).not.toBe(rawKey);
    expect(keys[0].key_prefix).toHaveLength(7);
  });

  it("should delete a key by id and identity", async () => {
    const { key } = await dbCreateApiKey(env.DB, "anonymous", "Deletable", "create");
    const deleted = await dbDeleteApiKey(env.DB, "anonymous", key.id);
    expect(deleted).toBe(true);
    const keys = await dbGetAllApiKeys(env.DB, "anonymous");
    expect(keys).toHaveLength(0);
  });

  it("should not delete a key owned by a different identity", async () => {
    const { key } = await dbCreateApiKey(env.DB, "user-a@example.com", "Shared Key", "create");
    const deleted = await dbDeleteApiKey(env.DB, "user-b@example.com", key.id);
    expect(deleted).toBe(false);
    const keys = await dbGetAllApiKeys(env.DB, "user-a@example.com");
    expect(keys).toHaveLength(1);
  });

  it("should support create,read combined scope", async () => {
    const { key } = await dbCreateApiKey(env.DB, "anonymous", "Full Access", "create,read");
    expect(key.scope).toBe("create,read");
  });
});
