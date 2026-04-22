// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Bundle, BundleAccent, LinkWithSlugs, Slug } from "../types";
import { LinkRepository } from "./link-repository";

const BUNDLE_COLS = "id, name, description, icon, accent, archived_at, created_via, created_by, created_at, updated_at";
const SLUG_SELECT = "s.*, (SELECT COUNT(*) FROM clicks c WHERE c.slug = s.slug) AS click_count";

export interface CreateBundleInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  accent?: BundleAccent;
  createdVia?: string | null;
  createdBy: string;
}

export interface UpdateBundleInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  accent?: BundleAccent;
}

export interface ListBundlesOptions {
  createdBy: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
}

export class BundleRepository {
  static async create(db: D1Database, input: CreateBundleInput): Promise<Bundle> {
    const now = Math.floor(Date.now() / 1000);
    const res = await db
      .prepare(
        "INSERT INTO bundles (name, description, icon, accent, created_via, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        input.name,
        input.description ?? null,
        input.icon ?? null,
        input.accent ?? "orange",
        input.createdVia ?? "app",
        input.createdBy,
        now,
        now,
      )
      .run();

    const id = res.meta.last_row_id as number;
    return (await BundleRepository.getById(db, id))!;
  }

  static async getById(db: D1Database, id: number): Promise<Bundle | null> {
    return db
      .prepare(`SELECT ${BUNDLE_COLS} FROM bundles WHERE id = ?`)
      .bind(id)
      .first<Bundle>();
  }

  static async list(db: D1Database, opts: ListBundlesOptions): Promise<Bundle[]> {
    let where = "created_by = ?";
    const binds: unknown[] = [opts.createdBy];
    if (opts.archivedOnly) {
      where += " AND archived_at IS NOT NULL";
    } else if (!opts.includeArchived) {
      where += " AND archived_at IS NULL";
    }
    const rows = await db
      .prepare(`SELECT ${BUNDLE_COLS} FROM bundles WHERE ${where} ORDER BY created_at DESC`)
      .bind(...binds)
      .all<Bundle>();
    return rows.results ?? [];
  }

  static async update(
    db: D1Database,
    id: number,
    patch: UpdateBundleInput,
  ): Promise<Bundle | null> {
    const current = await BundleRepository.getById(db, id);
    if (!current) return null;

    const name = patch.name ?? current.name;
    const description = patch.description !== undefined ? patch.description : current.description;
    const icon = patch.icon !== undefined ? patch.icon : current.icon;
    const accent = patch.accent ?? current.accent;
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        "UPDATE bundles SET name = ?, description = ?, icon = ?, accent = ?, updated_at = ? WHERE id = ?",
      )
      .bind(name, description, icon, accent, now, id)
      .run();

    return BundleRepository.getById(db, id);
  }

  static async archive(db: D1Database, id: number): Promise<Bundle | null> {
    const current = await BundleRepository.getById(db, id);
    if (!current) return null;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare("UPDATE bundles SET archived_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, id)
      .run();
    return BundleRepository.getById(db, id);
  }

  static async unarchive(db: D1Database, id: number): Promise<Bundle | null> {
    const current = await BundleRepository.getById(db, id);
    if (!current) return null;
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare("UPDATE bundles SET archived_at = NULL, updated_at = ? WHERE id = ?")
      .bind(now, id)
      .run();
    return BundleRepository.getById(db, id);
  }

  static async delete(db: D1Database, id: number): Promise<boolean> {
    const current = await BundleRepository.getById(db, id);
    if (!current) return false;
    await db.prepare("DELETE FROM bundles WHERE id = ?").bind(id).run();
    return true;
  }

  static async addLink(db: D1Database, bundleId: number, linkId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare("INSERT OR IGNORE INTO bundle_links (bundle_id, link_id, added_at) VALUES (?, ?, ?)")
      .bind(bundleId, linkId, now)
      .run();
  }

  static async removeLink(db: D1Database, bundleId: number, linkId: number): Promise<boolean> {
    const res = await db
      .prepare("DELETE FROM bundle_links WHERE bundle_id = ? AND link_id = ?")
      .bind(bundleId, linkId)
      .run();
    return (res.meta.changes ?? 0) > 0;
  }

  static async countLinks(db: D1Database, bundleId: number): Promise<number> {
    const row = await db
      .prepare("SELECT COUNT(*) as cnt FROM bundle_links WHERE bundle_id = ?")
      .bind(bundleId)
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }

  static async listLinks(db: D1Database, bundleId: number): Promise<LinkWithSlugs[]> {
    const linkRows = await db
      .prepare(
        `SELECT l.* FROM links l
         JOIN bundle_links bl ON bl.link_id = l.id
         WHERE bl.bundle_id = ?
         ORDER BY l.created_at DESC`,
      )
      .bind(bundleId)
      .all<{ id: number; url: string; label: string | null; created_at: number; expires_at: number | null; created_via: string | null; created_by: string }>();

    const links = linkRows.results ?? [];
    if (links.length === 0) return [];

    const linkIds = links.map((l) => l.id);
    const placeholders = linkIds.map(() => "?").join(",");
    const slugRows = await db
      .prepare(
        `SELECT ${SLUG_SELECT} FROM slugs s WHERE link_id IN (${placeholders}) ORDER BY is_custom ASC, created_at ASC`,
      )
      .bind(...linkIds)
      .all<Slug>();

    const slugsByLink = new Map<number, Slug[]>();
    for (const s of slugRows.results ?? []) {
      const arr = slugsByLink.get(s.link_id) ?? [];
      arr.push(s);
      slugsByLink.set(s.link_id, arr);
    }

    return links.map((l) => {
      const slugs = slugsByLink.get(l.id) ?? [];
      return {
        ...l,
        slugs,
        total_clicks: slugs.reduce((sum, s) => sum + s.click_count, 0),
      };
    });
  }

  static async listBundlesForLink(db: D1Database, linkId: number): Promise<Bundle[]> {
    const rows = await db
      .prepare(
        `SELECT ${BUNDLE_COLS.split(", ").map((c) => `b.${c}`).join(", ")} FROM bundles b
         JOIN bundle_links bl ON bl.bundle_id = b.id
         WHERE bl.link_id = ? AND b.archived_at IS NULL
         ORDER BY b.name ASC`,
      )
      .bind(linkId)
      .all<Bundle>();
    return rows.results ?? [];
  }
}
