// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Link, Slug, LinkWithSlugs, ClickStats, DashboardStats } from "./types";

export async function findSlugByValue(db: D1Database, slug: string): Promise<(Slug & { url: string; expires_at: number | null }) | null> {
  const result = await db
    .prepare(
      "SELECT s.*, l.url, l.expires_at FROM slugs s JOIN links l ON s.link_id = l.id WHERE s.slug = ?"
    )
    .bind(slug)
    .first<Slug & { url: string; expires_at: number | null }>();
  return result;
}

export async function getAllLinks(db: D1Database): Promise<LinkWithSlugs[]> {
  const links = await db
    .prepare("SELECT * FROM links ORDER BY created_at DESC")
    .all<Link>();
  const slugs = await db
    .prepare("SELECT * FROM slugs ORDER BY is_vanity ASC, created_at ASC")
    .all<Slug>();

  return (links.results ?? []).map((link) => {
    const linkSlugs = (slugs.results ?? []).filter((s) => s.link_id === link.id);
    return {
      ...link,
      slugs: linkSlugs,
      total_clicks: linkSlugs.reduce((sum, s) => sum + s.click_count, 0),
    };
  });
}

export async function getLinkById(db: D1Database, id: number): Promise<LinkWithSlugs | null> {
  const link = await db
    .prepare("SELECT * FROM links WHERE id = ?")
    .bind(id)
    .first<Link>();
  if (!link) return null;

  const slugs = await db
    .prepare("SELECT * FROM slugs WHERE link_id = ? ORDER BY is_vanity ASC, created_at ASC")
    .bind(id)
    .all<Slug>();

  const linkSlugs = slugs.results ?? [];
  return {
    ...link,
    slugs: linkSlugs,
    total_clicks: linkSlugs.reduce((sum, s) => sum + s.click_count, 0),
  };
}

export async function createLink(
  db: D1Database,
  url: string,
  slug: string,
  label?: string | null,
  vanitySlug?: string | null,
  expiresAt?: number | null,
  createdVia?: string | null,
  createdBy?: string | null,
): Promise<LinkWithSlugs> {
  const now = Math.floor(Date.now() / 1000);

  const linkResult = await db
    .prepare("INSERT INTO links (url, label, created_at, expires_at, created_via, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(url, label ?? null, now, expiresAt ?? null, createdVia ?? "app", createdBy ?? "anonymous")
    .run();

  const linkId = linkResult.meta.last_row_id as number;

  await db
    .prepare("INSERT INTO slugs (link_id, slug, is_vanity, click_count, created_at) VALUES (?, ?, 0, 0, ?)")
    .bind(linkId, slug, now)
    .run();

  if (vanitySlug) {
    await db
      .prepare("INSERT INTO slugs (link_id, slug, is_vanity, click_count, created_at) VALUES (?, ?, 1, 0, ?)")
      .bind(linkId, vanitySlug, now)
      .run();
  }

  return (await getLinkById(db, linkId))!;
}

export async function updateLink(
  db: D1Database,
  id: number,
  updates: { url?: string; label?: string | null; expires_at?: number | null }
): Promise<LinkWithSlugs | null> {
  const link = await db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<Link>();
  if (!link) return null;

  const url = updates.url ?? link.url;
  const label = updates.label !== undefined ? updates.label : link.label;
  const expiresAt = updates.expires_at !== undefined ? updates.expires_at : link.expires_at;

  await db
    .prepare("UPDATE links SET url = ?, label = ?, expires_at = ? WHERE id = ?")
    .bind(url, label, expiresAt, id)
    .run();

  return getLinkById(db, id);
}

export async function disableLink(db: D1Database, id: number): Promise<LinkWithSlugs | null> {
  const link = await db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<Link>();
  if (!link) return null;
  const now = Math.floor(Date.now() / 1000);
  await db.prepare("UPDATE links SET expires_at = ? WHERE id = ?").bind(now, id).run();
  return getLinkById(db, id);
}

export async function addVanitySlug(db: D1Database, linkId: number, slug: string): Promise<Slug> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO slugs (link_id, slug, is_vanity, click_count, created_at) VALUES (?, ?, 1, 0, ?)")
    .bind(linkId, slug, now)
    .run();

  return (await db
    .prepare("SELECT * FROM slugs WHERE link_id = ? AND slug = ?")
    .bind(linkId, slug)
    .first<Slug>())!;
}

export async function slugExists(db: D1Database, slug: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM slugs WHERE slug = ?")
    .bind(slug)
    .first();
  return row !== null;
}

