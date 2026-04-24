// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export interface Env {
  DB: D1Database;
  SLUG_KV?: KVNamespace;

  // Cloudflare Access JWT audience tags
  ACCESS_AUD: string;       // AUD tag from the admin CF Access application
  MCP_ACCESS_AUD: string;   // AUD tag from the MCP CF Access application (Managed OAuth)
  ACCESS_JWKS_URL: string;  // https://<team>.cloudflareaccess.com/cdn-cgi/access/certs

  // Dev-only: set to bypass login and assume this identity (e.g. "dev@local")
  DEV_IDENTITY?: string;

  // Durable Object binding for MCP agent
  MCP_OBJECT: DurableObjectNamespace;

  // Optional secret used to derive the daily visitor-fingerprint salt.
  // When unset, a deterministic per-day fallback is used. Set via
  // `wrangler secret put FP_SALT` in production for unpredictability.
  FP_SALT?: string;
}

export interface Link {
  id: number;
  url: string;
  label: string | null;
  created_at: number;
  expires_at: number | null;
  created_via: string | null;
  created_by: string;
}

export interface Slug {
  link_id: number;
  slug: string;
  is_custom: number;
  is_primary: number;
  click_count: number;
  created_at: number;
  disabled_at: number | null;
}

export interface LinkWithSlugs extends Link {
  slugs: Slug[];
  total_clicks: number;
  /** Percent change in clicks vs the previous equivalent period. Optional. */
  delta_pct?: number;
}

export interface ClickData {
  referrer?: string | null;
  referrerHost?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  deviceType?: string | null;
  os?: string | null;
  browser?: string | null;
  language?: string | null;
  linkMode?: string;
  channel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  userAgent?: string | null;
  isBot?: number;
  /**
   * 1 when the Referer was the bare origin of the serving host
   * (e.g. `https://<host>/`). Used to hide noisy self-referrer rows
   * from Sources and Domains breakdowns while keeping the click in
   * raw totals. Ingest captures the signal; query layer decides how
   * to display it.
   */
  isSelfReferrer?: number;
  /** Silent daily-rotated visitor fingerprint; not exposed in any UI. */
  visitorFp?: string | null;
}

export interface ClickStats {
  total_clicks: number;
  countries: { name: string; count: number }[];
  /** Referrers as full URLs (unique per exact URL). Shown as "Sources". */
  referrers: { name: string; count: number }[];
  /** Referrers grouped by hostname. Shown as "Domains". */
  referrer_hosts: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  os: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  link_modes: { name: string; count: number }[];
  channels: { name: string; count: number }[];
  clicks_over_time: { date: string; count: number }[];
  slug_clicks: { slug: string; count: number }[];
  /** Distinct count totals for dimensions that may exceed the list LIMIT. */
  num_countries: number;
  num_referrers: number;
  num_referrer_hosts: number;
  num_os: number;
  num_browsers: number;
}

export type TimelineRange = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

export interface TimelineBucket {
  label: string;
  count: number;
}

export interface TimelineData {
  range: TimelineRange;
  buckets: TimelineBucket[];
  summary: {
    last_24h: number;
    last_7d: number;
    last_30d: number;
    last_90d: number;
    last_1y: number;
  };
}

export type BundleAccent = "orange" | "red" | "green" | "blue" | "purple";

export interface Bundle {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  accent: BundleAccent;
  archived_at: number | null;
  created_via: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface BundleWithSummary extends Bundle {
  link_count: number;
  total_clicks: number;
  delta_pct?: number;
  sparkline: number[];
  top_links: { slug: string; click_count: number }[];
}

export interface BundleStatsPerLink {
  link_id: number;
  label: string | null;
  primary_slug: string;
  url: string;
  click_count: number;
  pct_of_bundle: number;
  delta_pct?: number;
}

export interface BundleStats {
  bundle: Bundle;
  link_count: number;
  total_clicks: number;
  delta_pct?: number;
  clicked_links: number;
  top_performer?: { slug: string; label: string | null; click_count: number; pct_of_bundle: number };
  countries_reached: number;
  top_country?: { name: string; pct: number };
  timeline: TimelineData;
  countries: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  os: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  /** Referrers as full URLs (unique per exact URL). Shown as "Sources". */
  referrers: { name: string; count: number }[];
  /** Referrers grouped by hostname. Shown as "Domains". */
  referrer_hosts: { name: string; count: number }[];
  link_modes: { name: string; count: number }[];
  per_link: BundleStatsPerLink[];
  num_countries: number;
  num_referrers: number;
  num_referrer_hosts: number;
  num_os: number;
  num_browsers: number;
}

export interface DashboardStats {
  range: TimelineRange;
  /** Links created in the current period; lifetime when range is "all". */
  total_links: number;
  total_clicks: number;
  /** Clicks in the immediately previous equivalent period. */
  total_clicks_previous: number;
  /** Percent change vs previous period. Undefined when the previous period is zero (no baseline). */
  total_clicks_delta?: number;
  /** Percent change in new-link creation rate vs previous period. Undefined when the previous period is zero. */
  new_links_delta?: number;
  /** Average clicks per day within the current period, rounded. */
  clicks_per_day: number;
  /** Percent change in daily click rate vs previous period. Undefined when the previous period is zero. */
  clicks_per_day_delta?: number;
  /** Distinct destination domains among links created in the current period; lifetime when range is "all". */
  num_domains: number;
  /** Distinct click-origin countries in the current period; lifetime when range is "all". */
  num_countries: number;
  /** Distinct links that received at least one click in the current period; lifetime when range is "all". */
  clicked_links: number;
  /** Percent change in clicked-link count vs previous period. Undefined when the previous period is zero. */
  clicked_links_delta?: number;
  /** Clicks-per-bucket sparkline for the current period. */
  timeline: number[];
  /** New-links-per-bucket sparkline for the current period. */
  timeline_links: number[];
  /** Clicked-links-per-bucket sparkline (distinct link count per bucket). */
  timeline_clicked_links: number[];
  recent_links: LinkWithSlugs[];
  top_links: LinkWithSlugs[];
  top_countries: { name: string; count: number }[];
  /** Top referrer hostnames. Shown as "Top Domains". */
  top_referrers: { name: string; count: number }[];
  /** Distinct count of referrer hostnames in the current period. */
  num_referrers: number;
}
