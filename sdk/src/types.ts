// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// ---- Auth ----

export interface ApiKeyAuth {
  apiKey: string;
}

export type ShrtnrAuth = ApiKeyAuth;

export interface ShrtnrConfig {
  baseUrl: string;
  auth: ShrtnrAuth;
}

// ---- API Models ----

export interface Slug {
  id: number;
  link_id: number;
  slug: string;
  is_custom: number;
  click_count: number;
  created_at: number;
}

export interface Link {
  id: number;
  url: string;
  label: string | null;
  created_at: number;
  expires_at: number | null;
  created_via: string | null;
  slugs: Slug[];
  total_clicks: number;
}

export interface ClickStats {
  total_clicks: number;
  countries: NameCount[];
  referrers: NameCount[];
  devices: NameCount[];
  browsers: NameCount[];
  channels: NameCount[];
  clicks_over_time: DateCount[];
}

export interface NameCount {
  name: string;
  count: number;
}

export interface DateCount {
  date: string;
  count: number;
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
  custom_slug?: string;
  expires_at?: number;
}

export interface UpdateLinkOptions {
  url?: string;
  label?: string | null;
  expires_at?: number | null;
}

