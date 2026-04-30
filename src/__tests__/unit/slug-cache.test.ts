// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { SlugCache, type SlugCacheEntry } from "../../kv";

beforeEach(async () => {
  const kv = env.SLUG_KV!;
  const { keys } = await kv.list();
  await Promise.all(keys.map((k) => kv.delete(k.name)));
});

describe("SlugCache", () => {
  const entry: SlugCacheEntry = {
    url: "https://example.com",
    disabled_at: null,
    expires_at: null,
  };

  it("returns null for a missing key", async () => {
    const result = await SlugCache.get(env.SLUG_KV, "nonexistent");
    expect(result).toBeNull();
  });

  it("round-trips a slug entry through put and get", async () => {
    await SlugCache.put(env.SLUG_KV, "abc", entry);
    const result = await SlugCache.get(env.SLUG_KV, "abc");
    expect(result).toEqual(entry);
  });

  it("stores disabled_at and expires_at timestamps", async () => {
    const withTimestamps: SlugCacheEntry = {
      url: "https://example.com",
      disabled_at: 1700000000,
      expires_at: 1800000000,
    };
    await SlugCache.put(env.SLUG_KV, "xyz", withTimestamps);
    const result = await SlugCache.get(env.SLUG_KV, "xyz");
    expect(result).toEqual(withTimestamps);
  });

  it("overwrites an existing entry on put", async () => {
    await SlugCache.put(env.SLUG_KV, "abc", entry);
    const updated: SlugCacheEntry = {
      url: "https://new-url.com",
      disabled_at: null,
      expires_at: null,
    };
    await SlugCache.put(env.SLUG_KV, "abc", updated);
    const result = await SlugCache.get(env.SLUG_KV, "abc");
    expect(result).toEqual(updated);
  });

  it("deletes an entry", async () => {
    await SlugCache.put(env.SLUG_KV, "abc", entry);
    await SlugCache.delete(env.SLUG_KV, "abc");
    const result = await SlugCache.get(env.SLUG_KV, "abc");
    expect(result).toBeNull();
  });

  it("delete on a missing key does not throw", async () => {
    await expect(SlugCache.delete(env.SLUG_KV, "nonexistent")).resolves.toBeUndefined();
  });
});
