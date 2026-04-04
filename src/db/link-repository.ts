// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Link, Slug, LinkWithSlugs } from "../types";

function assembleLink(link: Link, slugs: Slug[]): LinkWithSlugs {
  return {
    ...link,
    slugs,
    total_clicks: slugs.reduce((sum, s) => sum + s.click_count, 0),
  };
}

export class LinkRepository {
  static async list(db: D1Database): Promise<LinkWithSlugs[]> {
    const links = await db.prepare("SELECT * FROM links ORDER BY created_at DESC").all<Link>();
    const slugs = await db.prepare("SELECT * FROM slugs ORDER BY is_vanity ASC, created_at ASC").all<Slug>();

    return (links.results ?? []).map((link) => {
      const linkSlugs = (slugs.results ?? []).filter((s) => s.link_id === link.id);
      return assembleLink(link, linkSlugs);
    });
  }

  static async getById(db: D1Database, id: number): Promise<LinkWithSlugs | null> {
    const link = await db.prepare("SELECT * FROM links WHERE id = ?").bind(id).first<Link>();
    if (!link) return null;

    const slugs = await db
      .prepare("SELECT * FROM slugs WHERE link_id = ? ORDER BY is_vanity ASC, created_at ASC")
      .bind(id)
      .all<Slug>();

    return assembleLink(link, slugs.results ?? []);
  }

  static async getBySlug(db: D1Database, slug: string): Promise<LinkWithSlugs | null> {
    const row = await db
      .prepare("SELECT link_id FROM slugs WHERE slug = ?")
      .bind(slug)
      .first<{ link_id: number }>();
    if (!row) return null;
    return LinkRepository.getById(db, row.link_id);
  }

  static async create(
    db: D1Database,
    data: {
      url: string;
      slug: string;
      label?: string | null;
      vanitySlug?: string | null;
      expiresAt?: number | null;
      createdVia?: string | null;
      createdBy?: string | null;
    },
  ): Promise<LinkWithSlugs> {
    const now = Math.floor(Date.now() / 1000);

    const linkResult = await db
      .prepare("INSERT INTO links (url, label, created_at, expires_at, created_via, created_by) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(data.url, data.label ?? null, now, data.expiresAt ?? null, data.createdVia ?? "app", data.createdBy ?? "anonymous")
      .run();

    const linkId = linkResult.meta.last_row_id as number;

    await db
      .prepare("INSERT INTO slugs (link_id, slug, is_vanity, click_count, created_at) VALUES (?, ?, 0, 0, ?)")
      .bind(linkId, data.slug, now)
      .run();

    if (data.vanitySlug) {
      await db
        .prepare("INSERT INTO slugs (link_id, slug, is_vanity, click_count, created_at) VALUES (?, ?, 1, 0, ?)")
        .bind(linkId, data.vanitySlug, now)
        .run();
    }

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

  static async search(db: D1Database, query: string): Promise<LinkWithSlugs[]> {
    if (!query.trim()) return [];

    const pattern = `%${query.trim().toLowerCase()}%`;

    const matched = await db
      .prepare(
        `SELECT DISTINCT l.id FROM links l
         LEFT JOIN slugs s ON s.link_id = l.id
         WHERE lower(l.label) LIKE ? OR lower(s.slug) LIKE ?
         ORDER BY l.created_at DESC`,
      )
      .bind(pattern, pattern)
      .all<{ id: number }>();

    const ids = matched.results ?? [];
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map(({ id }) => LinkRepository.getById(db, id)));
    return results.filter((l): l is LinkWithSlugs => l !== null);
  }
}
