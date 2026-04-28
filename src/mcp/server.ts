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

export class ShrtnrMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({ name: "shrtnr", version: pkg.version });

  private get identity(): string {
    if (!this.props) throw new Error("MCP agent invoked without identity props");
    return this.props.email;
  }

  async init() {
    this.server.tool(
      "health",
      "Check the shrtnr server health and current version",
      {},
      async () => {
        const res = handleHealth();
        return ok(await res.json());
      },
    );

    this.server.tool(
      "list_links",
      "List all short links with their slugs and click counts",
      {},
      async () => {
        const result = await listLinks(this.env);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_link",
      "Get full details for a short link by its numeric ID",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
      },
      async ({ link_id }) => {
        const result = await getLink(this.env, link_id);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "create_link",
      "Shorten a URL and create a short link. If the destination URL already exists, the existing link is returned with `duplicate: true`, so there is no need to search for the URL first. Optional custom slugs are attached after creation; slugs already in use are reported in `slug_rejections` rather than failing the call.",
      {
        url: z.string().url().describe("Destination URL to shorten"),
        label: z.string().optional().describe("Human-readable label for the link"),
        slug_length: z.number().int().min(3).optional().describe("Length of the random slug (default: 3)"),
        custom_slug: z.union([z.string(), z.array(z.string())]).optional().describe("Custom slug(s), e.g. 'my-blog-post' or ['slug-a', 'slug-b']. Added after creation; collisions are reported, not fatal."),
        vanity_slug: z.string().optional().describe("Alias for custom_slug (single string)"),
        expires_at: z.number().int().optional().describe("Unix timestamp when the link expires"),
      },
      async ({ custom_slug, vanity_slug, ...opts }) => {
        const result = await createLink(this.env, { ...opts, created_via: "mcp", created_by: this.identity });
        if (!result.ok) return fail(result.error);

        const requestedSlugs = custom_slug
          ? (Array.isArray(custom_slug) ? custom_slug : [custom_slug])
          : vanity_slug ? [vanity_slug] : [];

        const rejections: { slug: string; reason: string }[] = [];
        for (const slug of requestedSlugs) {
          const addResult = await addCustomSlugToLink(this.env, result.data.id, { slug });
          if (!addResult.ok) {
            rejections.push({ slug, reason: addResult.error });
          }
        }

        const link = requestedSlugs.length > 0
          ? (await getLink(this.env, result.data.id))
          : result;
        if (!link.ok) return fail(link.error);

        const response: Record<string, unknown> = { ...link.data, ...(result.meta ?? {}) };
        if (rejections.length > 0) response.slug_rejections = rejections;
        return ok(response);
      },
    );

    this.server.tool(
      "update_link",
      "Update the destination URL, label, or expiry of an existing short link",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link to update"),
        url: z.string().url().optional().describe("New destination URL"),
        label: z.string().nullable().optional().describe("New label (null removes it)"),
        expires_at: z.number().int().nullable().optional().describe("New expiry Unix timestamp (null removes it)"),
      },
      async ({ link_id, ...opts }) => {
        const result = await updateLink(this.env, link_id, opts);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "disable_link",
      "Disable a short link so it stops redirecting. Only the link owner can disable it.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link to disable"),
      },
      async ({ link_id }) => {
        const result = await disableLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "enable_link",
      "Re-enable a disabled short link so it starts redirecting again. Only the link owner can enable it.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link to enable"),
      },
      async ({ link_id }) => {
        const result = await enableLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "add_custom_slug",
      "Add a custom slug to an existing link",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        slug: z.string().min(1).describe("Custom slug to add, e.g. 'my-post'"),
      },
      async ({ link_id, slug }) => {
        const result = await addCustomSlugToLink(this.env, link_id, { slug });
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "add_vanity_slug",
      "Add a custom slug (vanity URL) to an existing link. Alias for add_custom_slug.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        slug: z.string().min(1).describe("Custom slug to add, e.g. 'my-post'"),
      },
      async ({ link_id, slug }) => {
        const result = await addCustomSlugToLink(this.env, link_id, { slug });
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_link_analytics",
      "Get click analytics for a short link: countries, referrers, devices, browsers, and daily click history. Defaults to the user's default_range setting (or 30d) when no range is given. The response includes a `range_used` field so the AI knows which window the data covers.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).optional().describe("Time range. Omit to use the user's default_range setting (fallback: 30d)."),
      },
      async ({ link_id, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const filters = await resolveClickFilters(this.env, this.identity);
        const result = await getLinkAnalytics(this.env, link_id, resolved, filters);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, ...result.data });
      },
    );

    this.server.tool(
      "search_links",
      "Search for short links by label, slug, URL, or creator email. Returns all links matching the query string.",
      {
        query: z.string().describe("Search term to match against link labels, slugs, URLs, and creator emails"),
      },
      async ({ query }) => {
        const result = await searchLinks(this.env, query);
        if (!result.ok) return fail(result.error);
        if (result.data.length === 0) return ok({ results: [], message: "No links found matching that query." });
        return ok({ results: result.data, count: result.data.length });
      },
    );

    this.server.tool(
      "list_links_by_owner",
      "List all short links created by a specific user. Use this to find all links belonging to a particular team member.",
      {
        owner: z.string().describe("Email address of the link owner"),
      },
      async ({ owner }) => {
        const result = await listLinksByOwner(this.env, owner);
        if (!result.ok) return fail(result.error);
        if (result.data.length === 0) return ok({ results: [], message: `No links found for ${owner}.` });
        return ok({ results: result.data, count: result.data.length });
      },
    );

    this.server.tool(
      "get_link_qr",
      "Get a QR code SVG for a short link. The QR encodes the short URL with a ?qr tracking parameter.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        slug: z.string().optional().describe("Specific slug to use (defaults to custom slug or primary)"),
        base_url: z.string().url().describe("Base URL of the shrtnr instance, e.g. https://oddb.it"),
      },
      async ({ link_id, slug: requestedSlug, base_url }) => {
        const result = await getLink(this.env, link_id);
        if (!result.ok) return fail(result.error);
        const link = result.data;

        const target = requestedSlug
          ? link.slugs.find((s) => s.slug === requestedSlug)
          : link.slugs.find((s) => s.is_custom) ?? link.slugs[0];

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

    const optionalRangeSchema = z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).optional().describe("Time range. Omit to use the user's default_range setting (fallback: 30d).");
    const limitSchema = z.number().int().min(1).max(100).default(10).describe("Maximum number of results to return");
    const dimensionSchema = z.enum(["country", "referrer_host", "device_type", "os", "browser", "link_mode", "channel"]).describe("Dimension to group by");

    this.server.tool(
      "get_trending_links",
      "Get the top links ranked by click count within a time window. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        range: optionalRangeSchema,
        limit: limitSchema,
      },
      async ({ range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getTrendingLinks(this.env, resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, results: result.data });
      },
    );

    this.server.tool(
      "get_dashboard_stats",
      "Get a high-level snapshot: total links, total clicks, top 5 links, top 5 countries, top 5 referrer hosts, and recent links. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        range: optionalRangeSchema,
      },
      async ({ range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getDashboardStats(this.env, resolved, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, ...result.data });
      },
    );

    this.server.tool(
      "get_link_timeline",
      "Get time-bucketed click counts for a link with adaptive granularity. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        range: optionalRangeSchema,
      },
      async ({ link_id, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const filters = await resolveClickFilters(this.env, this.identity);
        const result = await getLinkTimeline(this.env, link_id, resolved, filters);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, ...result.data });
      },
    );

    this.server.tool(
      "get_clicks_by_country",
      "Get a cross-link geographic breakdown. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        range: optionalRangeSchema,
        limit: limitSchema,
      },
      async ({ range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getGlobalBreakdown(this.env, "country", resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, results: result.data });
      },
    );

    this.server.tool(
      "get_clicks_by_referrer",
      "Get a cross-link referrer breakdown. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        range: optionalRangeSchema,
        limit: limitSchema,
      },
      async ({ range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getGlobalBreakdown(this.env, "referrer_host", resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, results: result.data });
      },
    );

    this.server.tool(
      "get_clicks_by_device",
      "Get a cross-link device/OS/browser breakdown. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        dimension: z.enum(["device_type", "os", "browser"]).default("device_type").describe("Which device dimension to group by"),
        range: optionalRangeSchema,
        limit: limitSchema,
      },
      async ({ dimension, range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getGlobalBreakdown(this.env, dimension, resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, results: result.data });
      },
    );

    this.server.tool(
      "compare_links",
      "Compare two or more links side by side. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        link_ids: z.array(z.number().int().positive()).min(2).describe("Array of link IDs to compare"),
        range: optionalRangeSchema,
      },
      async ({ link_ids, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await compareLinkStats(this.env, link_ids, resolved, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, results: result.data });
      },
    );

    this.server.tool(
      "get_link_breakdown",
      "Drill down into a single dimension for one link. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        dimension: dimensionSchema,
        range: optionalRangeSchema,
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum results"),
      },
      async ({ link_id, dimension, range, limit }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getLinkBreakdown(this.env, link_id, dimension, resolved, limit, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, results: result.data });
      },
    );

    this.server.tool(
      "get_total_clicks",
      "Get the total click count across all links. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        range: optionalRangeSchema,
      },
      async ({ range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const result = await getTotalClicks(this.env, resolved, this.identity);
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, ...result.data });
      },
    );

    this.server.tool(
      "delete_link",
      "Delete a short link. Only links with zero clicks can be deleted. Links with clicks should be disabled instead. Only the link owner can delete it.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link to delete"),
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

    this.server.tool(
      "list_bundles",
      "List bundles owned by the caller. Bundles group related links so you can see combined click stats across them. Totals are lifetime; the delta is a fixed 30d-vs-prev-30d trend. Use `filter` to control which archival state is returned.",
      {
        filter: z.enum(["active", "archived", "all"]).default("active").describe("active = hide archived (default); archived = only archived; all = both"),
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

    this.server.tool(
      "get_bundle",
      "Get a bundle's metadata by numeric ID. Use get_bundle_analytics for stats.",
      {
        bundle_id: z.number().int().positive().describe("Numeric ID of the bundle"),
      },
      async ({ bundle_id }) => {
        const result = await getBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "create_bundle",
      "Create a new bundle. Bundles are owned by the caller. Use add_link_to_bundle to populate them.",
      {
        name: z.string().min(1).max(120).describe("Display name"),
        description: z.string().nullable().optional().describe("Optional short description"),
        icon: z.string().nullable().optional().describe("Material Symbol icon name, e.g. inventory_2"),
        accent: z.enum(["orange", "red", "green", "blue", "purple"]).optional().describe("Accent color"),
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

    this.server.tool(
      "update_bundle",
      "Update a bundle's metadata. Only fields provided are changed. Only the owner can update.",
      {
        bundle_id: z.number().int().positive().describe("Numeric ID of the bundle"),
        name: z.string().min(1).max(120).optional(),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        accent: z.enum(["orange", "red", "green", "blue", "purple"]).optional(),
      },
      async ({ bundle_id, ...patch }) => {
        const result = await updateBundle(this.env, bundle_id, patch, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "archive_bundle",
      "Archive a bundle. It stays in the database but is hidden from the default list. Only the owner can archive.",
      {
        bundle_id: z.number().int().positive(),
      },
      async ({ bundle_id }) => {
        const result = await archiveBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "unarchive_bundle",
      "Restore a previously archived bundle so it appears in the default list again. Only the owner can unarchive.",
      {
        bundle_id: z.number().int().positive(),
      },
      async ({ bundle_id }) => {
        const result = await unarchiveBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "delete_bundle",
      "Permanently delete a bundle. Member links are not deleted, only their membership in this bundle. Only the owner can delete.",
      {
        bundle_id: z.number().int().positive(),
      },
      async ({ bundle_id }) => {
        const result = await deleteBundle(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "add_link_to_bundle",
      "Add a link to a bundle. Idempotent: adding the same link twice is a no-op. Only the bundle owner can add.",
      {
        bundle_id: z.number().int().positive(),
        link_id: z.number().int().positive(),
      },
      async ({ bundle_id, link_id }) => {
        const result = await addLinkToBundle(this.env, bundle_id, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "remove_link_from_bundle",
      "Remove a link from a bundle. The link itself is not deleted. Only the bundle owner can remove.",
      {
        bundle_id: z.number().int().positive(),
        link_id: z.number().int().positive(),
      },
      async ({ bundle_id, link_id }) => {
        const result = await removeLinkFromBundle(this.env, bundle_id, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "list_bundle_links",
      "List every link in a given bundle, with slugs and total click counts.",
      {
        bundle_id: z.number().int().positive(),
      },
      async ({ bundle_id }) => {
        const result = await listBundleLinks(this.env, bundle_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "list_bundles_for_link",
      "Return every bundle a given link belongs to. Useful for showing bundle memberships.",
      {
        link_id: z.number().int().positive(),
      },
      async ({ link_id }) => {
        const result = await listBundlesForLink(this.env, link_id, this.identity);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_bundle_analytics",
      "Combined analytics across every link in a bundle. Defaults to the user's default_range setting (or 30d). Response includes `range_used`.",
      {
        bundle_id: z.number().int().positive(),
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).optional().describe("Time range. Omit to use the user's default_range setting (fallback: 30d)."),
      },
      async ({ bundle_id, range }) => {
        const resolved = await resolveMcpRange(this.env, this.identity, range as TimelineRange | undefined);
        const filters = await resolveClickFilters(this.env, this.identity);
        const result = await getBundleAnalytics(this.env, bundle_id, resolved, this.identity, { filters });
        if (!result.ok) return fail(result.error);
        return ok({ range_used: resolved, ...result.data });
      },
    );
  }
}
