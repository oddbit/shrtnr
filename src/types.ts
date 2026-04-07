// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export interface Env {
  DB: D1Database;

  // OAuth / Cloudflare Access bindings
  OAUTH_KV: KVNamespace;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  ACCESS_TOKEN_URL: string;
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_JWKS_URL: string;
  COOKIE_ENCRYPTION_KEY: string;

  // Cloudflare Access JWT audience tag for admin routes
  ACCESS_AUD: string;

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
}

export interface Slug {
  id: number;
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
  total_links: number;
  total_clicks: number;
  recent_links: LinkWithSlugs[];
  top_links: LinkWithSlugs[];
  top_countries: { name: string; count: number }[];
  top_referrers: { name: string; count: number }[];
}
