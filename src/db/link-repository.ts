// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Link, Slug, LinkWithSlugs } from "../types";
import { SlugClickCountOptions, slugClickCountSql, linkClickCountSql } from "./filters";

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

/**
 * Buckets slug rows by `link_id` so assembly is one Map lookup per link
 * instead of a full rescan of the slug set, which would make assembly
 * O(links x slugs).
 */
function bucketByLink(slugs: Slug[]): Map<number, Slug[]> {
  const byLink = new Map<number, Slug[]>();
  for (const s of slugs) {
    const arr = byLink.get(s.link_id);
    if (arr) arr.push(s);
    else byLink.set(s.link_id, [s]);
  }
  return byLink;
}

/** Sort orders the paginated listing supports. */
export type LinkSort = "recent" | "popular";

/** Lifecycle slice the paginated listing supports, decided by `expires_at`. */
export type LinkStatus = "active" | "disabled" | "all";

export interface LinkPageQuery {
  /** Rows per page. A non-positive value yields an empty page, never the whole table. */
  limit: number;
  offset?: number;
  sort?: LinkSort;
  status?: LinkStatus;
  /** Substring matched against label, url, any slug, and (with `searchOwner`) created_by. */
  search?: string;
  searchOwner?: boolean;
  /** Exact `created_by` match. Unrelated to `searchOwner`, which widens a substring search. */
  owner?: string;
  /** Exact `url` match, for finding the links that already point somewhere. */
  url?: string;
  /** Reference time for the `status` comparison. Defaults to now. */
  now?: number;
}

export interface LinkPage {
  links: LinkWithSlugs[];
  /** Rows matching the filters across the whole catalog, not just this window. */
  total: number;
  /** Offset actually served, clamped when the caller asked past the last row. */
  offset: number;
}

/** Predicate shared by the paginated listing and its counts. */
type LinkFilterSql = { where: string; binds: (string | number)[] };

