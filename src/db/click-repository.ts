// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { BundleStats, BundleStatsPerLink, ClickData, ClickStats, DashboardStats, LinkWithSlugs, TimelineBucket, TimelineData, TimelineRange } from "../types";
import { LinkRepository } from "./link-repository";
import { BundleRepository } from "./bundle-repository";
import { RANGE_SECONDS, computeDelta } from "../services/trends";

export type BreakdownDimension = "country" | "referrer_host" | "device_type" | "os" | "browser" | "link_mode" | "channel";

const VALID_DIMENSIONS = new Set<BreakdownDimension>([
  "country", "referrer_host", "device_type", "os", "browser", "link_mode", "channel",
]);

export class ClickRepository {
  static async record(
    db: D1Database,
    slug: string,
    data: ClickData = {},
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const mode = data.linkMode ?? "link";
    await db
      .prepare(
        `INSERT INTO clicks (slug, clicked_at, referrer, referrer_host, country, region, city, device_type, os, browser, language, link_mode, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content, user_agent, is_bot, visitor_fp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        slug,
        now,
        data.referrer ?? null,
        data.referrerHost ?? null,
        data.country ?? null,
        data.region ?? null,
        data.city ?? null,
        data.deviceType ?? null,
        data.os ?? null,
        data.browser ?? null,
        data.language ?? null,
        mode,
        data.channel ?? null,
        data.utmSource ?? null,
        data.utmMedium ?? null,
        data.utmCampaign ?? null,
        data.utmTerm ?? null,
        data.utmContent ?? null,
        data.userAgent ?? null,
        data.isBot ?? 0,
        data.visitorFp ?? null,
      )
      .run();
  }

  static async getStats(db: D1Database, linkId: number, range?: TimelineRange): Promise<ClickStats> {
    const slugRows = await db
      .prepare("SELECT slug FROM slugs WHERE link_id = ?")
      .bind(linkId)
      .all<{ slug: string }>();
    const slugs = (slugRows.results ?? []).map((r) => r.slug);

    const empty: ClickStats = { total_clicks: 0, countries: [], referrers: [], referrer_hosts: [], devices: [], os: [], browsers: [], link_modes: [], channels: [], clicks_over_time: [], slug_clicks: [] };
    if (slugs.length === 0) return empty;

    const placeholders = slugs.map(() => "?").join(",");
    let where = `slug IN (${placeholders})`;
    const binds: (string | number)[] = [...slugs];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      const sinceTs = now - (seconds[range] ?? 0);
      where += ` AND clicked_at >= ?`;
      binds.push(sinceTs);
    }

    const [totalRow, countries, referrers, referrerHosts, devices, osList, browsers, linkModes, channels, timeline, slugClicks] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where}`).bind(...binds).first<{ cnt: number }>(),
      db.prepare(`SELECT country as name, COUNT(*) as count FROM clicks WHERE ${where} AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT referrer as name, COUNT(*) as count FROM clicks WHERE ${where} AND referrer IS NOT NULL GROUP BY referrer ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT referrer_host as name, COUNT(*) as count FROM clicks WHERE ${where} AND referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT device_type as name, COUNT(*) as count FROM clicks WHERE ${where} AND device_type IS NOT NULL GROUP BY device_type ORDER BY count DESC`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT os as name, COUNT(*) as count FROM clicks WHERE ${where} AND os IS NOT NULL GROUP BY os ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT browser as name, COUNT(*) as count FROM clicks WHERE ${where} AND browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT link_mode as name, COUNT(*) as count FROM clicks WHERE ${where} GROUP BY link_mode ORDER BY count DESC`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT channel as name, COUNT(*) as count FROM clicks WHERE ${where} AND channel IS NOT NULL GROUP BY channel ORDER BY count DESC`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT date(clicked_at, 'unixepoch') as date, COUNT(*) as count FROM clicks WHERE ${where} GROUP BY date ORDER BY date DESC LIMIT 30`).bind(...binds).all<{ date: string; count: number }>(),
      db.prepare(`SELECT slug, COUNT(*) as count FROM clicks WHERE ${where} GROUP BY slug`).bind(...binds).all<{ slug: string; count: number }>(),
    ]);

    return {
      total_clicks: totalRow?.cnt ?? 0,
      countries: countries.results ?? [],
      referrers: referrers.results ?? [],
      referrer_hosts: referrerHosts.results ?? [],
      devices: devices.results ?? [],
      os: osList.results ?? [],
      browsers: browsers.results ?? [],
      link_modes: linkModes.results ?? [],
      channels: channels.results ?? [],
      clicks_over_time: (timeline.results ?? []).reverse(),
      slug_clicks: slugClicks.results ?? [],
    };
  }

  static async getTimeline(
    db: D1Database,
    linkId: number,
    range: TimelineRange,
    now?: number,
  ): Promise<TimelineData> {
    const ts = now ?? Math.floor(Date.now() / 1000);
    const slugRows = await db
      .prepare("SELECT slug FROM slugs WHERE link_id = ?")
      .bind(linkId)
      .all<{ slug: string }>();
    const slugs = (slugRows.results ?? []).map((r) => r.slug);

    const empty: TimelineData = {
      range,
      buckets: [],
      summary: { last_24h: 0, last_7d: 0, last_30d: 0, last_90d: 0, last_1y: 0 },
    };
    if (slugs.length === 0) return empty;

    const placeholders = slugs.map(() => "?").join(",");
    const where = `slug IN (${placeholders})`;

    // Summary counts
    const t24h = ts - 86400;
    const t7d = ts - 7 * 86400;
    const t30d = ts - 30 * 86400;
    const t90d = ts - 90 * 86400;
    const t1y = ts - 365 * 86400;
    const [last24h, last7d, last30d, last90d, last1y] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t24h).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t7d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t30d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t90d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t1y).first<{ cnt: number }>(),
    ]);

    const summary = {
      last_24h: last24h?.cnt ?? 0,
      last_7d: last7d?.cnt ?? 0,
      last_30d: last30d?.cnt ?? 0,
      last_90d: last90d?.cnt ?? 0,
      last_1y: last1y?.cnt ?? 0,
    };

    // Determine bucket SQL expression and time range
    let bucketExpr: string;
    let sinceTs: number | null;
    let allKind: "daily" | "weekly" | "monthly" = "monthly";
    let allEarliest = ts;

    switch (range) {
      case "24h":
        // hourly buckets: "YYYY-MM-DD HH"
        bucketExpr = "strftime('%Y-%m-%d %H', clicked_at, 'unixepoch')";
        sinceTs = ts - 86400;
        break;
      case "7d":
        bucketExpr = "date(clicked_at, 'unixepoch')";
        sinceTs = ts - 7 * 86400;
        break;
      case "30d":
        bucketExpr = "date(clicked_at, 'unixepoch')";
        sinceTs = ts - 30 * 86400;
        break;
      case "90d":
        bucketExpr = "date(clicked_at, 'unixepoch')";
        sinceTs = ts - 90 * 86400;
        break;
      case "1y":
        // weekly buckets: use the Monday of each week
        bucketExpr = "date(clicked_at, 'unixepoch', 'weekday 0', '-6 days')";
        sinceTs = ts - 365 * 86400;
        break;
      case "all": {
        // Pick granularity based on actual data span
        const placeholdersAll = slugs.map(() => "?").join(",");
        const earliestRow = await db
          .prepare(`SELECT MIN(clicked_at) as t FROM clicks WHERE slug IN (${placeholdersAll})`)
          .bind(...slugs)
          .first<{ t: number | null }>();
        allEarliest = earliestRow?.t ?? ts;
        const spanDays = Math.max(1, Math.floor((ts - allEarliest) / 86400));
        if (spanDays <= 90) {
          bucketExpr = "date(clicked_at, 'unixepoch')";
          allKind = "daily";
        } else if (spanDays <= 730) {
          bucketExpr = "date(clicked_at, 'unixepoch', 'weekday 0', '-6 days')";
          allKind = "weekly";
        } else {
          bucketExpr = "strftime('%Y-%m', clicked_at, 'unixepoch')";
          allKind = "monthly";
        }
        sinceTs = null;
        break;
      }
    }

    const timeFilter = sinceTs !== null ? ` AND clicked_at >= ?` : "";
    const binds = sinceTs !== null ? [...slugs, sinceTs] : [...slugs];

    const rows = await db
      .prepare(
        `SELECT ${bucketExpr} as label, COUNT(*) as count
         FROM clicks WHERE ${where}${timeFilter}
         GROUP BY label ORDER BY label ASC`,
      )
      .bind(...binds)
      .all<{ label: string; count: number }>();

    const dataMap = new Map((rows.results ?? []).map((r) => [r.label, r.count]));

    const buckets = range === "all"
      ? fillBucketsAll(dataMap, ts, allEarliest, allKind)
      : fillBuckets(range, dataMap, ts, sinceTs);

    return { range, buckets, summary };
  }

  static async getTrendingLinks(
    db: D1Database,
    range: TimelineRange,
    limit: number,
  ): Promise<{ link_id: number; clicks: number; url: string; label: string | null }[]> {
    let where = "1=1";
    const binds: number[] = [];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      where = "c.clicked_at >= ?";
      binds.push(now - (seconds[range] ?? 0));
    }

    const rows = await db
      .prepare(
        `SELECT s.link_id, COUNT(*) as clicks, l.url, l.label
         FROM clicks c
         JOIN slugs s ON s.slug = c.slug
         JOIN links l ON l.id = s.link_id
         WHERE ${where}
         GROUP BY s.link_id
         ORDER BY clicks DESC
         LIMIT ?`,
      )
      .bind(...binds, limit)
      .all<{ link_id: number; clicks: number; url: string; label: string | null }>();

    return rows.results ?? [];
  }

  static async getGlobalBreakdown(
    db: D1Database,
    dimension: BreakdownDimension,
    range: TimelineRange,
    limit: number,
  ): Promise<{ name: string; count: number }[]> {
    if (!VALID_DIMENSIONS.has(dimension)) return [];

    let where = `${dimension} IS NOT NULL`;
    const binds: number[] = [];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      where += " AND clicked_at >= ?";
      binds.push(now - (seconds[range] ?? 0));
    }

    const rows = await db
      .prepare(
        `SELECT ${dimension} as name, COUNT(*) as count
         FROM clicks
         WHERE ${where}
         GROUP BY ${dimension}
         ORDER BY count DESC
         LIMIT ?`,
      )
      .bind(...binds, limit)
      .all<{ name: string; count: number }>();

    return rows.results ?? [];
  }

  static async getTotalClicks(
    db: D1Database,
    range: TimelineRange,
  ): Promise<number> {
    let where = "1=1";
    const binds: number[] = [];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      where = "clicked_at >= ?";
      binds.push(now - (seconds[range] ?? 0));
    }

    const row = await db
      .prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where}`)
      .bind(...binds)
      .first<{ cnt: number }>();

    return row?.cnt ?? 0;
  }

