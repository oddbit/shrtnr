// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { ClickData, ClickStats, DashboardStats, TimelineBucket, TimelineData, TimelineRange } from "../types";
import { LinkRepository } from "./link-repository";

export class ClickRepository {
  static async record(
    db: D1Database,
    slugId: number,
    data: ClickData = {},
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const mode = data.linkMode ?? "link";
    await db
      .prepare(
        `INSERT INTO clicks (slug_id, clicked_at, referrer, referrer_host, country, region, city, device_type, os, browser, language, link_mode, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content, user_agent, is_bot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        slugId,
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
      )
      .run();
  }

  static async getStats(db: D1Database, linkId: number, range?: TimelineRange): Promise<ClickStats> {
    const slugIds = await db
      .prepare("SELECT id FROM slugs WHERE link_id = ?")
      .bind(linkId)
      .all<{ id: number }>();
    const ids = (slugIds.results ?? []).map((r) => r.id);

    const empty: ClickStats = { total_clicks: 0, countries: [], referrers: [], referrer_hosts: [], devices: [], os: [], browsers: [], link_modes: [], channels: [], clicks_over_time: [], slug_clicks: [] };
    if (ids.length === 0) return empty;

    const placeholders = ids.map(() => "?").join(",");
    let where = `slug_id IN (${placeholders})`;
    const binds: (string | number)[] = [...ids];

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
      db.prepare(`SELECT slug_id, COUNT(*) as count FROM clicks WHERE ${where} GROUP BY slug_id`).bind(...binds).all<{ slug_id: number; count: number }>(),
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
    const slugIds = await db
      .prepare("SELECT id FROM slugs WHERE link_id = ?")
      .bind(linkId)
      .all<{ id: number }>();
    const ids = (slugIds.results ?? []).map((r) => r.id);

    const empty: TimelineData = {
      range,
      buckets: [],
      summary: { last_24h: 0, last_7d: 0, last_30d: 0, last_90d: 0, last_1y: 0 },
    };
    if (ids.length === 0) return empty;

    const placeholders = ids.map(() => "?").join(",");
    const where = `slug_id IN (${placeholders})`;

    // Summary counts
    const t24h = ts - 86400;
    const t7d = ts - 7 * 86400;
    const t30d = ts - 30 * 86400;
    const t90d = ts - 90 * 86400;
    const t1y = ts - 365 * 86400;
    const [last24h, last7d, last30d, last90d, last1y] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...ids, t24h).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...ids, t7d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...ids, t30d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...ids, t90d).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM clicks WHERE ${where} AND clicked_at >= ?`).bind(...ids, t1y).first<{ cnt: number }>(),
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
      case "all":
        // monthly buckets: "YYYY-MM"
        bucketExpr = "strftime('%Y-%m', clicked_at, 'unixepoch')";
        sinceTs = null;
        break;
    }

    const timeFilter = sinceTs !== null ? ` AND clicked_at >= ?` : "";
    const binds = sinceTs !== null ? [...ids, sinceTs] : [...ids];

    const rows = await db
      .prepare(
        `SELECT ${bucketExpr} as label, COUNT(*) as count
         FROM clicks WHERE ${where}${timeFilter}
         GROUP BY label ORDER BY label ASC`,
      )
      .bind(...binds)
      .all<{ label: string; count: number }>();

    const dataMap = new Map((rows.results ?? []).map((r) => [r.label, r.count]));

    const buckets = fillBuckets(range, dataMap, ts, sinceTs);

    return { range, buckets, summary };
  }

  static async getDashboardStats(db: D1Database): Promise<DashboardStats> {
    const [linkCount, clickCount, recentLinks, topCountries, topReferrers] = await Promise.all([
      db.prepare("SELECT COUNT(*) as cnt FROM links").first<{ cnt: number }>(),
      db.prepare("SELECT COUNT(*) as cnt FROM clicks").first<{ cnt: number }>(),
      LinkRepository.list(db),
      db.prepare("SELECT country as name, COUNT(*) as count FROM clicks WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 5").all<{ name: string; count: number }>(),
      db.prepare("SELECT referrer_host as name, COUNT(*) as count FROM clicks WHERE referrer_host IS NOT NULL GROUP BY referrer_host ORDER BY count DESC LIMIT 5").all<{ name: string; count: number }>(),
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
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
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

  // "all": monthly buckets from earliest data to now
  if (dataMap.size === 0) return buckets;
  const keys = [...dataMap.keys()].sort();
  const firstMonth = keys[0]; // "YYYY-MM"
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
