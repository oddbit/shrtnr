// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export interface SlugCacheEntry {
  url: string;
  disabled_at: number | null;
  expires_at: number | null;
}

export class SlugCache {
  static async get(kv: KVNamespace | undefined, slug: string): Promise<SlugCacheEntry | null> {
    if (!kv) return null;
    return kv.get<SlugCacheEntry>(slug, "json");
  }

  /**
   * The cached entry, or null for anything short of a usable one: a miss, a
   * read that rejects, a value that is not JSON, a value of the wrong shape.
   * D1 holds the truth, so the redirect path treats every one of those as a
   * miss and looks the slug up there instead of failing the visitor.
   */
  static async read(kv: KVNamespace | undefined, slug: string): Promise<SlugCacheEntry | null> {
    let entry: unknown;
    try {
      entry = await SlugCache.get(kv, slug);
    } catch {
      return null;
    }
    if (typeof entry !== "object" || entry === null) return null;
    const { url, disabled_at, expires_at } = entry as Record<string, unknown>;
    if (typeof url !== "string") return null;
    if (disabled_at != null && typeof disabled_at !== "number") return null;
    if (expires_at != null && typeof expires_at !== "number") return null;
    return { url, disabled_at: disabled_at ?? null, expires_at: expires_at ?? null };
  }

  static async put(kv: KVNamespace | undefined, slug: string, entry: SlugCacheEntry): Promise<void> {
    if (!kv) return;
    await kv.put(slug, JSON.stringify(entry));
  }

  static async delete(kv: KVNamespace | undefined, slug: string): Promise<void> {
    if (!kv) return;
    await kv.delete(slug);
  }
}