  static async getLinkBreakdown(
    db: D1Database,
    linkId: number,
    dimension: BreakdownDimension,
    range: TimelineRange,
    limit: number,
  ): Promise<{ name: string; count: number }[]> {
    if (!VALID_DIMENSIONS.has(dimension)) return [];

    const slugRows = await db
      .prepare("SELECT slug FROM slugs WHERE link_id = ?")
      .bind(linkId)
      .all<{ slug: string }>();
    const slugs = (slugRows.results ?? []).map((r) => r.slug);
    if (slugs.length === 0) return [];

    const placeholders = slugs.map(() => "?").join(",");
    let where = `slug IN (${placeholders}) AND ${dimension} IS NOT NULL`;
    const binds: (string | number)[] = [...slugs];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      where += " AND clicked_at >= ?";
      binds.push(now - (seconds[range] ?? 0));
    }

    const rows = await db
      .prepare(
        `SELECT ${dimension} as name, COUNT(*) as count
         FROM clicks
         WHERE ${where}
         GROUP BY ${dimension}
         ORDER BY count DESC
         LIMIT ?`,
      )
      .bind(...binds, limit)
      .all<{ name: string; count: number }>();

    return rows.results ?? [];
  }

  static async compareLinkStats(
    db: D1Database,
    linkId: number,
    range: TimelineRange,
  ): Promise<{ total_clicks: number; top_country: string | null; top_referrer: string | null }> {
    const slugRows = await db
      .prepare("SELECT slug FROM slugs WHERE link_id = ?")
      .bind(linkId)
      .all<{ slug: string }>();
    const slugs = (slugRows.results ?? []).map((r) => r.slug);

    if (slugs.length === 0) {
      return { total_clicks: 0, top_country: null, top_referrer: null };
    }

    const placeholders = slugs.map(() => "?").join(",");
    let where = `slug IN (${placeholders})`;
    const binds: (string | number)[] = [...slugs];

    if (range && range !== "all") {
      const now = Math.floor(Date.now() / 1000);
      const seconds: Record<string, number> = { "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "90d": 90 * 86400, "1y": 365 * 86400 };
      where += " AND clicked_at >= ?";
      binds.push(now - (seconds[range] ?? 0));
    }

    const [totalRow, topCountry, topReferrer] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where}`).bind(...binds).first<{ cnt: number }>(),
      db.prepare(`SELECT country as name FROM clicks WHERE ${where} AND country IS NOT NULL GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1`).bind(...binds).first<{ name: string }>(),
      db.prepare(`SELECT referrer_host as name FROM clicks WHERE ${where} AND referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY COUNT(*) DESC LIMIT 1`).bind(...binds).first<{ name: string }>(),
    ]);

    return {
      total_clicks: totalRow?.cnt ?? 0,
      top_country: topCountry?.name ?? null,
      top_referrer: topReferrer?.name ?? null,
    };
  }

  /**
   * Returns click totals for the current `range` and the equivalent previous window.
   * Scoped to one link when `linkId` is provided.
   *
   * "All time" has no previous window, so `previous` is always 0.
   */
  static async getPeriodClicks(
    db: D1Database,
    range: TimelineRange,
    now?: number,
    linkId?: number,
  ): Promise<{ current: number; previous: number }> {
    const ts = now ?? Math.floor(Date.now() / 1000);

    let linkFilter = "";
    const linkBinds: number[] = [];
    if (linkId !== undefined) {
      linkFilter = "slug IN (SELECT slug FROM slugs WHERE link_id = ?)";
      linkBinds.push(linkId);
    }

    if (range === "all") {
      const where = linkFilter ? `WHERE ${linkFilter}` : "";
      const row = await db
        .prepare(`SELECT COUNT(*) as cnt FROM clicks ${where}`)
        .bind(...linkBinds)
        .first<{ cnt: number }>();
      return { current: row?.cnt ?? 0, previous: 0 };
    }

    const span = RANGE_SECONDS[range];
    const currStart = ts - span;
    const prevStart = ts - 2 * span;

    const baseWhere = linkFilter ? `${linkFilter} AND ` : "";
    const [cur, prev] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${baseWhere}clicked_at >= ?`)
        .bind(...linkBinds, currStart)
        .first<{ cnt: number }>(),
      db
        .prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${baseWhere}clicked_at >= ? AND clicked_at < ?`)
        .bind(...linkBinds, prevStart, currStart)
        .first<{ cnt: number }>(),
    ]);
    return { current: cur?.cnt ?? 0, previous: prev?.cnt ?? 0 };
  }

  /**
   * Returns counts of links created in current and previous windows.
   * "All time" has no previous window.
   */
  static async getLinkCreationPeriods(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<{ current: number; previous: number; total: number }> {
    const ts = now ?? Math.floor(Date.now() / 1000);
    const totalRow = await db
      .prepare("SELECT COUNT(*) as cnt FROM links")
      .first<{ cnt: number }>();
    const total = totalRow?.cnt ?? 0;

    if (range === "all") {
      return { current: total, previous: 0, total };
    }

    const span = RANGE_SECONDS[range];
    const currStart = ts - span;
    const prevStart = ts - 2 * span;

    const [cur, prev] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) as cnt FROM links WHERE created_at >= ?")
        .bind(currStart)
        .first<{ cnt: number }>(),
      db
        .prepare("SELECT COUNT(*) as cnt FROM links WHERE created_at >= ? AND created_at < ?")
        .bind(prevStart, currStart)
        .first<{ cnt: number }>(),
    ]);
    return { current: cur?.cnt ?? 0, previous: prev?.cnt ?? 0, total };
  }

  /**
   * Returns a fixed-size counts series for the selected range — used to render
   * sparklines on KPI cards. Buckets are daily for ranges >= 7d, hourly for 24h,
   * weekly for 1y, and monthly for all.
   */
  static async getSparkline(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<number[]> {
    const ts = now ?? Math.floor(Date.now() / 1000);
    const spec = getBucketSpec(range, ts);
    const where = spec.since !== null ? "WHERE clicked_at >= ?" : "";
    const binds = spec.since !== null ? [spec.since] : [];

    const rows = await db
      .prepare(
        `SELECT ${spec.bucketExpr("clicked_at")} as label, COUNT(*) as value
         FROM clicks ${where}
         GROUP BY label ORDER BY label ASC`,
      )
      .bind(...binds)
      .all<{ label: string; value: number }>();

    return fillSparkline(rows.results ?? [], spec, range, ts);
  }

  /** Links-created-per-bucket sparkline. */
  static async getLinksCreatedSparkline(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<number[]> {
    const ts = now ?? Math.floor(Date.now() / 1000);
    const spec = getBucketSpec(range, ts);
    const where = spec.since !== null ? "WHERE created_at >= ?" : "";
    const binds = spec.since !== null ? [spec.since] : [];

    const rows = await db
      .prepare(
        `SELECT ${spec.bucketExpr("created_at")} as label, COUNT(*) as value
         FROM links ${where}
         GROUP BY label ORDER BY label ASC`,
      )
      .bind(...binds)
      .all<{ label: string; value: number }>();

    return fillSparkline(rows.results ?? [], spec, range, ts);
  }

  /** Distinct-clicked-links-per-bucket sparkline (counts unique link_id per bucket). */
  static async getClickedLinksSparkline(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<number[]> {
    const ts = now ?? Math.floor(Date.now() / 1000);
    const spec = getBucketSpec(range, ts);
    const where = spec.since !== null ? "WHERE c.clicked_at >= ?" : "";
    const binds = spec.since !== null ? [spec.since] : [];

    const rows = await db
      .prepare(
        `SELECT ${spec.bucketExpr("c.clicked_at")} as label, COUNT(DISTINCT s.link_id) as value
         FROM clicks c JOIN slugs s ON c.slug = s.slug ${where}
         GROUP BY label ORDER BY label ASC`,
      )
      .bind(...binds)
      .all<{ label: string; value: number }>();

    return fillSparkline(rows.results ?? [], spec, range, ts);
  }


  /**
   * Enriches links with delta_pct for the selected range.
   * Done in one query per link to keep the dashboard lightweight.
   */
  static async attachLinkDeltas(
    db: D1Database,
    links: LinkWithSlugs[],
    range: TimelineRange,
    now?: number,
  ): Promise<LinkWithSlugs[]> {
    if (range === "all") return links;
    const results = await Promise.all(
      links.map(async (link) => {
        const { current, previous } = await this.getPeriodClicks(db, range, now, link.id);
        return { ...link, delta_pct: computeDelta(current, previous) };
      }),
    );
    return results;
  }

  /**
   * Bulk-enriches links with delta_pct using two grouped queries regardless
   * of list size. Safe for the listings page where per-link queries would
   * exceed D1's subrequest limit.
   */
  static async attachLinkDeltasBulk(
    db: D1Database,
    links: LinkWithSlugs[],
    range: TimelineRange,
    now?: number,
  ): Promise<LinkWithSlugs[]> {
    if (links.length === 0) return links;
    if (range === "all") return links;

    const ts = now ?? Math.floor(Date.now() / 1000);
    const span = RANGE_SECONDS[range];
    const currStart = ts - span;
    const prevStart = ts - 2 * span;

    const [curRows, prevRows] = await Promise.all([
      db
        .prepare(
          "SELECT s.link_id as link_id, COUNT(*) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug WHERE c.clicked_at >= ? GROUP BY s.link_id",
        )
        .bind(currStart)
        .all<{ link_id: number; cnt: number }>(),
      db
        .prepare(
          "SELECT s.link_id as link_id, COUNT(*) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug WHERE c.clicked_at >= ? AND c.clicked_at < ? GROUP BY s.link_id",
        )
        .bind(prevStart, currStart)
        .all<{ link_id: number; cnt: number }>(),
    ]);

    const curMap = new Map((curRows.results ?? []).map((r) => [r.link_id, r.cnt]));
    const prevMap = new Map((prevRows.results ?? []).map((r) => [r.link_id, r.cnt]));

    return links.map((link) => ({
      ...link,
      delta_pct: computeDelta(curMap.get(link.id) ?? 0, prevMap.get(link.id) ?? 0),
    }));
  }

  static async getDashboardStats(
    db: D1Database,
    range: TimelineRange = "30d",
    now?: number,
  ): Promise<DashboardStats> {
    const ts = now ?? Math.floor(Date.now() / 1000);
    const since = range === "all" ? null : ts - RANGE_SECONDS[range];

    const countryQuery = since !== null
      ? db.prepare("SELECT country as name, COUNT(*) as count FROM clicks WHERE country IS NOT NULL AND clicked_at >= ? GROUP BY country ORDER BY count DESC LIMIT 5").bind(since)
      : db.prepare("SELECT country as name, COUNT(*) as count FROM clicks WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 5");

    const referrerQuery = since !== null
      ? db.prepare("SELECT referrer_host as name, COUNT(*) as count FROM clicks WHERE referrer_host IS NOT NULL AND clicked_at >= ? GROUP BY referrer_host ORDER BY count DESC LIMIT 5").bind(since)
      : db.prepare("SELECT referrer_host as name, COUNT(*) as count FROM clicks WHERE referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY count DESC LIMIT 5");

    const topLinksQuery = since !== null
      ? db.prepare("SELECT s.link_id as link_id, COUNT(*) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug WHERE c.clicked_at >= ? GROUP BY s.link_id ORDER BY cnt DESC LIMIT 5").bind(since)
      : db.prepare("SELECT s.link_id as link_id, COUNT(*) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug GROUP BY s.link_id ORDER BY cnt DESC LIMIT 5");

    const [
      clicks,
      linkPeriods,
      recentLinks,
      topCountries,
      topReferrers,
      topLinkRows,
      spark,
      sparkLinks,
      sparkClickedLinks,
      domainCount,
      countryCount,
      clickedLinkCounts,
    ] = await Promise.all([
      this.getPeriodClicks(db, range, ts),
      this.getLinkCreationPeriods(db, range, ts),
      LinkRepository.list(db),
      countryQuery.all<{ name: string; count: number }>(),
      referrerQuery.all<{ name: string; count: number }>(),
      topLinksQuery.all<{ link_id: number; cnt: number }>(),
      this.getSparkline(db, range, ts),
      this.getLinksCreatedSparkline(db, range, ts),
      this.getClickedLinksSparkline(db, range, ts),
      this.getDomainCount(db, range, ts),
      this.getCountryCount(db, range, ts),
      this.getClickedLinksPeriods(db, range, ts),
    ]);

    const withDeltas = await this.attachLinkDeltas(db, recentLinks, range, ts);
    const linkById = new Map(withDeltas.map((l) => [l.id, l]));
    const topLinks = (topLinkRows.results ?? [])
      .map((r) => {
        const base = linkById.get(r.link_id);
        return base ? { ...base, total_clicks: r.cnt } : null;
      })
      .filter((l): l is LinkWithSlugs => l !== null);

    const daySpan = await this.getDaySpan(db, range, ts);
    const clicksPerDay = daySpan > 0 ? Math.round(clicks.current / daySpan) : 0;
    const clicksPerDayDelta = range === "all"
      ? undefined
      : computeDelta(clicks.current, clicks.previous);

    return {
      range,
      total_links: linkPeriods.current,
      total_clicks: clicks.current,
      total_clicks_previous: clicks.previous,
      total_clicks_delta: computeDelta(clicks.current, clicks.previous),
      new_links_delta: computeDelta(linkPeriods.current, linkPeriods.previous),
      clicks_per_day: clicksPerDay,
      clicks_per_day_delta: clicksPerDayDelta,
      num_domains: domainCount,
      num_countries: countryCount,
      clicked_links: clickedLinkCounts.current,
      clicked_links_delta: computeDelta(clickedLinkCounts.current, clickedLinkCounts.previous),
      timeline: spark,
      timeline_links: sparkLinks,
      timeline_clicked_links: sparkClickedLinks,
      recent_links: withDeltas.slice(0, 5),
      top_links: topLinks,
      top_countries: topCountries.results ?? [],
      top_referrers: topReferrers.results ?? [],
    };
  }

  /**
   * Returns the number of days covered by the current window.
   * Fixed for bounded ranges; for "all", spans from the earliest click to now
   * (minimum 1 to avoid division by zero).
   */
  static async getDaySpan(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<number> {
    if (range !== "all") return RANGE_SECONDS[range] / 86400;
    const ts = now ?? Math.floor(Date.now() / 1000);
    const row = await db
      .prepare("SELECT MIN(clicked_at) as first FROM clicks")
      .first<{ first: number | null }>();
    if (!row?.first) return 1;
    const days = Math.max(1, Math.ceil((ts - row.first) / 86400));
    return days;
  }

  /**
   * Distinct destination-domain count for links created in the current window;
   * lifetime when range is "all". Domain extraction happens in JS since SQLite
   * lacks a native URL parser.
   */
  static async getDomainCount(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<number> {
    const ts = now ?? Math.floor(Date.now() / 1000);

    if (range === "all") {
      const rows = await db.prepare("SELECT url FROM links").all<{ url: string }>();
      return countDistinctHosts(rows.results ?? []);
    }

    const currStart = ts - RANGE_SECONDS[range];
    const rows = await db
      .prepare("SELECT url FROM links WHERE created_at >= ?")
      .bind(currStart)
      .all<{ url: string }>();
    return countDistinctHosts(rows.results ?? []);
  }

  /**
   * Distinct-link counts (links that received at least one click) for the
   * current and previous windows.
   */
  static async getClickedLinksPeriods(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<{ current: number; previous: number }> {
    const ts = now ?? Math.floor(Date.now() / 1000);

    if (range === "all") {
      const row = await db
        .prepare("SELECT COUNT(DISTINCT s.link_id) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug")
        .first<{ cnt: number }>();
      return { current: row?.cnt ?? 0, previous: 0 };
    }

    const span = RANGE_SECONDS[range];
    const currStart = ts - span;
    const prevStart = ts - 2 * span;

    const [cur, prev] = await Promise.all([
      db
        .prepare("SELECT COUNT(DISTINCT s.link_id) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug WHERE c.clicked_at >= ?")
        .bind(currStart)
        .first<{ cnt: number }>(),
      db
        .prepare("SELECT COUNT(DISTINCT s.link_id) as cnt FROM clicks c JOIN slugs s ON c.slug = s.slug WHERE c.clicked_at >= ? AND c.clicked_at < ?")
        .bind(prevStart, currStart)
        .first<{ cnt: number }>(),
    ]);
    return { current: cur?.cnt ?? 0, previous: prev?.cnt ?? 0 };
  }

  /**
   * Distinct click-origin country count for the current window; lifetime when
   * range is "all". Null countries are ignored.
   */
  static async getCountryCount(
    db: D1Database,
    range: TimelineRange,
    now?: number,
  ): Promise<number> {
    const ts = now ?? Math.floor(Date.now() / 1000);

    if (range === "all") {
      const row = await db
        .prepare("SELECT COUNT(DISTINCT country) as cnt FROM clicks WHERE country IS NOT NULL")
        .first<{ cnt: number }>();
      return row?.cnt ?? 0;
    }

    const currStart = ts - RANGE_SECONDS[range];
    const row = await db
      .prepare("SELECT COUNT(DISTINCT country) as cnt FROM clicks WHERE country IS NOT NULL AND clicked_at >= ?")
      .bind(currStart)
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }

  /**
   * Combined analytics across every link in a bundle. Mirrors getStats for a
   * single link: total clicks, per-dimension breakdowns, timeline, and a
   * per-link contribution table sorted by clicks desc.
   */
  static async getBundleStats(
    db: D1Database,
    bundleId: number,
    range: TimelineRange,
    now?: number,
  ): Promise<BundleStats | null> {
    const bundle = await BundleRepository.getById(db, bundleId);
    if (!bundle) return null;

    const ts = now ?? Math.floor(Date.now() / 1000);

    // Resolve member slugs and link metadata in one query.
    const memberRows = await db
      .prepare(
        `SELECT s.slug as slug, s.link_id as link_id, s.is_primary as is_primary,
                l.label as label, l.url as url
         FROM bundle_links bl
         JOIN slugs s ON s.link_id = bl.link_id
         JOIN links l ON l.id = bl.link_id
         WHERE bl.bundle_id = ?`,
      )
      .bind(bundleId)
      .all<{ slug: string; link_id: number; is_primary: number; label: string | null; url: string }>();

    const members = memberRows.results ?? [];
    const slugs = members.map((r) => r.slug);
    const linkMeta = new Map<number, { label: string | null; url: string; primary_slug: string }>();
    for (const m of members) {
      const existing = linkMeta.get(m.link_id);
      if (!existing || m.is_primary) {
        linkMeta.set(m.link_id, {
          label: m.label,
          url: m.url,
          primary_slug: m.is_primary || !existing ? m.slug : existing.primary_slug,
        });
      }
    }
    const linkCount = linkMeta.size;

    const empty: BundleStats = {
      bundle,
      link_count: linkCount,
      total_clicks: 0,
      clicked_links: 0,
      countries_reached: 0,
      timeline: { range, buckets: [], summary: { last_24h: 0, last_7d: 0, last_30d: 0, last_90d: 0, last_1y: 0 } },
      countries: [],
      devices: [],
      os: [],
      browsers: [],
      referrers: [],
      link_modes: [],
      per_link: [],
    };

    if (slugs.length === 0) return empty;

    const placeholders = slugs.map(() => "?").join(",");
    let where = `slug IN (${placeholders})`;
    const binds: (string | number)[] = [...slugs];
    if (range !== "all") {
      const sinceTs = ts - RANGE_SECONDS[range];
      where += " AND clicked_at >= ?";
      binds.push(sinceTs);
    }

    const [
      totalRow,
      countries,
      referrerHosts,
      devices,
      osList,
      browsers,
      linkModes,
      perLinkRows,
      timeline,
      period,
    ] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where}`).bind(...binds).first<{ cnt: number }>(),
      db.prepare(`SELECT country as name, COUNT(*) as count FROM clicks WHERE ${where} AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT referrer_host as name, COUNT(*) as count FROM clicks WHERE ${where} AND referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT device_type as name, COUNT(*) as count FROM clicks WHERE ${where} AND device_type IS NOT NULL GROUP BY device_type ORDER BY count DESC`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT os as name, COUNT(*) as count FROM clicks WHERE ${where} AND os IS NOT NULL GROUP BY os ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT browser as name, COUNT(*) as count FROM clicks WHERE ${where} AND browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT 10`).bind(...binds).all<{ name: string; count: number }>(),
      db.prepare(`SELECT link_mode as name, COUNT(*) as count FROM clicks WHERE ${where} GROUP BY link_mode ORDER BY count DESC`).bind(...binds).all<{ name: string; count: number }>(),
      (() => {
        let perLinkWhere = `c.slug IN (${placeholders})`;
        if (range !== "all") perLinkWhere += " AND c.clicked_at >= ?";
        return db.prepare(
          `SELECT s.link_id as link_id, COUNT(*) as cnt
           FROM clicks c JOIN slugs s ON s.slug = c.slug
           WHERE ${perLinkWhere}
           GROUP BY s.link_id
           ORDER BY cnt DESC`,
        ).bind(...binds).all<{ link_id: number; cnt: number }>();
      })(),
      this.getBundleTimeline(db, slugs, range, ts),
      this.getBundlePeriodClicks(db, slugs, range, ts),
    ]);

    const totalClicks = totalRow?.cnt ?? 0;
    const deltaPct = range === "all" ? undefined : computeDelta(period.current, period.previous);

    // Attach per-link deltas in two more grouped queries (scoped to bundle slugs).
    const perLinkDeltas = range === "all"
      ? new Map<number, number | undefined>()
      : await this.getBundlePerLinkDeltas(db, slugs, range, ts);

    const perLink: BundleStatsPerLink[] = [];
    for (const row of perLinkRows.results ?? []) {
      const meta = linkMeta.get(row.link_id);
      if (!meta) continue;
      const entry: BundleStatsPerLink = {
        link_id: row.link_id,
        label: meta.label,
        primary_slug: meta.primary_slug,
        url: meta.url,
        click_count: row.cnt,
        pct_of_bundle: totalClicks > 0 ? Math.round((row.cnt / totalClicks) * 100) : 0,
      };
      const delta = perLinkDeltas.get(row.link_id);
      if (delta !== undefined) entry.delta_pct = delta;
      perLink.push(entry);
    }

    // Include zero-click member links at the end so the UI can show them too.
    const seen = new Set(perLink.map((p) => p.link_id));
    for (const [link_id, meta] of linkMeta) {
      if (!seen.has(link_id)) {
        perLink.push({
          link_id,
          label: meta.label,
          primary_slug: meta.primary_slug,
          url: meta.url,
          click_count: 0,
          pct_of_bundle: 0,
          delta_pct: perLinkDeltas.get(link_id),
        });
      }
    }

    const countriesList = countries.results ?? [];
    const countriesTotal = countriesList.reduce((s, c) => s + c.count, 0);
    const topCountry = countriesList[0]
      ? { name: countriesList[0].name, pct: countriesTotal > 0 ? Math.round((countriesList[0].count / countriesTotal) * 100) : 0 }
      : undefined;

    const top = perLink[0] && perLink[0].click_count > 0 ? perLink[0] : undefined;

    return {
      bundle,
      link_count: linkCount,
      total_clicks: totalClicks,
      delta_pct: deltaPct,
      clicked_links: perLink.filter((p) => p.click_count > 0).length,
      top_performer: top
        ? { slug: top.primary_slug, label: top.label, click_count: top.click_count, pct_of_bundle: top.pct_of_bundle }
        : undefined,
      countries_reached: countriesList.length,
      top_country: topCountry,
      timeline,
      countries: countriesList,
      devices: devices.results ?? [],
      os: osList.results ?? [],
      browsers: browsers.results ?? [],
      referrers: referrerHosts.results ?? [],
      link_modes: linkModes.results ?? [],
      per_link: perLink,
    };
  }

  /** Timeline (range-bucketed) scoped to an explicit slug list. */
  private static async getBundleTimeline(
    db: D1Database,
    slugs: string[],
    range: TimelineRange,
    ts: number,
  ): Promise<TimelineData> {
    const empty: TimelineData = {
      range,
      buckets: [],
      summary: { last_24h: 0, last_7d: 0, last_30d: 0, last_90d: 0, last_1y: 0 },
    };
    if (slugs.length === 0) return empty;

    const placeholders = slugs.map(() => "?").join(",");
    const where = `slug IN (${placeholders})`;

    const t24h = ts - 86400;
    const t7d = ts - 7 * 86400;
    const t30d = ts - 30 * 86400;
    const t90d = ts - 90 * 86400;
    const t1y = ts - 365 * 86400;
    const [last24h, last7d, last30d, last90d, last1y] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t24h).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t7d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t30d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t90d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, t1y).first<{ cnt: number }>(),
    ]);

    const summary = {
      last_24h: last24h?.cnt ?? 0,
      last_7d: last7d?.cnt ?? 0,
      last_30d: last30d?.cnt ?? 0,
      last_90d: last90d?.cnt ?? 0,
      last_1y: last1y?.cnt ?? 0,
    };

    let bucketExpr: string;
    let sinceTs: number | null;
    let allKind: "daily" | "weekly" | "monthly" = "monthly";
    let allEarliest = ts;

    switch (range) {
      case "24h":
        bucketExpr = "strftime('%Y-%m-%d %H', clicked_at, 'unixepoch')";
        sinceTs = ts - 86400;
        break;
      case "7d":
        bucketExpr = "date(clicked_at, 'unixepoch')";
        sinceTs = ts - 7 * 86400;
        break;
      case "30d":
        bucketExpr = "date(clicked_at, 'unixepoch')";
        sinceTs = ts - 30 * 86400;
        break;
      case "90d":
        bucketExpr = "date(clicked_at, 'unixepoch')";
        sinceTs = ts - 90 * 86400;
        break;
      case "1y":
        bucketExpr = "date(clicked_at, 'unixepoch', 'weekday 0', '-6 days')";
        sinceTs = ts - 365 * 86400;
        break;
      case "all": {
        const earliestRow = await db
          .prepare(`SELECT MIN(clicked_at) as t FROM clicks WHERE ${where}`)
          .bind(...slugs)
          .first<{ t: number | null }>();
        allEarliest = earliestRow?.t ?? ts;
        const spanDays = Math.max(1, Math.floor((ts - allEarliest) / 86400));
        if (spanDays <= 90) {
          bucketExpr = "date(clicked_at, 'unixepoch')";
          allKind = "daily";
        } else if (spanDays <= 730) {
          bucketExpr = "date(clicked_at, 'unixepoch', 'weekday 0', '-6 days')";
          allKind = "weekly";
        } else {
          bucketExpr = "strftime('%Y-%m', clicked_at, 'unixepoch')";
          allKind = "monthly";
        }
        sinceTs = null;
        break;
      }
    }

    const timeFilter = sinceTs !== null ? " AND clicked_at >= ?" : "";
    const binds = sinceTs !== null ? [...slugs, sinceTs] : [...slugs];

    const rows = await db
      .prepare(
        `SELECT ${bucketExpr} as label, COUNT(*) as count
         FROM clicks WHERE ${where}${timeFilter}
         GROUP BY label ORDER BY label ASC`,
      )
      .bind(...binds)
      .all<{ label: string; count: number }>();

    const dataMap = new Map((rows.results ?? []).map((r) => [r.label, r.count]));
    const buckets: TimelineBucket[] = range === "all"
      ? fillBucketsAll(dataMap, ts, allEarliest, allKind)
      : fillBuckets(range, dataMap, ts, sinceTs);

    return { range, buckets, summary };
  }

  /** Current vs previous period click counts scoped to an explicit slug list. */
  private static async getBundlePeriodClicks(
    db: D1Database,
    slugs: string[],
    range: TimelineRange,
    ts: number,
  ): Promise<{ current: number; previous: number }> {
    if (slugs.length === 0) return { current: 0, previous: 0 };
    const placeholders = slugs.map(() => "?").join(",");
    const where = `slug IN (${placeholders})`;

    if (range === "all") {
      const row = await db
        .prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where}`)
        .bind(...slugs)
        .first<{ cnt: number }>();
      return { current: row?.cnt ?? 0, previous: 0 };
    }

    const span = RANGE_SECONDS[range];
    const currStart = ts - span;
    const prevStart = ts - 2 * span;

    const [cur, prev] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...slugs, currStart).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ? AND clicked_at < ?`).bind(...slugs, prevStart, currStart).first<{ cnt: number }>(),
    ]);
    return { current: cur?.cnt ?? 0, previous: prev?.cnt ?? 0 };
  }

  private static async getBundlePerLinkDeltas(
    db: D1Database,
    slugs: string[],
    range: TimelineRange,
    ts: number,
  ): Promise<Map<number, number | undefined>> {
    const out = new Map<number, number | undefined>();
    if (slugs.length === 0 || range === "all") return out;

    const placeholders = slugs.map(() => "?").join(",");
    const span = RANGE_SECONDS[range];
    const currStart = ts - span;
    const prevStart = ts - 2 * span;

    const [curRows, prevRows] = await Promise.all([
      db
        .prepare(
          `SELECT s.link_id as link_id, COUNT(*) as cnt
           FROM clicks c JOIN slugs s ON s.slug = c.slug
           WHERE c.slug IN (${placeholders}) AND c.clicked_at >= ?
           GROUP BY s.link_id`,
        )
        .bind(...slugs, currStart)
        .all<{ link_id: number; cnt: number }>(),
      db
        .prepare(
          `SELECT s.link_id as link_id, COUNT(*) as cnt
           FROM clicks c JOIN slugs s ON s.slug = c.slug
           WHERE c.slug IN (${placeholders}) AND c.clicked_at >= ? AND c.clicked_at < ?
           GROUP BY s.link_id`,
        )
        .bind(...slugs, prevStart, currStart)
        .all<{ link_id: number; cnt: number }>(),
    ]);

    const curMap = new Map((curRows.results ?? []).map((r) => [r.link_id, r.cnt]));
    const prevMap = new Map((prevRows.results ?? []).map((r) => [r.link_id, r.cnt]));
    const ids = new Set<number>([...curMap.keys(), ...prevMap.keys()]);
    for (const id of ids) {
      out.set(id, computeDelta(curMap.get(id) ?? 0, prevMap.get(id) ?? 0));
    }
    return out;
  }

  /**
   * Bulk summary for the bundles listing: totals, delta, sparkline, top 3 links
   * per bundle. Uses grouped queries to avoid N+1 against D1.
   */
  /**
   * Summary stats for the bundles listing page. Always reports:
   *  - total_clicks: lifetime sum across every bundle link (no time filter).
   *  - delta_pct: trend of last 30 days vs the preceding 30 days, to give
   *    users a fixed trend reading regardless of a range picker.
   *  - sparkline: 30 daily buckets covering the last 30 days.
   *  - top_links: top 3 member links by lifetime click count.
   */
  static async getBundleSummariesBulk(
    db: D1Database,
    bundleIds: number[],
    now?: number,
  ): Promise<Map<number, { total_clicks: number; delta_pct?: number; sparkline: number[]; top_links: { slug: string; click_count: number }[] }>> {
    const out = new Map<number, { total_clicks: number; delta_pct?: number; sparkline: number[]; top_links: { slug: string; click_count: number }[] }>();
    for (const id of bundleIds) {
      out.set(id, { total_clicks: 0, sparkline: [], top_links: [] });
    }
    if (bundleIds.length === 0) return out;

    const ts = now ?? Math.floor(Date.now() / 1000);
    const phBundles = bundleIds.map(() => "?").join(",");
    const span30d = 30 * 86400;
    const currStart = ts - span30d;
    const prevStart = ts - 2 * span30d;
    const sparkSpec = getBucketSpec("30d", ts);

    // Lifetime totals per bundle.
    const totalRows = await db
      .prepare(
        `SELECT bl.bundle_id as bundle_id, COUNT(*) as cnt
         FROM clicks c
         JOIN bundle_links bl ON bl.link_id = (SELECT link_id FROM slugs WHERE slug = c.slug)
         WHERE bl.bundle_id IN (${phBundles})
         GROUP BY bl.bundle_id`,
      )
      .bind(...bundleIds)
      .all<{ bundle_id: number; cnt: number }>();
    for (const r of totalRows.results ?? []) {
      out.get(r.bundle_id)!.total_clicks = r.cnt;
    }

    // 30d / previous 30d for fixed trend reading.
    const [curRows, prevRows] = await Promise.all([
      db
        .prepare(
          `SELECT bl.bundle_id as bundle_id, COUNT(*) as cnt
           FROM clicks c
           JOIN bundle_links bl ON bl.link_id = (SELECT link_id FROM slugs WHERE slug = c.slug)
           WHERE c.clicked_at >= ? AND bl.bundle_id IN (${phBundles})
           GROUP BY bl.bundle_id`,
        )
        .bind(currStart, ...bundleIds)
        .all<{ bundle_id: number; cnt: number }>(),
      db
        .prepare(
          `SELECT bl.bundle_id as bundle_id, COUNT(*) as cnt
           FROM clicks c
           JOIN bundle_links bl ON bl.link_id = (SELECT link_id FROM slugs WHERE slug = c.slug)
           WHERE c.clicked_at >= ? AND c.clicked_at < ? AND bl.bundle_id IN (${phBundles})
           GROUP BY bl.bundle_id`,
        )
        .bind(prevStart, currStart, ...bundleIds)
        .all<{ bundle_id: number; cnt: number }>(),
    ]);
    const curMap = new Map((curRows.results ?? []).map((r) => [r.bundle_id, r.cnt]));
    const prevMap = new Map((prevRows.results ?? []).map((r) => [r.bundle_id, r.cnt]));
    for (const [bundleId, entry] of out) {
      entry.delta_pct = computeDelta(curMap.get(bundleId) ?? 0, prevMap.get(bundleId) ?? 0);
    }

    // 30 daily sparkline buckets per bundle.
    const sparkRows = await db
      .prepare(
        `SELECT bl.bundle_id as bundle_id, ${sparkSpec.bucketExpr("c.clicked_at")} as label, COUNT(*) as value
         FROM clicks c
         JOIN bundle_links bl ON bl.link_id = (SELECT link_id FROM slugs WHERE slug = c.slug)
         WHERE c.clicked_at >= ? AND bl.bundle_id IN (${phBundles})
         GROUP BY bl.bundle_id, label
         ORDER BY label ASC`,
      )
      .bind(sparkSpec.since!, ...bundleIds)
      .all<{ bundle_id: number; label: string; value: number }>();
    const sparkByBundle = new Map<number, { label: string; value: number }[]>();
    for (const r of sparkRows.results ?? []) {
      const arr = sparkByBundle.get(r.bundle_id) ?? [];
      arr.push({ label: r.label, value: r.value });
      sparkByBundle.set(r.bundle_id, arr);
    }
    for (const [bundleId, entry] of out) {
      entry.sparkline = fillSparkline(sparkByBundle.get(bundleId) ?? [], sparkSpec, "30d", ts);
    }

    // Top 3 links per bundle by lifetime clicks.
    const topRows = await db
      .prepare(
        `WITH per_link AS (
           SELECT bl.bundle_id as bundle_id, s.link_id as link_id, COUNT(*) as cnt
           FROM clicks c
           JOIN slugs s ON s.slug = c.slug
           JOIN bundle_links bl ON bl.link_id = s.link_id
           WHERE bl.bundle_id IN (${phBundles})
           GROUP BY bl.bundle_id, s.link_id
         ),
         ranked AS (
           SELECT bundle_id, link_id, cnt,
                  ROW_NUMBER() OVER (PARTITION BY bundle_id ORDER BY cnt DESC) as rn
           FROM per_link
         )
         SELECT r.bundle_id as bundle_id, r.cnt as cnt,
                (SELECT slug FROM slugs WHERE link_id = r.link_id AND is_primary = 1 LIMIT 1) as primary_slug
         FROM ranked r
         WHERE r.rn <= 3
         ORDER BY r.bundle_id, r.cnt DESC`,
      )
      .bind(...bundleIds)
      .all<{ bundle_id: number; cnt: number; primary_slug: string | null }>();
    for (const r of topRows.results ?? []) {
      const entry = out.get(r.bundle_id);
      if (!entry) continue;
      entry.top_links.push({ slug: r.primary_slug ?? "", click_count: r.cnt });
    }

    return out;
  }
}

function countDistinctHosts(rows: { url: string }[]): number {
  const hosts = new Set<string>();
  for (const r of rows) {
    try {
      hosts.add(new URL(r.url).hostname);
    } catch {
      // Skip malformed URLs rather than fail the whole stats query.
    }
  }
  return hosts.size;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

interface BucketSpec {
  /** Builds the SQL grouping expression for a given timestamp column. */
  bucketExpr: (column: string) => string;
  /** Unix seconds floor; null means unbounded (range === "all"). */
  since: number | null;
  /** Number of buckets to emit in the output series. */
  buckets: number;
  /** Approximate bucket width; used to walk backwards when zero-filling. */
  stepSec: number;
}

function getBucketSpec(range: TimelineRange, ts: number): BucketSpec {
  switch (range) {
    case "24h":
      return {
        bucketExpr: (c) => `strftime('%Y-%m-%d %H', ${c}, 'unixepoch')`,
        since: ts - 86400,
        buckets: 24,
        stepSec: 3600,
      };
    case "7d":
      return {
        bucketExpr: (c) => `date(${c}, 'unixepoch')`,
        since: ts - 7 * 86400,
        buckets: 7,
        stepSec: 86400,
      };
    case "30d":
      return {
        bucketExpr: (c) => `date(${c}, 'unixepoch')`,
        since: ts - 30 * 86400,
        buckets: 30,
        stepSec: 86400,
      };
    case "90d":
      return {
        bucketExpr: (c) => `date(${c}, 'unixepoch')`,
        since: ts - 90 * 86400,
        buckets: 90,
        stepSec: 86400,
      };
    case "1y":
      return {
        bucketExpr: (c) => `strftime('%Y-%m', ${c}, 'unixepoch')`,
        since: ts - 365 * 86400,
        buckets: 12,
        stepSec: 30 * 86400,
      };
    case "all":
    default:
      return {
        bucketExpr: (c) => `strftime('%Y-%m', ${c}, 'unixepoch')`,
        since: null,
        buckets: 12,
        stepSec: 30 * 86400,
      };
  }
}

function sparkLabelAt(range: TimelineRange, t: number): string {
  const d = new Date(t * 1000);
  if (range === "24h") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}`;
  }
  if (range === "1y" || range === "all") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function fillSparkline(
  rows: { label: string; value: number }[],
  spec: BucketSpec,
  range: TimelineRange,
  ts: number,
): number[] {
  const map = new Map(rows.map((r) => [r.label, r.value]));
  const out: number[] = [];
  for (let i = spec.buckets - 1; i >= 0; i--) {
    const t = ts - i * spec.stepSec;
    out.push(map.get(sparkLabelAt(range, t)) ?? 0);
  }
  return out;
}

