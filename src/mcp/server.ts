// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";

/**
 * Identity props populated from Cloudflare Access headers.
 * With Managed OAuth, CF Access handles the OAuth protocol and
 * the Worker reads identity from the forwarded request headers.
 */
interface Props extends Record<string, unknown> {
  email: string;
}
import { handleHealth } from "../api/health";
import {
  listLinks,
  getLink,
  createLink,
  updateLink,
  disableLink,
  enableLink,
  deleteLink,
  addCustomSlugToLink,
  getLinkAnalytics,
  getLinkTimeline,
  getDashboardStats,
  searchLinks,
  listLinksByOwner,
} from "../services/link-management";
import {
  addLinkToBundle,
  archiveBundle,
  createBundle,
  deleteBundle,
  getBundle,
  getBundleAnalytics,
  listBundleLinks,
  listBundles,
  listBundlesForLink,
  removeLinkFromBundle,
  unarchiveBundle,
  updateBundle,
} from "../services/bundle-management";
import { resolveClickFilters, resolveMcpRange } from "../services/admin-management";
import {
  getTrendingLinks,
  getGlobalBreakdown,
  getTotalClicks,
  getLinkBreakdown,
  compareLinkStats,
} from "../services/analytics";
import type { TimelineRange } from "../types";
import { renderQrSvg } from "../qr";
import pkg from "../../package.json";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(error: string): ToolResult {
  return { content: [{ type: "text", text: error }], isError: true };
}

export const RANGE_LABELS: Record<TimelineRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "12 months",
  "all": "all time",
};

export function rangeNote(range: TimelineRange): string {
  return range === "all"
    ? "These results cover all clicks ever recorded. No time filter is applied."
    : `These results are scoped to the last ${RANGE_LABELS[range]}. Clicks outside this window are NOT included. Reuse the same range in follow-up calls to keep numbers comparable.`;
}

/**
 * Wrap an analytics payload so the LLM cannot miss the time-range scope.
 * The wrapper front-loads `range_used`, a human-readable `range_label`, and a
 * plain-English `range_note` before any of the data fields.
 */
export function okWithRange(range: TimelineRange, payload: unknown): ToolResult {
  const wrapper = {
    range_used: range,
    range_label: RANGE_LABELS[range],
    range_note: rangeNote(range),
  };
  const body =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...wrapper, ...(payload as Record<string, unknown>) }
      : { ...wrapper, data: payload };
  return ok(body);
}

const RANGE_VALUES = ["24h", "7d", "30d", "90d", "1y", "all"] as const;
const optionalRangeSchema = z
  .enum(RANGE_VALUES)
  .optional()
  .describe(
    "Time window for the query. Omit to use the user's `default_range` setting (fallback: 30d). Results are scoped to this window unless `all` is given. The response always echoes the resolved value as `range_used`.",
  );

const READ_ONLY = {
  readOnlyHint: true,
  openWorldHint: false,
} as const;

