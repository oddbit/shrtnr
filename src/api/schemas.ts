// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { z } from "@hono/zod-openapi";
import type { Hook } from "@hono/zod-openapi";
import { formatZodError } from "./response";

// ---- Common ----

export const ErrorResponseSchema = z
  .object({ error: z.string() })
  .strict()
  .openapi("ErrorResponse", { description: "Error response with a single human-readable message." });

export const TIMELINE_RANGES = ["24h", "7d", "30d", "90d", "1y", "all"] as const;

export const RangeQuerySchema = z
  .object({
    range: z.enum(TIMELINE_RANGES).optional()
      .openapi({ description: "Time range for analytics. Defaults are documented per endpoint." }),
  })
  .openapi("RangeQuery");

export const IdParamSchema = z
  .object({
    id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" }, example: 42 }),
  })
  .openapi("IdParam");

// ---- Slug (resource) ----

export const SlugSchema = z
  .object({
    link_id: z.number().int(),
    slug: z.string(),
    is_custom: z.number().int(),
    is_primary: z.number().int(),
    click_count: z.number().int().nonnegative(),
    created_at: z.number().int(),
    disabled_at: z.number().int().nullable(),
  })
  .openapi("Slug", { description: "A slug attached to a link." });

// ---- Link ----

export const LinkSchema = z
  .object({
    id: z.number().int().openapi({ example: 42 }),
    url: z.string().url().max(2048).openapi({ example: "https://example.com/long-url" }),
    label: z.string().nullable().openapi({ example: "Marketing landing" }),
    created_at: z.number().int(),
    expires_at: z.number().int().nullable().openapi({ description: "Unix seconds; null means no expiry." }),
    created_via: z.string().nullable(),
    created_by: z.string(),
    slugs: z.array(SlugSchema),
    total_clicks: z.number().int().nonnegative().openapi({ example: 137 }),
    delta_pct: z.number().optional().openapi({ description: "Click count change as percentage. Optional; absent when comparison data is unavailable." }),
  })
  .openapi("Link", { description: "A short link with its slugs, total click count, and metadata." });

export const CreateLinkBodySchema = z
  .object({
    url: z.string().url().max(2048),
    label: z.string().optional(),
    slug_length: z.number().int().min(3).max(16).optional(),
    expires_at: z.number().int().nonnegative().optional(),
    allow_duplicate: z.boolean().optional(),
  })
  .strict()
  .openapi("CreateLinkBody");

export const UpdateLinkBodySchema = z
  .object({
    url: z.string().url().max(2048).optional(),
    label: z.string().nullable().optional(),
    expires_at: z.number().int().nonnegative().nullable().optional(),
  })
  .strict()
  .openapi("UpdateLinkBody");

// ---- Slug (request) ----

// Mirrors validateCustomSlug() in src/slugs.ts after server-side lowercase
// normalization: must start and end with alphanumeric, hyphens allowed in the
// middle, no underscores, no leading/trailing hyphens.
export const CustomSlugStringSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i);

export const AddSlugBodySchema = z
  .object({
    slug: CustomSlugStringSchema,
  })
  .strict()
  .openapi("AddSlugBody");

export const SlugParamSchema = z
  .object({
    slug: z.string().regex(/^[a-zA-Z0-9_-]+$/).openapi({ param: { name: "slug", in: "path" } }),
  })
  .openapi("SlugParam");

// ---- Bundle ----

export const BUNDLE_ACCENTS = ["orange", "red", "green", "blue", "purple"] as const;
export const BundleAccentSchema = z.enum(BUNDLE_ACCENTS);

export const BundleSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    accent: BundleAccentSchema,
    archived_at: z.number().int().nullable(),
    created_via: z.string().nullable(),
    created_by: z.string(),
    created_at: z.number().int(),
    updated_at: z.number().int(),
  })
  .openapi("Bundle");

export const BundleWithSummarySchema = BundleSchema
  .extend({
    link_count: z.number().int().nonnegative(),
    total_clicks: z.number().int().nonnegative(),
    delta_pct: z.number().optional(),
    sparkline: z.array(z.number().int().nonnegative()),
    top_links: z.array(
      z.object({ slug: z.string(), click_count: z.number().int().nonnegative() }),
    ),
  })
  .openapi("BundleWithSummary", { description: "Bundle with aggregated click and link counts." });

export const CreateBundleBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    accent: BundleAccentSchema.optional(),
  })
  .strict()
  .openapi("CreateBundleBody");

export const UpdateBundleBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    accent: BundleAccentSchema.optional(),
  })
  .strict()
  .openapi("UpdateBundleBody");

export const AddBundleLinkBodySchema = z
  .object({
    link_id: z.number().int().positive(),
  })
  .strict()
  .openapi("AddBundleLinkBody");

export const ArchivedQuerySchema = z
  .object({
    archived: z.enum(["true", "1", "only", "all"]).optional()
      .openapi({ description: "true|1|only -> archived only. all -> include archived. Omit -> active only." }),
  })
  .openapi("ArchivedQuery");

// ---- Analytics (responses) ----
// These schemas match ClickStats and TimelineData from src/types.ts.

export const NameCountBucketSchema = z
  .object({ name: z.string(), count: z.number().int().nonnegative() })
  .openapi("NameCountBucket");

export const ClickStatsSchema = z
  .object({
    total_clicks: z.number().int().nonnegative(),
    countries: z.array(NameCountBucketSchema),
    referrers: z.array(NameCountBucketSchema),
    referrer_hosts: z.array(NameCountBucketSchema),
    devices: z.array(NameCountBucketSchema),
    os: z.array(NameCountBucketSchema),
    browsers: z.array(NameCountBucketSchema),
    link_modes: z.array(NameCountBucketSchema),
    channels: z.array(NameCountBucketSchema),
    clicks_over_time: z.array(z.object({ date: z.string(), count: z.number().int().nonnegative() })),
    slug_clicks: z.array(z.object({ slug: z.string(), count: z.number().int().nonnegative() })),
    num_countries: z.number().int().nonnegative(),
    num_referrers: z.number().int().nonnegative(),
    num_referrer_hosts: z.number().int().nonnegative(),
    num_os: z.number().int().nonnegative(),
    num_browsers: z.number().int().nonnegative(),
  })
  .openapi("ClickStats", { description: "Per-link click analytics breakdown." });

export const TimelineBucketSchema = z
  .object({ label: z.string(), count: z.number().int().nonnegative() })
  .openapi("TimelineBucket");

export const TimelineDataSchema = z
  .object({
    range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]),
    buckets: z.array(TimelineBucketSchema),
    summary: z.object({
      last_24h: z.number().int().nonnegative(),
      last_7d: z.number().int().nonnegative(),
      last_30d: z.number().int().nonnegative(),
      last_90d: z.number().int().nonnegative(),
      last_1y: z.number().int().nonnegative(),
    }),
  })
  .openapi("TimelineData", { description: "Click timeline with bucketed counts and period summaries." });

// ---- Param hook for routes with path params ----
// Path-param failures return 404 (preserving the 404-on-NaN contract).
// Body and query failures return 400 with a human-readable message.
// Use as the third argument to `app.openapi(route, handler, paramHook)`.
export const paramHook: Hook<any, any, any, any> = (result, c) => {
  if (result.success) return;
  if (result.target === "param") return c.json({ error: "Not Found" }, 404);
  return c.json({ error: formatZodError(result.error) }, 400);
};