function fillBuckets(
  range: TimelineRange,
  dataMap: Map<string, number>,
  now: number,
  sinceTs: number | null,
): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];

  if (range === "24h") {
    // 24 hourly buckets
    for (let i = 23; i >= 0; i--) {
      const t = now - i * 3600;
      const d = new Date(t * 1000);
      const label = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}`;
      buckets.push({ label, count: dataMap.get(label) ?? 0 });
    }
    return buckets;
  }

  if (range === "7d" || range === "30d" || range === "90d") {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    for (let i = days - 1; i >= 0; i--) {
      const t = now - i * 86400;
      const d = new Date(t * 1000);
      const label = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
      buckets.push({ label, count: dataMap.get(label) ?? 0 });
    }
    return buckets;
  }

  if (range === "1y") {
    // ~52 weekly buckets (Mondays)
    // Start from the Monday before or on (now - 365 days)
    const start = new Date((now - 365 * 86400) * 1000);
    const startDay = start.getUTCDay(); // 0=Sun
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    start.setUTCDate(start.getUTCDate() + mondayOffset);
    const end = new Date(now * 1000);
    const cursor = new Date(start);
    while (cursor <= end) {
      const label = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`;
      buckets.push({ label, count: dataMap.get(label) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return buckets;
  }

  return buckets;
}

function fillBucketsAll(
  dataMap: Map<string, number>,
  now: number,
  earliest: number,
  kind: "daily" | "weekly" | "monthly",
): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];
  if (dataMap.size === 0) return buckets;

  if (kind === "daily") {
    const start = new Date(earliest * 1000);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now * 1000);
    end.setUTCHours(0, 0, 0, 0);
    const cursor = new Date(start);
    while (cursor <= end) {
      const label = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`;
      buckets.push({ label, count: dataMap.get(label) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return buckets;
  }

  if (kind === "weekly") {
    // Weekly buckets (Mondays) from earliest to now
    const start = new Date(earliest * 1000);
    const startDay = start.getUTCDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    start.setUTCDate(start.getUTCDate() + mondayOffset);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now * 1000);
    const cursor = new Date(start);
    while (cursor <= end) {
      const label = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`;
      buckets.push({ label, count: dataMap.get(label) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return buckets;
  }

  // monthly
  const keys = [...dataMap.keys()].sort();
  const firstMonth = keys[0];
  const nowDate = new Date(now * 1000);
  const endMonth = `${nowDate.getUTCFullYear()}-${pad2(nowDate.getUTCMonth() + 1)}`;
  let [y, m] = firstMonth.split("-").map(Number);
  const [endY, endM] = endMonth.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    const label = `${y}-${pad2(m)}`;
    buckets.push({ label, count: dataMap.get(label) ?? 0 });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return buckets;
}
