// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Slug } from "../types";

const SLUG_SELECT = "s.*, (SELECT COUNT(*) FROM clicks c WHERE c.slug_id = s.id) AS click_count";

export class SlugRepository {
  static async findByValue(
    db: D1Database,
    slug: string,
  ): Promise<(Slug & { url: string; expires_at: number | null }) | null> {
    return db
      .prepare(`SELECT ${SLUG_SELECT}, l.url, l.expires_at FROM slugs s JOIN links l ON s.link_id = l.id WHERE s.slug = ?`)
      .bind(slug)
      .first<Slug & { url: string; expires_at: number | null }>();
  }

  static async exists(db: D1Database, slug: string): Promise<boolean> {
    const row = await db.prepare("SELECT 1 FROM slugs WHERE slug = ?").bind(slug).first();
    return row !== null;
  }

  static async addCustom(db: D1Database, linkId: number, slug: string): Promise<Slug> {
    const now = Math.floor(Date.now() / 1000);

    // Check if this is the first custom slug for the link
    const existingCustom = await db
      .prepare("SELECT 1 FROM slugs WHERE link_id = ? AND is_custom = 1")
      .bind(linkId)
      .first();
    const isFirstCustom = !existingCustom;

    await db
      .prepare("INSERT INTO slugs (link_id, slug, is_custom, is_primary, created_at) VALUES (?, ?, 1, ?, ?)")
      .bind(linkId, slug, isFirstCustom ? 1 : 0, now)
      .run();

    // If first custom slug, clear primary from all other slugs on this link
    if (isFirstCustom) {
      await db
        .prepare("UPDATE slugs SET is_primary = 0 WHERE link_id = ? AND slug != ?")
        .bind(linkId, slug)
        .run();
    }

    return (await db
      .prepare(`SELECT ${SLUG_SELECT} FROM slugs s WHERE link_id = ? AND slug = ?`)
      .bind(linkId, slug)
      .first<Slug>())!;
  }

  static async setPrimary(db: D1Database, linkId: number, slugId: number): Promise<void> {
    await db.prepare("UPDATE slugs SET is_primary = 0 WHERE link_id = ?").bind(linkId).run();
    await db.prepare("UPDATE slugs SET is_primary = 1 WHERE id = ? AND link_id = ?").bind(slugId, linkId).run();
  }

  static async disable(db: D1Database, slugId: number): Promise<Slug | null> {
    const now = Math.floor(Date.now() / 1000);
    const slug = await db.prepare(`SELECT ${SLUG_SELECT} FROM slugs s WHERE id = ?`).bind(slugId).first<Slug>();
    if (!slug) return null;

    await db.prepare("UPDATE slugs SET disabled_at = ? WHERE id = ?").bind(now, slugId).run();

    // If disabling the primary, fall back to the random slug
    if (slug.is_primary) {
      await db.prepare("UPDATE slugs SET is_primary = 0 WHERE id = ?").bind(slugId).run();
      await db
        .prepare("UPDATE slugs SET is_primary = 1 WHERE link_id = ? AND is_custom = 0")
        .bind(slug.link_id)
        .run();
    }

    return db.prepare(`SELECT ${SLUG_SELECT} FROM slugs s WHERE id = ?`).bind(slugId).first<Slug>();
  }

  static async enable(db: D1Database, slugId: number): Promise<Slug | null> {
    await db.prepare("UPDATE slugs SET disabled_at = NULL WHERE id = ?").bind(slugId).run();
    return db.prepare(`SELECT ${SLUG_SELECT} FROM slugs s WHERE id = ?`).bind(slugId).first<Slug>();
  }

  static async remove(db: D1Database, slugId: number): Promise<boolean> {
    const slug = await db.prepare(`SELECT ${SLUG_SELECT} FROM slugs s WHERE id = ?`).bind(slugId).first<Slug>();
    if (!slug) return false;

    // Cannot delete random slugs
    if (!slug.is_custom) return false;

    // Cannot delete slugs with clicks
    if (slug.click_count > 0) return false;

    // If removing the primary, fall back to random slug first
    if (slug.is_primary) {
      await db
        .prepare("UPDATE slugs SET is_primary = 1 WHERE link_id = ? AND is_custom = 0")
        .bind(slug.link_id)
        .run();
    }

    await db.prepare("DELETE FROM slugs WHERE id = ?").bind(slugId).run();
    return true;
  }
}
