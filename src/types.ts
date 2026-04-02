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
  is_vanity: number;
  click_count: number;
  created_at: number;
}

export interface LinkWithSlugs extends Link {
  slugs: Slug[];
  total_clicks: number;
}

export interface ClickStats {
  total_clicks: number;
  countries: { name: string; count: number }[];
  referrers: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  channels: { name: string; count: number }[];
  clicks_over_time: { date: string; count: number }[];
}

export interface DashboardStats {
  total_links: number;
  total_clicks: number;
  recent_links: LinkWithSlugs[];
  top_links: LinkWithSlugs[];
  top_countries: { name: string; count: number }[];
  top_referrers: { name: string; count: number }[];
}
