// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { listRecent, recordRecent, clearRecent, type RecentLink } from "../src/recent";
import { RECENT_LIMIT } from "../src/constants";

// setup.ts mocks only chrome.storage.sync. Recent links live in
// chrome.storage.local, so each test installs an in-memory local area.
let local: Record<string, unknown>;

function installLocalArea(): void {
  local = {};
  (chrome.storage as unknown as Record<string, unknown>).local = {
    get: vi.fn(async (key: string) => (key in local ? { [key]: local[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(local, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete local[key];
    }),
  };
}

function entry(id: number, slug = `s${id}`): RecentLink {
  return { id, slug, shortUrl: `https://x.com/${slug}`, url: `https://example.com/${id}`, createdAt: id };
}

describe("recent", () => {
  beforeEach(() => {
    installLocalArea();
  });

  it("returns an empty list when nothing is stored", async () => {
    expect(await listRecent()).toEqual([]);
  });

  it("puts the newest entry first", async () => {
    await recordRecent(entry(1));
    const list = await recordRecent(entry(2));
    expect(list.map((l) => l.id)).toEqual([2, 1]);
    expect(await listRecent()).toEqual(list);
  });

  it("replaces an earlier entry for the same link instead of duplicating it", async () => {
    await recordRecent(entry(1, "abc"));
    await recordRecent(entry(2));
    const list = await recordRecent(entry(1, "custom"));
    expect(list.map((l) => l.slug)).toEqual(["custom", "s2"]);
  });

  it("keeps at most RECENT_LIMIT entries", async () => {
    for (let i = 1; i <= RECENT_LIMIT + 3; i++) await recordRecent(entry(i));
    const list = await listRecent();
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]?.id).toBe(RECENT_LIMIT + 3);
  });

  it("drops malformed stored entries", async () => {
    local.recent = [entry(1), { id: "x" }, null, "junk"];
    expect(await listRecent()).toEqual([entry(1)]);
  });

  it("clearRecent empties the list", async () => {
    await recordRecent(entry(1));
    await clearRecent();
    expect(await listRecent()).toEqual([]);
  });

  it("stores nothing in the synced area", async () => {
    await recordRecent(entry(1));
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it("returns an empty list when the local area is unavailable", async () => {
    delete (chrome.storage as unknown as Record<string, unknown>).local;
    expect(await listRecent()).toEqual([]);
    expect(await recordRecent(entry(1))).toEqual([]);
    await expect(clearRecent()).resolves.toBeUndefined();
  });

  it("keeps the stored list when the write fails", async () => {
    await recordRecent(entry(1));
    (chrome.storage as unknown as { local: { set: unknown } }).local.set = vi.fn(async () => {
      throw new Error("quota exceeded");
    });
    // A rejected write must not blank a list the popup is already showing.
    expect(await recordRecent(entry(2))).toEqual([entry(1)]);
  });

  it("swallows a storage failure instead of throwing", async () => {
    (chrome.storage as unknown as { local: { get: unknown } }).local.get = vi.fn(async () => {
      throw new Error("storage unavailable");
    });
    expect(await listRecent()).toEqual([]);
  });
});
