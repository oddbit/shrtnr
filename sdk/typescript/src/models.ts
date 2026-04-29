// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// ---- Enums ----

export type TimelineRange = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

export type BundleAccent = "orange" | "red" | "green" | "blue" | "purple";

// ---- Core models ----

export interface Slug {
  linkId: number;
  slug: string;
  isCustom: number;
  isPrimary: number;
  clickCount: number;
  createdAt: number;
  disabledAt: number | null;
}

export interface Link {
  id: number;
  url: string;
  label: string | null;
  createdAt: number;
  expiresAt: number | null;
  createdVia: string | null;
  createdBy: string;
  slugs: Slug[];
  totalClicks: number;
  deltaPct?: number;
}

export interface Bundle {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  accent: BundleAccent;
  archivedAt: number | null;
  createdVia: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/// A top-link entry preview shown in a BundleWithSummary.
export interface BundleTopLink {
  slug: string;
  clickCount: number;
}

export interface BundleWithSummary extends Bundle {
  linkCount: number;
  totalClicks: number;
  deltaPct?: number;
  sparkline: number[];
  topLinks: BundleTopLink[];
}

// ---- Analytics models ----

export interface NameCount {
  name: string;
  count: number;
}

/// A date/count pair in a click timeline.
export interface DateCount {
  date: string;
  count: number;
}

/// A slug/count pair in a per-slug analytics breakdown.
export interface SlugCount {
  slug: string;
  count: number;
}

export interface ClickStats {
  totalClicks: number;
  countries: NameCount[];
  referrers: NameCount[];
  referrerHosts: NameCount[];
  devices: NameCount[];
  os: NameCount[];
  browsers: NameCount[];
  linkModes: NameCount[];
  channels: NameCount[];
  clicksOverTime: DateCount[];
  slugClicks: SlugCount[];
  numCountries: number;
  numReferrers: number;
  numReferrerHosts: number;
  numOs: number;
  numBrowsers: number;
}

export interface TimelineBucket {
  label: string;
  count: number;
}

export interface TimelineData {
  range: TimelineRange;
  buckets: TimelineBucket[];
  summary: {
    last24h: number;
    last7d: number;
    last30d: number;
    last90d: number;
    last1y: number;
  };
}

// ---- Request body types ----

export interface CreateLinkBody {
  url: string;
  label?: string;
  slugLength?: number;
  expiresAt?: number;
  allowDuplicate?: boolean;
}

export interface UpdateLinkBody {
  url?: string;
  label?: string | null;
  expiresAt?: number | null;
}

export interface AddSlugBody {
  slug: string;
}

export interface CreateBundleBody {
  name: string;
  description?: string | null;
  icon?: string | null;
  accent?: BundleAccent;
}

export interface UpdateBundleBody {
  name?: string;
  description?: string | null;
  icon?: string | null;
  accent?: BundleAccent;
}

// ---- Result types ----

/// Result of a delete operation.
export interface DeletedResult {
  deleted: boolean;
}

/// Result of an add-link-to-bundle operation.
export interface AddedResult {
  added: boolean;
}

/// Result of a remove-link-from-bundle or remove-slug operation.
export interface RemovedResult {
  removed: boolean;
}
