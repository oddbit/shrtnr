// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Link, Slug, LinkWithSlugs } from "../types";
import { SlugClickCountOptions, slugClickCountSql } from "./filters";

/**
 * Options that scope per-slug click counts. Repository methods that return
 * objects with a `click_count` field accept these and forward them into the
 * SLUG_SELECT subquery so callers can render filtered or range-bounded
 * numbers without a second query.
 *
 * Default (no options) preserves the historical raw lifetime semantics, which
 * is what callers like deletion guards or redirect lookups need.
 */
export type LinkRepoOptions = SlugClickCountOptions;

function slugSelect(opts?: LinkRepoOptions): string {
  return `s.*, ${slugClickCountSql(opts)}`;
}

function assembleLink(link: Link, slugs: Slug[]): LinkWithSlugs {
  return {
    ...link,
    slugs,
    total_clicks: slugs.reduce((sum, s) => sum + s.click_count, 0),
  };
}

export class LinkRepository {
  static async list(db: D1Database, opts?: LinkRepoOptions): Promise<LinkWithSlugs[]> {
    const links = await db.prepare("SELECT * FROM links ORDER BY created_at DESC").all<Link>();
    const slugs = await db.prepare(`SELECT ${slugSelect(opts)} FROM slugs s ORDER BY is_custom ASC, created_at ASC`).all<Slug>();

    return (links.results ?? []).map((link) => {
      const linkSlugs = (slugs.results ?? []).filter((s) => s.link_id === link.id);
      return assembleLink(link, linkSlugs);
    });
  }

  /**
   * The `limit` most recent links by created_at, with their slugs and total
   * clicks. Two queries regardless of catalog size: one for the bounded link
   * page, one for the slugs of only those ids. Slugs bucket into a Map keyed
   * by link_id so assembly stays O(links + slugs), unlike `list()` which
   * re-filters the full slug set per link. Use this for dashboard panels that
   * need a small recent window without paying to load the whole catalog.
   */
  static async recent(db: D1Database, limit: number, opts?: LinkRepoOptions): Promise<LinkWithSlugs[]> {
    // SQLite treats a negative LIMIT as "no limit", so a non-positive value
    // must short-circuit rather than reach SQL and return the whole table.
    if (limit <= 0) return [];
    // created_at is second-granularity, so tie-break on id to keep the recent
    // window stable across calls when several links share a timestamp.
    const links = await db
      .prepare("SELECT * FROM links ORDER BY created_at DESC, id DESC LIMIT ?")
      .bind(limit)
      .all<Link>();
    const rows = links.results ?? [];
    if (rows.length === 0) return [];

    const ids = rows.map((l) => l.id);
    const placeholders = ids.map(() => "?").join(",");
    const slugs = await db
      .prepare(
        `SELECT ${slugSelect(opts)} FROM slugs s WHERE s.link_id IN (${placeholders}) ORDER BY is_custom ASC, created_at ASC`,
      )
      .bind(...ids)
      .all<Slug>();

    const byLink = new Map<number, Slug[]>();
    for (const s of slugs.results ?? []) {
      const arr = byLink.get(s.link_id);
      if (arr) arr.push(s);
      else byLink.set(s.link_id, [s]);
    }

    return rows.map((link) => assembleLink(link, byLink.get(link.id) ?? []));
  }

  static async getById(db: D1Database, id: number, opts?: LinkRepoOptions): Promise<LinkWithSlugs | null> {
    const link = await db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<Link>();
    if (!link) return null;

    const slugs = await db
      .prepare(`SELECT ${slugSelect(opts)} FROM slugs s WHERE link_id = ? ORDER BY is_custom ASC, created_at ASC`)
      .bind(id)
      .all<Slug>();

    return assembleLink(link, slugs.results ?? []);
  }

  static async getBySlug(db: D1Database, slug: string, opts?: LinkRepoOptions): Promise<LinkWithSlugs | null> {
    const row = await db
      .prepare("SELECT link_id FROM slugs WHERE slug = ?")
      .bind(slug)
      .first<{ link_id: number }>();
    if (!row) return null;
    return LinkRepository.getById(db, row.link_id, opts);
  }

