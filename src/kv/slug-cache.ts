// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export interface SlugCacheEntry {
  url: string;
  disabled_at: number | null;
  expires_at: number | null;
}

// An unusable cache is invisible to the visitor, so it is logged: one JSON
// line, at most once a minute per isolate. An outage fails the read on every
// redirect, and a line per visitor would bury the log it is meant to inform.
const WARN_INTERVAL_MS = 60_000;
let nextWarnAt = 0;
let suppressed = 0;

function warnUnusable(slug: string, reason: "read_failed" | "malformed_entry", error?: unknown): void {
  const now = Date.now();
  if (now < nextWarnAt) {
    suppressed++;
    return;
  }
  console.warn(
    JSON.stringify({
      message: "Slug cache entry unusable, falling back to D1",
      slug,
      reason,
      ...(error === undefined ? {} : { error: error instanceof Error ? error.message : String(error) }),
      // Unusable reads since the previous line that were not logged.
      suppressed,
    }),
  );
  nextWarnAt = now + WARN_INTERVAL_MS;
  suppressed = 0;
}

/** Test hook: forget when the last warning was logged. */
export function resetSlugCacheWarnings(): void {
  nextWarnAt = 0;
  suppressed = 0;
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
    } catch (error) {
      warnUnusable(slug, "read_failed", error);
      return null;
    }
    if (entry === null || entry === undefined) return null;
    const fields = typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const { url, disabled_at, expires_at } = fields;
    if (
      typeof url !== "string" ||
      (disabled_at != null && typeof disabled_at !== "number") ||
      (expires_at != null && typeof expires_at !== "number")
    ) {
      warnUnusable(slug, "malformed_entry");
      return null;
    }
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
