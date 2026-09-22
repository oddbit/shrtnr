// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Recent links shortened from this browser. Kept in chrome.storage.local,
// not sync: it is a convenience cache of the user's own links, and the
// admin dashboard is the record. Every call swallows storage failures so a
// broken cache never blocks the shorten flow.

import { RECENT_LIMIT } from "./constants";

const STORAGE_KEY = "recent";

export type RecentLink = {
  id: number;
  slug: string;
  shortUrl: string;
  url: string;
  createdAt: number;
};

function localArea(): chrome.storage.StorageArea | undefined {
  if (typeof chrome === "undefined") return undefined;
  return chrome.storage?.local;
}

function parseList(raw: unknown): RecentLink[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentLink[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r.id !== "number" ||
      typeof r.slug !== "string" ||
      typeof r.shortUrl !== "string" ||
      typeof r.url !== "string" ||
      typeof r.createdAt !== "number"
    ) {
      continue;
    }
    out.push({ id: r.id, slug: r.slug, shortUrl: r.shortUrl, url: r.url, createdAt: r.createdAt });
  }
  return out;
}

export async function listRecent(): Promise<RecentLink[]> {
  const area = localArea();
  if (!area) return [];
  try {
    const raw = await area.get(STORAGE_KEY);
    return parseList(raw[STORAGE_KEY]);
  } catch {
    return [];
  }
}

/** Puts the entry first, replacing any earlier entry for the same link id. */
export async function recordRecent(entry: RecentLink): Promise<RecentLink[]> {
  const area = localArea();
  if (!area) return [];
  try {
    const current = await listRecent();
    const next = [entry, ...current.filter((l) => l.id !== entry.id)].slice(0, RECENT_LIMIT);
    await area.set({ [STORAGE_KEY]: next });
    return next;
  } catch {
    return [];
  }
}

export async function clearRecent(): Promise<void> {
  const area = localArea();
  if (!area) return;
  try {
    await area.remove(STORAGE_KEY);
  } catch {
    // A failed clear leaves stale entries behind; the next record() replaces them.
  }
}