export async function getSetting(db: D1Database, identity: string, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE identity = ? AND key = ?")
    .bind(identity, key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(db: D1Database, identity: string, key: string, value: string): Promise<void> {
  await db
    .prepare("INSERT INTO settings (identity, key, value) VALUES (?, ?, ?) ON CONFLICT(identity, key) DO UPDATE SET value = ?")
    .bind(identity, key, value, value)
    .run();
}

// --- API Keys ---

export interface ApiKeyRow {
  id: number;
  title: string;
  key_prefix: string;
  key_hash: string;
  scope: string;
  created_at: number;
  last_used_at: number | null;
}

async function hashKey(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createApiKey(
  db: D1Database,
  identity: string,
  title: string,
  scope: string,
): Promise<{ key: ApiKeyRow; rawKey: string }> {
  const rawKey = "sk_" + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 7);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare("INSERT INTO api_keys (identity, title, key_prefix, key_hash, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(identity, title, keyPrefix, keyHash, scope, now)
    .run();

  const row = await db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .bind(keyHash)
    .first<ApiKeyRow>();

  return { key: row!, rawKey };
}

export async function getAllApiKeys(db: D1Database, identity: string): Promise<ApiKeyRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM api_keys WHERE identity = ? ORDER BY created_at DESC")
    .bind(identity)
    .all<ApiKeyRow>();
  return results ?? [];
}

export async function deleteApiKey(db: D1Database, identity: string, id: number): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM api_keys WHERE id = ? AND identity = ?")
    .bind(id, identity)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function authenticateApiKey(db: D1Database, rawKey: string): Promise<ApiKeyRow | null> {
  const keyHash = await hashKey(rawKey);
  const row = await db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .bind(keyHash)
    .first<ApiKeyRow>();
  if (!row) return null;

  // Update last_used_at and return the updated row
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
    .bind(now, row.id)
    .run();

  row.last_used_at = now;
  return row;
}

// --- Click analytics ---

export async function recordClick(
  db: D1Database,
  slugId: number,
  referrer: string | null,
  country: string | null,
  deviceType: string | null,
  browser: string | null,
  channel?: string | null
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    db
      .prepare("INSERT INTO clicks (slug_id, clicked_at, referrer, country, device_type, browser, channel) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(slugId, now, referrer, country, deviceType, browser, channel ?? "direct")
      .run(),
    db
      .prepare("UPDATE slugs SET click_count = click_count + 1 WHERE id = ?")
      .bind(slugId)
      .run(),
  ]);
}

export async function getLinkClickStats(db: D1Database, linkId: number): Promise<ClickStats> {
  const slugIds = await db
    .prepare("SELECT id FROM slugs WHERE link_id = ?")
    .bind(linkId)
    .all<{ id: number }>();
  const ids = (slugIds.results ?? []).map((r) => r.id);

  if (ids.length === 0) {
    return { total_clicks: 0, countries: [], referrers: [], devices: [], browsers: [], channels: [], clicks_over_time: [] };
  }

  const placeholders = ids.map(() => "?").join(",");

  const [totalRow, countries, referrers, devices, browsers, channels, timeline] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE slug_id IN (${placeholders})`).bind(...ids).first<{ cnt: number }>(),
    db.prepare(`SELECT country as name, COUNT(*) as count FROM clicks WHERE slug_id IN (${placeholders}) AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10`).bind(...ids).all<{ name: string; count: number }>(),
    db.prepare(`SELECT referrer as name, COUNT(*) as count FROM clicks WHERE slug_id IN (${placeholders}) AND referrer IS NOT NULL GROUP BY referrer ORDER BY count DESC LIMIT 10`).bind(...ids).all<{ name: string; count: number }>(),
    db.prepare(`SELECT device_type as name, COUNT(*) as count FROM clicks WHERE slug_id IN (${placeholders}) AND device_type IS NOT NULL GROUP BY device_type ORDER BY count DESC`).bind(...ids).all<{ name: string; count: number }>(),
    db.prepare(`SELECT browser as name, COUNT(*) as count FROM clicks WHERE slug_id IN (${placeholders}) AND browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT 10`).bind(...ids).all<{ name: string; count: number }>(),
    db.prepare(`SELECT channel as name, COUNT(*) as count FROM clicks WHERE slug_id IN (${placeholders}) GROUP BY channel ORDER BY count DESC`).bind(...ids).all<{ name: string; count: number }>(),
    db.prepare(`SELECT date(clicked_at, 'unixepoch') as date, COUNT(*) as count FROM clicks WHERE slug_id IN (${placeholders}) GROUP BY date ORDER BY date DESC LIMIT 30`).bind(...ids).all<{ date: string; count: number }>(),
  ]);

  return {
    total_clicks: totalRow?.cnt ?? 0,
    countries: countries.results ?? [],
    referrers: referrers.results ?? [],
    devices: devices.results ?? [],
    browsers: browsers.results ?? [],
    channels: channels.results ?? [],
    clicks_over_time: (timeline.results ?? []).reverse(),
  };
}

export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const [linkCount, clickCount, recentLinks, topCountries, topReferrers] = await Promise.all([
    db.prepare("SELECT COUNT(*) as cnt FROM links").first<{ cnt: number }>(),
    db.prepare("SELECT COUNT(*) as cnt FROM clicks").first<{ cnt: number }>(),
    getAllLinks(db),
    db.prepare("SELECT country as name, COUNT(*) as count FROM clicks WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 5").all<{ name: string; count: number }>(),
    db.prepare("SELECT referrer as name, COUNT(*) as count FROM clicks WHERE referrer IS NOT NULL GROUP BY referrer ORDER BY count DESC LIMIT 5").all<{ name: string; count: number }>(),
  ]);

  const sorted = [...recentLinks].sort((a, b) => b.total_clicks - a.total_clicks);

  return {
    total_links: linkCount?.cnt ?? 0,
    total_clicks: clickCount?.cnt ?? 0,
    recent_links: recentLinks.slice(0, 5),
    top_links: sorted.slice(0, 5),
    top_countries: topCountries.results ?? [],
    top_referrers: topReferrers.results ?? [],
  };
}
