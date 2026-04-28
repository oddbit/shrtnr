// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Slug } from "../types";
import { SlugClickCountOptions, slugClickCountSql } from "./filters";

function slugSelect(opts?: SlugClickCountOptions): string {
  return `s.*, ${slugClickCountSql(opts)}`;
}

export class SlugRepository {
  static async findByValue(
    db: D1Database,
    slug: string,
    opts?: SlugClickCountOptions,
  ): Promise<(Slug & { url: string; expires_at: number | null }) | null> {
    return db
      .prepare(`SELECT ${slugSelect(opts)}, l.url, l.expires_at FROM slugs s JOIN links l ON s.link_id = l.id WHERE s.slug = ?`)
      .bind(slug)
      .first<Slug & { url: string; expires_at: number | null }>();
  }

  static async findForRedirect(
    db: D1Database,
    slug: string,
  ): Promise<{ url: string; disabled_at: number | null; expires_at: number | null } | null> {
    return db
      .prepare("SELECT s.disabled_at, l.url, l.expires_at FROM slugs s JOIN links l ON s.link_id = l.id WHERE s.slug = ?")
      .bind(slug)
      .first<{ url: string; disabled_at: number | null; expires_at: number | null }>();
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
      .prepare(`SELECT ${slugSelect()} FROM slugs s WHERE link_id = ? AND slug = ?`)
      .bind(linkId, slug)
      .first<Slug>())!;
  }

  static async setPrimary(db: D1Database, linkId: number, slug: string): Promise<void> {
    await db.prepare("UPDATE slugs SET is_primary = 0 WHERE link_id = ?").bind(linkId).run();
    await db.prepare("UPDATE slugs SET is_primary = 1 WHERE slug = ? AND link_id = ?").bind(slug, linkId).run();
  }

  static async disable(db: D1Database, slug: string): Promise<Slug | null> {
    const now = Math.floor(Date.now() / 1000);
    const row = await db.prepare(`SELECT ${slugSelect()} FROM slugs s WHERE slug = ?`).bind(slug).first<Slug>();
    if (!row) return null;

    await db.prepare("UPDATE slugs SET disabled_at = ? WHERE slug = ?").bind(now, slug).run();

    // If disabling the primary, fall back to the random slug
    if (row.is_primary) {
      await db.prepare("UPDATE slugs SET is_primary = 0 WHERE slug = ?").bind(slug).run();
      await db
        .prepare("UPDATE slugs SET is_primary = 1 WHERE link_id = ? AND is_custom = 0")
        .bind(row.link_id)
        .run();
    }

    return db.prepare(`SELECT ${slugSelect()} FROM slugs s WHERE slug = ?`).bind(slug).first<Slug>();
  }

  static async enable(db: D1Database, slug: string): Promise<Slug | null> {
    await db.prepare("UPDATE slugs SET disabled_at = NULL WHERE slug = ?").bind(slug).run();
    return db.prepare(`SELECT ${slugSelect()} FROM slugs s WHERE slug = ?`).bind(slug).first<Slug>();
  }

  static async remove(db: D1Database, slug: string): Promise<boolean> {
    // Lifetime guard: never drop a slug that has recorded any click, so
    // analytics rows are not orphaned. Filter options would mask historical
    // bot traffic and let real history be deleted.
    const row = await db.prepare(`SELECT ${slugSelect()} FROM slugs s WHERE slug = ?`).bind(slug).first<Slug>();
    if (!row) return false;

    if (!row.is_custom) return false;

    if (row.click_count > 0) return false;

    if (row.is_primary) {
      await db
        .prepare("UPDATE slugs SET is_primary = 1 WHERE link_id = ? AND is_custom = 0")
        .bind(row.link_id)
        .run();
    }

    await db.prepare("DELETE FROM slugs WHERE slug = ?").bind(slug).run();
    return true;
  }
}