  static async findByUrl(db: D1Database, url: string, opts?: LinkRepoOptions): Promise<LinkWithSlugs[]> {
    const rows = await db
      .prepare("SELECT id FROM links WHERE url = ? ORDER BY created_at DESC")
      .bind(url)
      .all<{ id: number }>();

    const ids = rows.results ?? [];
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map(({ id }) => LinkRepository.getById(db, id, opts)));
    return results.filter((l): l is LinkWithSlugs => l !== null);
  }

  static async create(
    db: D1Database,
    data: {
      url: string;
      slug: string;
      label?: string | null;
      expiresAt?: number | null;
      createdVia?: string | null;
      createdBy?: string | null;
    },
  ): Promise<LinkWithSlugs> {
    const now = Math.floor(Date.now() / 1000);

    // Both inserts run inside a single D1 batch so a failed slug insert
    // (e.g. UNIQUE collision from a concurrent create) rolls back the link
    // row instead of leaving an orphan with no auto-generated slug.
    const [linkResult] = await db.batch([
      db
        .prepare("INSERT INTO links (url, label, created_at, expires_at, created_via, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(data.url, data.label ?? null, now, data.expiresAt ?? null, data.createdVia ?? "app", data.createdBy ?? "anonymous"),
      db
        .prepare("INSERT INTO slugs (link_id, slug, is_custom, is_primary, created_at) VALUES (last_insert_rowid(), ?, 0, 1, ?)")
        .bind(data.slug, now),
    ]);

    const linkId = linkResult.meta.last_row_id as number;

    return (await LinkRepository.getById(db, linkId))!;
  }

  static async update(
    db: D1Database,
    id: number,
    updates: { url?: string; label?: string | null; expires_at?: number | null },
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

    return LinkRepository.getById(db, id);
  }

  static async disable(db: D1Database, id: number): Promise<LinkWithSlugs | null> {
    const link = await db.prepare("SELECT id FROM links WHERE id = ?").bind(id).first<{ id: number }>();
    if (!link) return null;
    const now = Math.floor(Date.now() / 1000);
    await db.prepare("UPDATE links SET expires_at = ? WHERE id = ?").bind(now, id).run();
    return LinkRepository.getById(db, id);
  }

  static async enable(db: D1Database, id: number): Promise<LinkWithSlugs | null> {
    const link = await db.prepare("SELECT id FROM links WHERE id = ?").bind(id).first<{ id: number }>();
    if (!link) return null;
    await db.prepare("UPDATE links SET expires_at = NULL WHERE id = ?").bind(id).run();
    return LinkRepository.getById(db, id);
  }

  static async exists(db: D1Database, id: number): Promise<boolean> {
    const row = await db.prepare("SELECT 1 FROM links WHERE id = ?").bind(id).first();
    return row !== null;
  }

  static async delete(db: D1Database, id: number): Promise<string[] | false> {
    // Lifetime guard: a link with any historical clicks (bots, self-referrers,
    // or real users) is preserved so analytics history is not silently dropped.
    // This pre-read only short-circuits the obvious cases; the authoritative
    // guard is the NOT EXISTS inside the transactional batch below, evaluated
    // atomically with the deletes, so a click recorded after this read cannot
    // be deleted along with the link.
    const link = await LinkRepository.getById(db, id);
    if (!link) return false;
    if (link.total_clicks > 0) return false;

    // One transaction: the SELECT captures the slug set at delete time for
    // KV eviction, the links DELETE re-checks the click guard atomically,
    // and the slugs DELETE only fires once the links row is actually gone.
    // No clicks DELETE: when the guard passes there are zero joined click
    // rows inside this transaction, so it could never match anything.
    const [slugRows, linkDelete] = await db.batch([
      db.prepare("SELECT slug FROM slugs WHERE link_id = ?").bind(id),
      db
        .prepare(
          `DELETE FROM links WHERE id = ?
             AND NOT EXISTS (SELECT 1 FROM clicks c JOIN slugs s ON s.slug = c.slug WHERE s.link_id = ?)`,
        )
        .bind(id, id),
      db
        .prepare("DELETE FROM slugs WHERE link_id = ? AND NOT EXISTS (SELECT 1 FROM links WHERE id = ?)")
        .bind(id, id),
    ]);

    if ((linkDelete.meta.changes ?? 0) === 0) return false;
    return ((slugRows.results ?? []) as { slug: string }[]).map((r) => r.slug);
  }

  static async search(
    db: D1Database,
    query: string,
    opts?: LinkRepoOptions & { includeOwner?: boolean },
  ): Promise<LinkWithSlugs[]> {
    if (!query.trim()) return [];

    // Escape SQLite LIKE metacharacters so a user query of "_" or "50%" is
    // treated as a literal string, not a wildcard pattern.
    const escaped = query.trim().toLowerCase()
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;

    const where = opts?.includeOwner
      ? "lower(l.label) LIKE ? ESCAPE '\\' OR lower(s.slug) LIKE ? ESCAPE '\\' OR lower(l.url) LIKE ? ESCAPE '\\' OR lower(l.created_by) LIKE ? ESCAPE '\\'"
      : "lower(l.label) LIKE ? ESCAPE '\\' OR lower(s.slug) LIKE ? ESCAPE '\\' OR lower(l.url) LIKE ? ESCAPE '\\'";

    const binds = opts?.includeOwner
      ? [pattern, pattern, pattern, pattern]
      : [pattern, pattern, pattern];

    const matched = await db
      .prepare(
        `SELECT DISTINCT l.id FROM links l
         LEFT JOIN slugs s ON s.link_id = l.id
         WHERE ${where}
         ORDER BY l.created_at DESC`,
      )
      .bind(...binds)
      .all<{ id: number }>();

    const ids = matched.results ?? [];
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map(({ id }) => LinkRepository.getById(db, id, opts)));
    return results.filter((l): l is LinkWithSlugs => l !== null);
  }

  static async findByOwner(db: D1Database, owner: string, opts?: LinkRepoOptions): Promise<LinkWithSlugs[]> {
    const rows = await db
      .prepare("SELECT id FROM links WHERE created_by = ? ORDER BY created_at DESC")
      .bind(owner)
      .all<{ id: number }>();

    const ids = rows.results ?? [];
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map(({ id }) => LinkRepository.getById(db, id, opts)));
    return results.filter((l): l is LinkWithSlugs => l !== null);
  }

  /**
   * Batch-resolve the display slug for a set of link ids in one query. Picks
   * the primary slug per link the way the dashboard does: the first
   * auto-generated (non-custom) slug, falling back to the first slug of any
   * kind. Mirrors the `is_custom ASC, created_at ASC` ordering the slug loaders
   * use, so the pick matches recent-links exactly. Returns a Map keyed by
   * link_id; ids with no slug are absent.
   */
  static async primarySlugByIds(db: D1Database, ids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT link_id, slug FROM slugs WHERE link_id IN (${placeholders})
         ORDER BY is_custom ASC, created_at ASC`,
      )
      .bind(...ids)
      .all<{ link_id: number; slug: string }>();
    for (const r of rows.results ?? []) {
      if (!out.has(r.link_id)) out.set(r.link_id, r.slug); // first per link = primary
    }
    return out;
  }
}
