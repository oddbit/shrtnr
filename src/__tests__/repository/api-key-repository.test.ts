import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { ApiKeyRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

// Helper: insert a key with a pre-computed hash (bypasses service-layer hashing).
async function insertTestKey(identity: string, title: string, scope: string) {
  const rawKey = "sk_" + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const encoded = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const keyHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const keyPrefix = rawKey.slice(0, 7);
  const key = await ApiKeyRepository.create(env.DB, { identity, title, keyPrefix, keyHash, scope });
  return { key, rawKey, keyHash };
}

describe("ApiKeyRepository.create", () => {
  it("inserts a key row and returns it", async () => {
    const { key } = await insertTestKey("test@example.com", "My Key", "create");
    expect(key.title).toBe("My Key");
    expect(key.scope).toBe("create");
    expect(key.identity).toBe("test@example.com");
    expect(key.last_used_at).toBeNull();
  });

  it("stores the prefix and hash without exposing the raw key", async () => {
    const { key, rawKey } = await insertTestKey("test@example.com", "My Key", "create");
    expect(key.key_prefix).toBe(rawKey.slice(0, 7));
    expect(key.key_hash).not.toBe(rawKey);
    expect(key.key_hash).toHaveLength(64);
  });
});

describe("ApiKeyRepository.list", () => {
  it("returns all keys for an identity", async () => {
    await insertTestKey("test@example.com", "Key A", "create");
    await insertTestKey("test@example.com", "Key B", "read");
    const keys = await ApiKeyRepository.list(env.DB, "test@example.com");
    expect(keys).toHaveLength(2);
    const titles = keys.map((k) => k.title);
    expect(titles).toContain("Key A");
    expect(titles).toContain("Key B");
  });

  it("does not return keys owned by another identity", async () => {
    await insertTestKey("user-a@example.com", "Key A", "create");
    const keys = await ApiKeyRepository.list(env.DB, "user-b@example.com");
    expect(keys).toHaveLength(0);
  });
});

describe("ApiKeyRepository.delete", () => {
  it("removes the key by id and identity", async () => {
    const { key } = await insertTestKey("test@example.com", "Deletable", "create");
    const deleted = await ApiKeyRepository.delete(env.DB, "test@example.com", key.id);
    expect(deleted).toBe(true);
    const keys = await ApiKeyRepository.list(env.DB, "test@example.com");
    expect(keys).toHaveLength(0);
  });

  it("returns false when the key belongs to a different identity", async () => {
    const { key } = await insertTestKey("user-a@example.com", "Key", "create");
    const deleted = await ApiKeyRepository.delete(env.DB, "user-b@example.com", key.id);
    expect(deleted).toBe(false);
  });

  it("returns false for a non-existent id", async () => {
    expect(await ApiKeyRepository.delete(env.DB, "test@example.com", 99999)).toBe(false);
  });
});

describe("ApiKeyRepository.findByHash", () => {
  it("returns the key row for a known hash", async () => {
    const { keyHash, key } = await insertTestKey("test@example.com", "Auth Key", "read");
    const found = await ApiKeyRepository.findByHash(env.DB, keyHash);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(key.id);
    expect(found!.title).toBe("Auth Key");
  });

  it("returns null for an unknown hash", async () => {
    expect(await ApiKeyRepository.findByHash(env.DB, "a".repeat(64))).toBeNull();
  });
});

describe("ApiKeyRepository.updateLastUsed", () => {
  it("sets last_used_at on the key row", async () => {
    const { key } = await insertTestKey("test@example.com", "Usage Key", "create");
    expect(key.last_used_at).toBeNull();
    const before = Math.floor(Date.now() / 1000);
    await ApiKeyRepository.updateLastUsed(env.DB, key.id);
    const after = Math.floor(Date.now() / 1000);
    const updated = (await ApiKeyRepository.list(env.DB, "test@example.com"))[0];
    expect(updated.last_used_at).toBeGreaterThanOrEqual(before);
    expect(updated.last_used_at!).toBeLessThanOrEqual(after);
  });
});
