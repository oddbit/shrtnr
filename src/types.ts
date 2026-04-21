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
}

export interface ClickStats {
  total_clicks: number;
  countries: { name: string; count: number }[];
  referrers: { name: string; count: number }[];
  referrer_hosts: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  os: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  link_modes: { name: string; count: number }[];
  channels: { name: string; count: number }[];
  clicks_over_time: { date: string; count: number }[];
  slug_clicks: { slug: string; count: number }[];
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
  /** Percent change in distinct-domain count vs previous period. Undefined when the previous period is zero. */
  num_domains_delta?: number;
  /** Timeline sparkline — counts per bucket within the current period. */
  timeline: number[];
  recent_links: LinkWithSlugs[];
  top_links: LinkWithSlugs[];
  top_countries: { name: string; count: number }[];
  top_referrers: { name: string; count: number }[];
}
