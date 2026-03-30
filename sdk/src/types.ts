// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// ---- Auth ----

export interface ApiKeyAuth {
  apiKey: string;
}

export interface AccessTokenAuth {
  accessToken: string;
}

export type ShrtnrAuth = ApiKeyAuth | AccessTokenAuth;

export interface ShrtnrConfig {
  baseUrl: string;
  auth: ShrtnrAuth;
}

// ---- API Models ----

export interface Slug {
  id: number;
  link_id: number;
  slug: string;
  is_vanity: number;
  click_count: number;
  created_at: number;
}

export interface Link {
  id: number;
  url: string;
  label: string | null;
  created_at: number;
  expires_at: number | null;
  slugs: Slug[];
  total_clicks: number;
}

export interface ClickStats {
  total_clicks: number;
  countries: NameCount[];
  referrers: NameCount[];
  devices: NameCount[];
  browsers: NameCount[];
  clicks_over_time: DateCount[];
}

export interface DashboardStats {
  total_links: number;
  total_clicks: number;
  recent_links: Link[];
  top_links: Link[];
  top_countries: NameCount[];
  top_referrers: NameCount[];
}

export interface NameCount {
  name: string;
  count: number;
}

export interface DateCount {
  date: string;
  count: number;
}

export interface ApiKey {
  id: number;
  email: string;
  title: string;
  key_prefix: string;
  scope: string;
  created_at: number;
  last_used_at: number | null;
}

export interface CreatedApiKey {
  key: ApiKey;
  raw_key: string;
}

export interface Settings {
  slug_default_length: number;
}

export interface HealthStatus {
  status: string;
  version: string;
  timestamp: number;
}

// ---- Request Bodies ----

export interface CreateLinkOptions {
  url: string;
  label?: string;
  slug_length?: number;
  vanity_slug?: string;
  expires_at?: number;
}

export interface UpdateLinkOptions {
  url?: string;
  label?: string | null;
  expires_at?: number | null;
}

export interface CreateApiKeyOptions {
  title: string;
  scope: "create" | "read" | "create,read";
}
