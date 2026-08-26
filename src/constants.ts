// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 128;
export const DEFAULT_SLUG_LENGTH = MIN_SLUG_LENGTH;

export const TIMELINE_RANGES = ["24h", "7d", "30d", "90d", "1y", "all"] as const;
export const DEFAULT_TIMELINE_RANGE: (typeof TIMELINE_RANGES)[number] = "30d";

// Analytics panels that support pagination (countries, sources, domains).
// Browsers, OS, devices and access-method panels stay capped at the top entries.
// Names match the ClickStats / BundleStats field they page through.
export const PAGINATED_DIMENSIONS = ["countries", "referrers", "referrer_hosts"] as const;
export type PaginatedDimension = (typeof PAGINATED_DIMENSIONS)[number];

// Page size shared by the server (SQL LIMIT) and the admin client paginator.
export const BREAKDOWN_PAGE_SIZE = 10;
// Upper bound a single breakdown request may fetch.
export const MAX_BREAKDOWN_LIMIT = 100;

// D1 accepts at most this many bound parameters in one statement.
export const D1_MAX_BOUND_PARAMS = 100;

// Links listing page size. The options feed the per-page selector, and the
// maximum caps what a hand-edited per_page query can pull into one page so the
// route's cost stays bounded by the window, not by the catalog. LinkRepository
// .page() binds one parameter per served row to fetch its slugs, so no option
// may exceed D1_MAX_BOUND_PARAMS.
export const LINKS_PER_PAGE_OPTIONS = [25, 50, 100] as const;
export const LINKS_DEFAULT_PER_PAGE: (typeof LINKS_PER_PAGE_OPTIONS)[number] = 25;
export const LINKS_MAX_PER_PAGE = Math.max(...LINKS_PER_PAGE_OPTIONS);

export const THEMES = ["oddbit", "dark", "light"] as const;
export const DEFAULT_THEME: (typeof THEMES)[number] = "oddbit";

export const MAX_TITLE_LENGTH = 120;

export const MIN_QR_SIZE = 1;
export const MAX_QR_SIZE = 2048;
export const DEFAULT_QR_SIZE = 220;