const WRITE_NEW = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const WRITE_IDEMPOTENT = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export class ShrtnrMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({ name: "shrtnr", version: pkg.version });

  private get identity(): string {
    if (!this.props) throw new Error("MCP agent invoked without identity props");
    return this.props.email;
  }

  async init() {
    this.server.registerTool(
      "health",
      {
        title: "Health check",
        description: "Check the shrtnr server health and current version",
        inputSchema: {},
        annotations: { title: "Health check", ...READ_ONLY },
      },
      async () => {
        const res = handleHealth();
        return ok(await res.json());
      },
    );

    this.server.registerTool(
      "list_links",
      {
        title: "List links",
        description: "List all short links with their slugs and lifetime click counts.",
        inputSchema: {},
        annotations: { title: "List links", ...READ_ONLY },
      },
      async () => {
        const result = await listLinks(this.env);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "get_link",
      {
        title: "Get link",
        description: "Get full details for a short link by its numeric ID.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
        },
        annotations: { title: "Get link", ...READ_ONLY },
      },
      async ({ link_id }) => {
        const result = await getLink(this.env, link_id);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "create_link",
      {
        title: "Create link",
        description:
          "Shorten a URL and create a short link. If the destination URL already exists, the existing link is returned with `duplicate: true`, so there is no need to search for the URL first. Optional custom slugs are attached after creation; slugs already in use are reported in `slug_rejections` rather than failing the call.",
        inputSchema: {
          url: z.string().url().describe("Destination URL to shorten"),
          label: z.string().optional().describe("Human-readable label for the link"),
          slug_length: z.number().int().min(3).optional().describe("Length of the random slug (default: 3)"),
          custom_slug: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe(
              "Custom slug(s), e.g. 'my-blog-post' or ['slug-a', 'slug-b']. Added after creation; collisions are reported, not fatal.",
            ),
          vanity_slug: z.string().optional().describe("Alias for custom_slug (single string)"),
          expires_at: z.number().int().optional().describe("Unix timestamp when the link expires"),
        },
        annotations: { title: "Create link", ...WRITE_NEW },
      },
      async ({ custom_slug, vanity_slug, ...opts }) => {
        const result = await createLink(this.env, { ...opts, created_via: "mcp", created_by: this.identity });
        if (!result.ok) return fail(result.error);

        const requestedSlugs = custom_slug
          ? Array.isArray(custom_slug)
            ? custom_slug
            : [custom_slug]
          : vanity_slug
            ? [vanity_slug]
            : [];

        const rejections: { slug: string; reason: string }[] = [];
        for (const slug of requestedSlugs) {
          const addResult = await addCustomSlugToLink(this.env, result.data.id, { slug });
          if (!addResult.ok) {
            rejections.push({ slug, reason: addResult.error });
          }
        }

        const link = requestedSlugs.length > 0 ? await getLink(this.env, result.data.id) : result;
        if (!link.ok) return fail(link.error);

        const response: Record<string, unknown> = { ...link.data, ...(result.meta ?? {}) };
        if (rejections.length > 0) response.slug_rejections = rejections;
        return ok(response);
      },
    );

    this.server.registerTool(
      "update_link",
      {
        title: "Update link",
        description: "Update the destination URL, label, or expiry of an existing short link.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link to update"),
          url: z.string().url().optional().describe("New destination URL"),
          label: z.string().nullable().optional().describe("New label (null removes it)"),
          expires_at: z.number().int().nullable().optional().describe("New expiry Unix timestamp (null removes it)"),
        },
        annotations: { title: "Update link", ...WRITE_IDEMPOTENT },
      },
      async ({ link_id, ...opts }) => {
        const result = await updateLink(this.env, link_id, opts);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "disable_link",
      {
        title: "Disable link",
        description: "Disable a short link so it stops redirecting. Only the link owner can disable it.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link to disable"),
        },
        annotations: { title: "Disable link", ...WRITE_IDEMPOTENT },
      },
      async ({ link_id }) => {
        const result = await disableLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "enable_link",
      {
        title: "Enable link",
        description: "Re-enable a disabled short link so it starts redirecting again. Only the link owner can enable it.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link to enable"),
        },
        annotations: { title: "Enable link", ...WRITE_IDEMPOTENT },
      },
      async ({ link_id }) => {
        const result = await enableLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "add_custom_slug",
      {
        title: "Add custom slug",
        description: "Add a custom slug to an existing link.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
          slug: z.string().min(1).describe("Custom slug to add, e.g. 'my-post'"),
        },
        annotations: { title: "Add custom slug", ...WRITE_NEW },
      },
      async ({ link_id, slug }) => {
        const result = await addCustomSlugToLink(this.env, link_id, { slug });
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "add_vanity_slug",
      {
        title: "Add vanity slug",
        description: "Add a custom slug (vanity URL) to an existing link. Alias for add_custom_slug.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
          slug: z.string().min(1).describe("Custom slug to add, e.g. 'my-post'"),
        },
        annotations: { title: "Add vanity slug", ...WRITE_NEW },
      },
      async ({ link_id, slug }) => {
        const result = await addCustomSlugToLink(this.env, link_id, { slug });
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "get_link_analytics",
      {
        title: "Link analytics",
        description:
          "Get click analytics for a short link: countries, referrers, devices, browsers, and daily click history. Results cover ONLY the requested time range; clicks outside this window are not included. Always read `range_used` in the response and reuse the same range across follow-up calls so numbers stay comparable. Defaults to the user's `default_range` setting (or 30d) when no range is given.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
          range: optionalRangeSchema,
        },
        annotations: { title: "Link analytics", ...READ_ONLY },
      },
      async ({ link_id, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const filters = await resolveClickFilters(this.env, this.identity);
        const result = await getLinkAnalytics(this.env, link_id, resolved, filters);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, result.data);
      },
    );

    this.server.registerTool(
      "search_links",
      {
        title: "Search links",
        description: "Search for short links by label, slug, URL, or creator email. Returns all links matching the query string.",
        inputSchema: {
          query: z.string().describe("Search term to match against link labels, slugs, URLs, and creator emails"),
        },
        annotations: { title: "Search links", ...READ_ONLY },
      },
      async ({ query }) => {
        const result = await searchLinks(this.env, query);
        if (!result.ok) return fail(result.error);
        if (result.data.length === 0) return ok({ results: [], message: "No links found matching that query." });
        return ok({ results: result.data, count: result.data.length });
      },
    );

    this.server.registerTool(
      "list_links_by_owner",
      {
        title: "List links by owner",
        description:
          "List all short links created by a specific user. Use this to find all links belonging to a particular team member.",
        inputSchema: {
          owner: z.string().describe("Email address of the link owner"),
        },
        annotations: { title: "List links by owner", ...READ_ONLY },
      },
      async ({ owner }) => {
        const result = await listLinksByOwner(this.env, owner);
        if (!result.ok) return fail(result.error);
        if (result.data.length === 0) return ok({ results: [], message: `No links found for ${owner}.` });
        return ok({ results: result.data, count: result.data.length });
      },
    );

    this.server.registerTool(
      "get_link_qr",
      {
        title: "Link QR code",
        description: "Get a QR code SVG for a short link. The QR encodes the short URL with a ?qr tracking parameter.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
          slug: z.string().optional().describe("Specific slug to use (defaults to custom slug or primary)"),
          base_url: z.string().url().describe("Base URL of the shrtnr instance, e.g. https://oddb.it"),
        },
        annotations: { title: "Link QR code", ...READ_ONLY },
      },
      async ({ link_id, slug: requestedSlug, base_url }) => {
        const result = await getLink(this.env, link_id);
        if (!result.ok) return fail(result.error);
        const link = result.data;

        const target = requestedSlug
          ? link.slugs.find((s) => s.slug === requestedSlug)
          : (link.slugs.find((s) => s.is_custom) ?? link.slugs[0]);

        if (!target) return fail("Slug not found");

        const qrUrl = `${base_url.replace(/\/+$/, "")}/${target.slug}?qr`;
        const svg = renderQrSvg(qrUrl, { size: 400 });
        if (!svg) return fail("Failed to generate QR code");

        const base64 = btoa(svg);
        return {
          content: [
            { type: "text" as const, text: `QR code for ${qrUrl}` },
            {
              type: "image" as const,
              data: base64,
              mimeType: "image/svg+xml",
            },
          ],
        };
      },
    );

    // ---- Analytics & insight tools ----

    const limitSchema = z.number().int().min(1).max(100).default(10).describe("Maximum number of results to return");
    const dimensionSchema = z
      .enum(["country", "referrer_host", "device_type", "os", "browser", "link_mode", "channel"])
      .describe("Dimension to group by");

    this.server.registerTool(
      "get_trending_links",
      {
        title: "Trending links",
        description:
          "Get the top links ranked by click count within a time window. Results cover ONLY the requested range; reuse the same range in follow-ups to keep rankings comparable. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          range: optionalRangeSchema,
          limit: limitSchema,
        },
        annotations: { title: "Trending links", ...READ_ONLY },
      },
      async ({ range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getTrendingLinks(this.env, resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, { results: result.data });
      },
    );

    this.server.registerTool(
      "get_dashboard_stats",
      {
        title: "Dashboard stats",
        description:
          "Get a high-level snapshot: total links, total clicks, top 5 links, top 5 countries, top 5 referrer hosts, and recent links. Every metric in the response is scoped to the requested range; reuse the same range in follow-up calls to keep numbers comparable. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          range: optionalRangeSchema,
        },
        annotations: { title: "Dashboard stats", ...READ_ONLY },
      },
      async ({ range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getDashboardStats(this.env, resolved, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, result.data);
      },
    );

    this.server.registerTool(
      "get_link_timeline",
      {
        title: "Link timeline",
        description:
          "Get time-bucketed click counts for a link with adaptive granularity. Buckets cover ONLY the requested range. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
          range: optionalRangeSchema,
        },
        annotations: { title: "Link timeline", ...READ_ONLY },
      },
      async ({ link_id, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const filters = await resolveClickFilters(this.env, this.identity);
        const result = await getLinkTimeline(this.env, link_id, resolved, filters);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, result.data);
      },
    );

    this.server.registerTool(
      "get_clicks_by_country",
      {
        title: "Clicks by country",
        description:
          "Get a cross-link geographic breakdown. Counts cover ONLY the requested range; clicks outside this window are not included. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          range: optionalRangeSchema,
          limit: limitSchema,
        },
        annotations: { title: "Clicks by country", ...READ_ONLY },
      },
      async ({ range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getGlobalBreakdown(this.env, "country", resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, { results: result.data });
      },
    );

    this.server.registerTool(
      "get_clicks_by_referrer",
      {
        title: "Clicks by referrer",
        description:
          "Get a cross-link referrer breakdown. Counts cover ONLY the requested range. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          range: optionalRangeSchema,
          limit: limitSchema,
        },
        annotations: { title: "Clicks by referrer", ...READ_ONLY },
      },
      async ({ range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getGlobalBreakdown(this.env, "referrer_host", resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, { results: result.data });
      },
    );

    this.server.registerTool(
      "get_clicks_by_device",
      {
        title: "Clicks by device",
        description:
          "Get a cross-link device/OS/browser breakdown. Counts cover ONLY the requested range. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          dimension: z
            .enum(["device_type", "os", "browser"])
            .default("device_type")
            .describe("Which device dimension to group by"),
          range: optionalRangeSchema,
          limit: limitSchema,
        },
        annotations: { title: "Clicks by device", ...READ_ONLY },
      },
      async ({ dimension, range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getGlobalBreakdown(this.env, dimension, resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, { results: result.data });
      },
    );

    this.server.registerTool(
      "compare_links",
      {
        title: "Compare links",
        description:
          "Compare two or more links side by side. All per-link stats are scoped to the requested range; pass the same range in follow-up calls to keep comparisons consistent. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          link_ids: z.array(z.number().int().positive()).min(2).describe("Array of link IDs to compare"),
          range: optionalRangeSchema,
        },
        annotations: { title: "Compare links", ...READ_ONLY },
      },
      async ({ link_ids, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await compareLinkStats(this.env, link_ids, resolved, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, { results: result.data });
      },
    );

    this.server.registerTool(
      "get_link_breakdown",
      {
        title: "Link breakdown",
        description:
          "Drill down into a single dimension for one link. Counts cover ONLY the requested range. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link"),
          dimension: dimensionSchema,
          range: optionalRangeSchema,
          limit: z.number().int().min(1).max(100).default(25).describe("Maximum results"),
        },
        annotations: { title: "Link breakdown", ...READ_ONLY },
      },
      async ({ link_id, dimension, range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getLinkBreakdown(this.env, link_id, dimension, resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, { results: result.data });
      },
    );

    this.server.registerTool(
      "get_total_clicks",
      {
        title: "Total clicks",
        description:
          "Get the total click count across all links. Counts cover ONLY the requested range; reuse the same range across follow-up calls to keep numbers comparable. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          range: optionalRangeSchema,
        },
        annotations: { title: "Total clicks", ...READ_ONLY },
      },
      async ({ range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getTotalClicks(this.env, resolved, this.identity);
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, result.data);
      },
    );

    this.server.registerTool(
      "delete_link",
      {
        title: "Delete link",
        description:
          "Delete a short link. Only links with zero clicks can be deleted. Links with clicks should be disabled instead. Only the link owner can delete it.",
        inputSchema: {
          link_id: z.number().int().positive().describe("Numeric ID of the link to delete"),
        },
        annotations: { title: "Delete link", ...DESTRUCTIVE },
      },
      async ({ link_id }) => {
        const result = await deleteLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    // ===================================================================
    // Bundles: collections of links with combined engagement stats.
    // ===================================================================

    this.server.registerTool(
      "list_bundles",
      {
        title: "List bundles",
        description:
          "List bundles owned by the caller. Bundles group related links so you can see combined click stats across them. Totals are lifetime; the delta is a fixed 30d-vs-prev-30d trend. Use `filter` to control which archival state is returned.",
        inputSchema: {
          filter: z
            .enum(["active", "archived", "all"])
            .default("active")
            .describe("active = hide archived (default); archived = only archived; all = both"),
        },
        annotations: { title: "List bundles", ...READ_ONLY },
      },
      async ({ filter }) => {
        const result = await listBundles(this.env, this.identity, {
          archivedOnly: filter === "archived",
          includeArchived: filter === "all",
        });
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "get_bundle",
      {
        title: "Get bundle",
        description: "Get a bundle's metadata by numeric ID. Use get_bundle_analytics for stats.",
        inputSchema: {
          bundle_id: z.number().int().positive().describe("Numeric ID of the bundle"),
        },
        annotations: { title: "Get bundle", ...READ_ONLY },
      },
      async ({ bundle_id }) => {
        const result = await getBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "create_bundle",
      {
        title: "Create bundle",
        description:
          "Create a new bundle. Bundles are owned by the caller. Use add_link_to_bundle to populate them.",
        inputSchema: {
          name: z.string().min(1).max(120).describe("Display name"),
          description: z.string().nullable().optional().describe("Optional short description"),
          icon: z.string().nullable().optional().describe("Material Symbol icon name, e.g. inventory_2"),
          accent: z.enum(["orange", "red", "green", "blue", "purple"]).optional().describe("Accent color"),
        },
        annotations: { title: "Create bundle", ...WRITE_NEW },
      },
      async ({ name, description, icon, accent }) => {
        const result = await createBundle(
          this.env,
          { name, description, icon, accent },
          this.identity,
          "mcp",
        );
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "update_bundle",
      {
        title: "Update bundle",
        description: "Update a bundle's metadata. Only fields provided are changed. Only the owner can update.",
        inputSchema: {
          bundle_id: z.number().int().positive().describe("Numeric ID of the bundle"),
          name: z.string().min(1).max(120).optional(),
          description: z.string().nullable().optional(),
          icon: z.string().nullable().optional(),
          accent: z.enum(["orange", "red", "green", "blue", "purple"]).optional(),
        },
        annotations: { title: "Update bundle", ...WRITE_IDEMPOTENT },
      },
      async ({ bundle_id, ...patch }) => {
        const result = await updateBundle(this.env, bundle_id, patch, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "archive_bundle",
      {
        title: "Archive bundle",
        description:
          "Archive a bundle. It stays in the database but is hidden from the default list. Only the owner can archive.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
        },
        annotations: { title: "Archive bundle", ...WRITE_IDEMPOTENT },
      },
      async ({ bundle_id }) => {
        const result = await archiveBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "unarchive_bundle",
      {
        title: "Unarchive bundle",
        description:
          "Restore a previously archived bundle so it appears in the default list again. Only the owner can unarchive.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
        },
        annotations: { title: "Unarchive bundle", ...WRITE_IDEMPOTENT },
      },
      async ({ bundle_id }) => {
        const result = await unarchiveBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "delete_bundle",
      {
        title: "Delete bundle",
        description:
          "Permanently delete a bundle. Member links are not deleted, only their membership in this bundle. Only the owner can delete.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
        },
        annotations: { title: "Delete bundle", ...DESTRUCTIVE },
      },
      async ({ bundle_id }) => {
        const result = await deleteBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "add_link_to_bundle",
      {
        title: "Add link to bundle",
        description:
          "Add a link to a bundle. Idempotent: adding the same link twice is a no-op. Only the bundle owner can add.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
          link_id: z.number().int().positive(),
        },
        annotations: { title: "Add link to bundle", ...WRITE_IDEMPOTENT },
      },
      async ({ bundle_id, link_id }) => {
        const result = await addLinkToBundle(this.env, bundle_id, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "remove_link_from_bundle",
      {
        title: "Remove link from bundle",
        description:
          "Remove a link from a bundle. The link itself is not deleted. Only the bundle owner can remove.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
          link_id: z.number().int().positive(),
        },
        annotations: { title: "Remove link from bundle", ...WRITE_IDEMPOTENT },
      },
      async ({ bundle_id, link_id }) => {
        const result = await removeLinkFromBundle(this.env, bundle_id, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "list_bundle_links",
      {
        title: "List bundle links",
        description: "List every link in a given bundle, with slugs and total click counts.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
        },
        annotations: { title: "List bundle links", ...READ_ONLY },
      },
      async ({ bundle_id }) => {
        const result = await listBundleLinks(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "list_bundles_for_link",
      {
        title: "List bundles for link",
        description: "Return every bundle a given link belongs to. Useful for showing bundle memberships.",
        inputSchema: {
          link_id: z.number().int().positive(),
        },
        annotations: { title: "List bundles for link", ...READ_ONLY },
      },
      async ({ link_id }) => {
        const result = await listBundlesForLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.registerTool(
      "get_bundle_analytics",
      {
        title: "Bundle analytics",
        description:
          "Combined analytics across every link in a bundle. Stats cover ONLY the requested range; reuse the same range across follow-up calls to keep numbers comparable. Defaults to the user's `default_range` setting (or 30d). Response includes `range_used`.",
        inputSchema: {
          bundle_id: z.number().int().positive(),
          range: optionalRangeSchema,
        },
        annotations: { title: "Bundle analytics", ...READ_ONLY },
      },
      async ({ bundle_id, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const filters = await resolveClickFilters(this.env, this.identity);
        const result = await getBundleAnalytics(this.env, bundle_id, resolved, this.identity, { filters });
        if (!result.ok) return fail(result.error);
        return okWithRange(resolved, result.data);
      },
    );
  }
}
