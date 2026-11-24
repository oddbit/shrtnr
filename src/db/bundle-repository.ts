// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Bundle, BundleAccent, LinkWithSlugs, Slug } from "../types";
import { LinkRepository } from "./link-repository";
import { SlugClickCountOptions, slugClickCountSql } from "./filters";

const BUNDLE_COLS = "id, name, description, icon, accent, archived_at, created_via, created_by, created_at, updated_at";

function slugSelect(opts?: SlugClickCountOptions): string {
  return `s.*, ${slugClickCountSql(opts)}`;
}

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
  /** Optional owner filter. When omitted, list returns every bundle regardless of creator. */
  createdBy?: string;
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
    const clauses: string[] = [];
    const binds: unknown[] = [];
    if (opts.createdBy !== undefined) {
      clauses.push("created_by = ?");
      binds.push(opts.createdBy);
    }
    if (opts.archivedOnly) {
      clauses.push("archived_at IS NOT NULL");
    } else if (!opts.includeArchived) {
      clauses.push("archived_at IS NULL");
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await db
      .prepare(`SELECT ${BUNDLE_COLS} FROM bundles ${where} ORDER BY created_at DESC`)
      .bind(...binds)
      .all<Bundle>();
    return rows.results ?? [];
  }

  static async update(
    db: D1Database,
    id: number,
    patch: UpdateBundleInput,
  ): Promise<Bundle | null> {
    // Write the supplied columns and no others, so two concurrent edits to
    // different fields both land (see LinkRepository.update).
    const sets: string[] = [];
    const binds: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      sets.push("name = ?");
      binds.push(patch.name);
    }
    if (patch.description !== undefined) {
      sets.push("description = ?");
      binds.push(patch.description);
    }
    if (patch.icon !== undefined) {
      sets.push("icon = ?");
      binds.push(patch.icon);
    }
    if (patch.accent !== undefined) {
      sets.push("accent = ?");
      binds.push(patch.accent);
    }
    if (sets.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare(`UPDATE bundles SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`)
        .bind(...binds, now, id)
        .run();
    }

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
    const result = await db.prepare("DELETE FROM bundles WHERE id = ?").bind(id).run();
    // changes === 0 on race: a concurrent request already deleted this row.
    return (result.meta.changes ?? 0) > 0;
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

  /**
   * Member count of every bundle that has members, keyed by bundle id. Grouped
   * over the whole table rather than filtered by a bound id list: an IN list
   * past D1's 100-parameter cap fails the statement, and the table holds one
   * row per membership, so grouping it whole costs no more than a long list.
   */
  static async linkCounts(db: D1Database): Promise<Map<number, number>> {
    const rows = await db
      .prepare("SELECT bundle_id, COUNT(*) as cnt FROM bundle_links GROUP BY bundle_id")
      .all<{ bundle_id: number; cnt: number }>();
    return new Map((rows.results ?? []).map((r) => [r.bundle_id, r.cnt]));
  }

  static async listLinks(db: D1Database, bundleId: number, opts?: SlugClickCountOptions): Promise<LinkWithSlugs[]> {
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

    // Resolve membership inside SQLite rather than binding one parameter per
    // member link: D1 caps a statement at 100 bound parameters, and wide
    // bundles pass that.
    const slugRows = await db
      .prepare(
        `SELECT ${slugSelect(opts)} FROM slugs s
         WHERE link_id IN (SELECT link_id FROM bundle_links WHERE bundle_id = ?)
         ORDER BY is_custom ASC, created_at ASC`,
      )
      .bind(bundleId)
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