function likePattern(query: string): string {
  // Escape SQLite LIKE metacharacters so a user query of "_" or "50%" is
  // treated as a literal string, not a wildcard pattern.
  const escaped = query.trim().toLowerCase()
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

type LinkFilterQuery = Pick<LinkPageQuery, "status" | "search" | "searchOwner" | "owner" | "url" | "now">;

function linkFilterSql(query: LinkFilterQuery): LinkFilterSql {
  const conds: string[] = [];
  const binds: (string | number)[] = [];

  if (query.owner !== undefined) {
    conds.push("l.created_by = ?");
    binds.push(query.owner);
  }

  if (query.url !== undefined) {
    conds.push("l.url = ?");
    binds.push(query.url);
  }

  const now = query.now ?? Math.floor(Date.now() / 1000);
  if (query.status === "active") {
    conds.push("(l.expires_at IS NULL OR l.expires_at >= ?)");
    binds.push(now);
  } else if (query.status === "disabled") {
    conds.push("(l.expires_at IS NOT NULL AND l.expires_at < ?)");
    binds.push(now);
  }

  const term = query.search?.trim();
  if (term) {
    const pattern = likePattern(term);
    const fields = query.searchOwner
      ? ["lower(l.label)", "lower(l.url)", "lower(l.created_by)"]
      : ["lower(l.label)", "lower(l.url)"];
    const ors = fields.map((f) => `${f} LIKE ? ESCAPE '\\'`);
    binds.push(...fields.map(() => pattern));
    // EXISTS rather than a join: a link with several matching slugs must count
    // once, and a joined query would need DISTINCT to say the same thing while
    // breaking the COUNT(*) that derives the page count.
    ors.push("EXISTS (SELECT 1 FROM slugs ms WHERE ms.link_id = l.id AND lower(ms.slug) LIKE ? ESCAPE '\\')");
    binds.push(pattern);
    conds.push(`(${ors.join(" OR ")})`);
  }

  return { where: conds.length ? ` WHERE ${conds.join(" AND ")}` : "", binds };
}

export class LinkRepository {
  /**
   * Every link matching `query`, newest first, with slugs attached. Two
   * statements whatever the match count: the rows, then the slugs of those
   * rows bucketed by `link_id` so assembly stays O(links + slugs).
   *
   * The unbounded sibling of `page()`, for the API and MCP callers that hand
   * back a whole set. Both derive their predicate from `linkFilterSql`, so
   * what "search" or "owner" selects has one definition: adding a searchable
   * column or changing case handling reaches every surface at once, and the
   * two cannot disagree on tie ordering.
   *
   * The slug query restates the predicate as a subquery rather than binding
   * the ids it got back. A match set has no ceiling and D1 caps bound
   * parameters per statement, so ids cannot be bound here the way `page()`
   * binds its window. The subquery carries no ORDER BY and no LIMIT, so it
   * costs a second pass over the predicate and no second sort.
   */
  private static async rows(
    db: D1Database,
    query: LinkFilterQuery,
    opts?: LinkRepoOptions,
  ): Promise<LinkWithSlugs[]> {
    const { where, binds } = linkFilterSql(query);
    const links = await db
      .prepare(`SELECT l.* FROM links l${where} ORDER BY l.created_at DESC, l.id DESC`)
      .bind(...binds)
      .all<Link>();
    const rows = links.results ?? [];
    if (rows.length === 0) return [];

    // An empty predicate selects every link, so the subquery would filter
    // nothing and cost a scan to say so.
    const scope = where ? ` WHERE s.link_id IN (SELECT l.id FROM links l${where})` : "";
    const slugs = await db
      .prepare(`SELECT ${slugSelect(opts)} FROM slugs s${scope} ORDER BY is_custom ASC, created_at ASC`)
      .bind(...(where ? binds : []))
      .all<Slug>();

    const byLink = bucketByLink(slugs.results ?? []);
    return rows.map((link) => assembleLink(link, byLink.get(link.id) ?? []));
  }

  static async list(db: D1Database, opts?: LinkRepoOptions): Promise<LinkWithSlugs[]> {
    return LinkRepository.rows(db, {}, opts);
  }

  /**
   * One page of links with their slugs, plus the total the page was cut from.
   *
   * Three queries whatever the catalog size: a `COUNT(*)` for the total, the
   * windowed link rows, and the slugs of only those rows. Filtering, sorting
   * and the window all live in SQL, so a caller rendering 25 rows never loads
   * the catalog to slice it in JS. Use this for the listings page; `list()`
   * stays for the API and MCP callers that hand back everything.
   */
  static async page(db: D1Database, requested: LinkPageQuery, opts?: LinkRepoOptions): Promise<LinkPage> {
    // SQLite treats a negative LIMIT as "no limit", so a non-positive value
    // must short-circuit rather than reach SQL and return the whole table.
    const limit = Math.floor(requested.limit);
    if (limit <= 0) return { links: [], total: 0, offset: 0 };
    // A search that trims to nothing matches everything under LIKE, which is
    // the opposite of what an empty search box means.
    if (requested.search !== undefined && !requested.search.trim()) return { links: [], total: 0, offset: 0 };

    // Read the clock once and hand the same instant to count() and the row
    // query. Each statement defaulting to its own Date.now() lets a link whose
    // expires_at falls between the two reads be counted and then excluded, so
    // the page prints a total one higher than the rows it serves.
    const query: LinkPageQuery = { ...requested, now: requested.now ?? Math.floor(Date.now() / 1000) };

    // Take the total from count() rather than building a second COUNT here:
    // the toolbar total and the empty-state count then cannot diverge, and a
    // later change to how rows are totalled lands in one statement.
    const total = await LinkRepository.count(db, query);
    if (total === 0) return { links: [], total: 0, offset: 0 };

    const { where, binds } = linkFilterSql(query);

    // A caller can ask past the end: a bookmarked page number, or rows
    // deleted since the URL was built. Serve the last populated window and
    // report the offset used so the caller can label the page it actually got.
    const wanted = Math.max(0, Math.floor(query.offset ?? 0));
    const offset = wanted >= total ? Math.floor((total - 1) / limit) * limit : wanted;

    // created_at is second-granularity, so tie-break on id to keep windows
    // disjoint when several links share a timestamp.
    const order = query.sort === "popular"
      ? `${linkClickCountSql(opts)} DESC, l.created_at DESC, l.id DESC`
      : "l.created_at DESC, l.id DESC";
    const links = await db
      .prepare(`SELECT l.* FROM links l${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset)
      .all<Link>();
    const rows = links.results ?? [];
    // total came from a separate statement, so rows deleted between the two
    // leave a positive total with nothing to serve.
    if (rows.length === 0) return { links: [], total, offset };

    // Bind the ids the window returned rather than repeating the window as a
    // subquery. Embedding it would run the whole WHERE + ORDER BY + LIMIT a
    // second time, and under sort=popular that ORDER BY is a correlated
    // COUNT over clicks per catalog row. One bind per served row keeps this
    // inside D1's parameter cap; LINKS_PER_PAGE_OPTIONS enforces the ceiling.
    const ids = rows.map((l) => l.id);
    const slugs = await db
      .prepare(
        `SELECT ${slugSelect(opts)} FROM slugs s WHERE s.link_id IN (${ids.map(() => "?").join(",")}) ORDER BY is_custom ASC, created_at ASC`,
      )
      .bind(...ids)
      .all<Slug>();

    const byLink = bucketByLink(slugs.results ?? []);
    return {
      links: rows.map((link) => assembleLink(link, byLink.get(link.id) ?? [])),
      total,
      offset,
    };
  }

  /**
   * Rows matching the filters, without fetching any of them. Callers use it to
   * tell an empty catalog from one whose links are all filtered out.
   */
  static async count(db: D1Database, query?: LinkFilterQuery): Promise<number> {
    if (query?.search !== undefined && !query.search.trim()) return 0;
    const { where, binds } = linkFilterSql(query ?? {});
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM links l${where}`).bind(...binds).first<{ n: number }>();
    return row?.n ?? 0;
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

    const byLink = bucketByLink(slugs.results ?? []);
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
    return LinkRepository.rows(db, { url }, opts);
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

  /**
   * Links whose label, url, any slug, or (with `includeOwner`) `created_by`
   * contains `query`. Two statements, not one per match: fetching each match
   * through `getById` cost two statements per row, so a broad search over a
   * large catalog exhausted D1's per-invocation subrequest budget.
   */
  static async search(
    db: D1Database,
    query: string,
    opts?: LinkRepoOptions & { includeOwner?: boolean },
  ): Promise<LinkWithSlugs[]> {
    // A query that trims to nothing matches every row under LIKE, which is the
    // opposite of what an empty search box means.
    if (!query.trim()) return [];
    return LinkRepository.rows(db, { search: query, searchOwner: opts?.includeOwner }, opts);
  }

  static async findByOwner(db: D1Database, owner: string, opts?: LinkRepoOptions): Promise<LinkWithSlugs[]> {
    return LinkRepository.rows(db, { owner }, opts);
  }

  /**
   * Batch-resolve the display slug for a set of link ids in one query. Orders
   * the way `pickPrimarySlug` picks: the slug marked is_primary per link,
   * then the first custom slug, then the first slug of any kind, so the SQL
   * pick and the in-memory pick name the same slug. Returns a Map keyed by
   * link_id; ids with no slug are absent.
   */
  static async primarySlugByIds(db: D1Database, ids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT link_id, slug FROM slugs WHERE link_id IN (${placeholders})
         ORDER BY is_primary DESC, is_custom DESC, created_at ASC`,
      )
      .bind(...ids)
      .all<{ link_id: number; slug: string }>();
    for (const r of rows.results ?? []) {
      if (!out.has(r.link_id)) out.set(r.link_id, r.slug); // first per link = primary
    }
    return out;
  }
}
