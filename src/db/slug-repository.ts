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

    // Insert and the primary handover run in one batch (D1 batches are
    // transactional), so a failure cannot leave the link with two primaries.
    const statements = [
      db
        .prepare("INSERT INTO slugs (link_id, slug, is_custom, is_primary, created_at) VALUES (?, ?, 1, ?, ?)")
        .bind(linkId, slug, isFirstCustom ? 1 : 0, now),
    ];
    if (isFirstCustom) {
      statements.push(
        db
          .prepare("UPDATE slugs SET is_primary = 0 WHERE link_id = ? AND slug != ?")
          .bind(linkId, slug),
      );
    }
    await db.batch(statements);

    return (await db
      .prepare(`SELECT ${slugSelect()} FROM slugs s WHERE link_id = ? AND slug = ?`)
      .bind(linkId, slug)
      .first<Slug>())!;
  }

  static async setPrimary(db: D1Database, linkId: number, slug: string): Promise<void> {
    // Single conditional UPDATE: the membership check and the primary
    // handover happen in one statement, so no interleaving delete or
    // reassignment can clear every primary flag without setting a new one.
    // When the slug does not belong to the link, the EXISTS guard matches
    // no rows and primary flags stay untouched.
    await db
      .prepare(
        `UPDATE slugs
         SET is_primary = CASE WHEN slug = ? THEN 1 ELSE 0 END
         WHERE link_id = ?
           AND EXISTS (SELECT 1 FROM slugs WHERE link_id = ? AND slug = ?)`,
      )
      .bind(slug, linkId, linkId, slug)
      .run();
  }

  static async disable(db: D1Database, slug: string): Promise<Slug | null> {
    const now = Math.floor(Date.now() / 1000);
    // findByValue (rather than a bare db.prepare) so the pre-read is a named
    // static method that tests can spy on.
    const row = await SlugRepository.findByValue(db, slug);
    if (!row) return null;

    // Disable and the primary fallback run in one transactional batch so a
    // failure cannot strand the link without a primary slug. The handover
    // re-checks inside the batch that this slug still holds primary: a
    // concurrent setPrimary could have moved primary to another slug since the
    // pre-read, and an unconditional handover would then promote the random
    // slug alongside the new primary, leaving two primaries. Promote first
    // (while this slug still holds primary), then demote this slug.
    const statements: D1PreparedStatement[] = [
      db.prepare("UPDATE slugs SET disabled_at = ? WHERE slug = ?").bind(now, slug),
    ];
    if (row.is_primary) {
      statements.push(
        db
          .prepare(
            `UPDATE slugs SET is_primary = 1
             WHERE link_id = ? AND is_custom = 0
               AND EXISTS (SELECT 1 FROM slugs WHERE slug = ? AND is_primary = 1)`,
          )
          .bind(row.link_id, slug),
        db.prepare("UPDATE slugs SET is_primary = 0 WHERE slug = ?").bind(slug),
      );
    }
    await db.batch(statements);

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
    // findByValue is used (rather than a bare db.prepare) so the pre-read
    // is a named static method that tests can spy on.
    const row = await SlugRepository.findByValue(db, slug);
    if (!row) return false;

    if (!row.is_custom) return false;

    if (row.click_count > 0) return false;

    // Primary handover and delete run in one transactional batch.
    // NOT EXISTS re-checks atomically that no click arrived since the pre-read.
    // A slug with clicks must never be deleted: depending on whether FK
    // enforcement is active, the delete would either orphan its clicks rows or
    // cascade them away, and both lose analytics history. The handover re-reads
    // both facts inside the batch so it only promotes the random slug when the
    // delete actually fires and this slug is still the primary: a click in the
    // window would otherwise strand two primaries, and a concurrent setPrimary
    // could promote the random slug alongside a new primary on another slug.
    const statements: D1PreparedStatement[] = [];
    if (row.is_primary) {
      statements.push(
        db
          .prepare(
            `UPDATE slugs SET is_primary = 1
             WHERE link_id = ? AND is_custom = 0
               AND NOT EXISTS (SELECT 1 FROM clicks WHERE slug = ?)
               AND EXISTS (SELECT 1 FROM slugs WHERE slug = ? AND is_primary = 1)`,
          )
          .bind(row.link_id, slug, slug),
      );
    }
    statements.push(
      db.prepare("DELETE FROM slugs WHERE slug = ? AND NOT EXISTS (SELECT 1 FROM clicks WHERE slug = ?)")
        .bind(slug, slug),
    );
    const results = await db.batch(statements);
    const deleteResult = results[results.length - 1];
    return (deleteResult.meta.changes ?? 0) > 0;
  }
}
