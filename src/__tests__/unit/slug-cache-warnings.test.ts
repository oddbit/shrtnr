// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// SlugCache.read turns an unusable cache into a miss so the visitor still
// gets a redirect from D1. The operator must still be able to see it: every
// such redirect costs a D1 query, and nothing else explains that load.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlugCache, resetSlugCacheWarnings } from "../../kv/slug-cache";

function kvAnswering(get: () => Promise<unknown>): KVNamespace {
  return { get } as unknown as KVNamespace;
}

const rejecting = kvAnswering(async () => {
  throw new Error("KV GET failed: 503");
});

let warn: ReturnType<typeof vi.spyOn>;

/** The warnings logged so far, parsed. Each must be one JSON line. */
function warnings(): Record<string, unknown>[] {
  return warn.mock.calls.map((call) => {
    expect(call).toHaveLength(1);
    return JSON.parse(call[0] as string) as Record<string, unknown>;
  });
}

beforeEach(() => {
  resetSlugCacheWarnings();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

describe("SlugCache.read: an unusable cache leaves a trace", () => {
  it("logs the slug and the cause when the read rejects", async () => {
    expect(await SlugCache.read(rejecting, "abc")).toBeNull();
    expect(warnings()).toEqual([expect.objectContaining({ slug: "abc", reason: "read_failed", error: "KV GET failed: 503" })]);
  });

  it("logs an entry of the wrong shape", async () => {
    const kv = kvAnswering(async () => ({ url: 42, disabled_at: null, expires_at: null }));
    expect(await SlugCache.read(kv, "abc")).toBeNull();
    expect(warnings()).toEqual([expect.objectContaining({ slug: "abc", reason: "malformed_entry" })]);
  });

  it("stays quiet on a plain miss", async () => {
    expect(await SlugCache.read(kvAnswering(async () => null), "abc")).toBeNull();
    expect(warnings()).toEqual([]);
  });

  it("stays quiet on a usable entry", async () => {
    const entry = { url: "https://example.com", disabled_at: null, expires_at: null };
    expect(await SlugCache.read(kvAnswering(async () => entry), "abc")).toEqual(entry);
    expect(warnings()).toEqual([]);
  });

  it("stays quiet when no cache is bound", async () => {
    expect(await SlugCache.read(undefined, "abc")).toBeNull();
    expect(warnings()).toEqual([]);
  });

  // An outage fails every redirect's read. One line a minute says so without
  // a log line per visitor.
  it("logs once a minute through an outage and counts what it held back", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    for (let i = 0; i < 500; i++) await SlugCache.read(rejecting, `slug-${i}`);
    expect(warnings()).toHaveLength(1);

    vi.setSystemTime(1_000_000 + 61_000);
    await SlugCache.read(rejecting, "later");
    expect(warnings()).toHaveLength(2);
    expect(warnings()[1]).toEqual(expect.objectContaining({ slug: "later", suppressed: 499 }));
  });
});
