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
interface Props {
  email: string;
}
import { handleHealth } from "../api/health";
import {
  listLinks,
  getLink,
  createLink,
  updateLink,
  disableLink,
  deleteLink,
  addCustomSlugToLink,
  getLinkAnalytics,
  getLinkTimeline,
  getDashboardStats,
  searchLinks,
} from "../services/link-management";
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
      "Shorten a URL and create a new short link",
      {
        url: z.string().url().describe("Destination URL to shorten"),
        label: z.string().optional().describe("Human-readable label for the link"),
        slug_length: z.number().int().min(3).optional().describe("Length of the random slug (default: 3)"),
        custom_slug: z.union([z.string(), z.array(z.string())]).optional().describe("Custom slug(s), e.g. 'my-blog-post' or ['slug-a', 'slug-b']. Added after creation; collisions are reported, not fatal."),
        vanity_slug: z.string().optional().describe("Alias for custom_slug (single string)"),
        expires_at: z.number().int().optional().describe("Unix timestamp when the link expires"),
      },
      async ({ custom_slug, vanity_slug, ...opts }) => {
        const result = await createLink(this.env, { ...opts, created_via: "mcp" });
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

        const response: Record<string, unknown> = { ...link.data };
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
      "Disable a short link so it stops redirecting",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link to disable"),
      },
      async ({ link_id }) => {
        const result = await disableLink(this.env, link_id);
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
      "Get click analytics for a short link: countries, referrers, devices, browsers, and daily click history",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
      },
      async ({ link_id }) => {
        const result = await getLinkAnalytics(this.env, link_id);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "search_links",
      "Search for short links by label or slug. Returns all links whose label or any slug contains the query string. Use this to find links by name, topic, or slug keyword — e.g. 'oddbit website', 'pricing', or 'newsletter'.",
      {
        query: z.string().describe("Search term to match against link labels and slugs"),
      },
      async ({ query }) => {
        const result = await searchLinks(this.env, query);
        if (!result.ok) return fail(result.error);
        if (result.data.length === 0) return ok({ results: [], message: "No links found matching that query." });
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

    const rangeSchema = z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("24h").describe("Time range to filter clicks");
    const limitSchema = z.number().int().min(1).max(100).default(10).describe("Maximum number of results to return");
    const dimensionSchema = z.enum(["country", "referrer_host", "device_type", "os", "browser", "link_mode", "channel"]).describe("Dimension to group by");

    this.server.tool(
      "get_trending_links",
      "Get the top links ranked by click count within a time window. Use this to find what is popular right now.",
      {
        range: rangeSchema,
        limit: limitSchema,
      },
      async ({ range, limit }) => {
        const result = await getTrendingLinks(this.env, range as TimelineRange, limit);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_dashboard_stats",
      "Get a high-level snapshot: total links, total clicks, top 5 links, top 5 countries, top 5 referrer hosts, and recent links.",
      {},
      async () => {
        const result = await getDashboardStats(this.env);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_link_timeline",
      "Get time-bucketed click counts for a link with adaptive granularity (hourly, daily, weekly, monthly) and period summaries.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("30d").describe("Time range for the timeline"),
      },
      async ({ link_id, range }) => {
        const result = await getLinkTimeline(this.env, link_id, range as TimelineRange);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_clicks_by_country",
      "Get a cross-link geographic breakdown: which countries generate the most clicks across all links.",
      {
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("all").describe("Time range filter"),
        limit: limitSchema,
      },
      async ({ range, limit }) => {
        const result = await getGlobalBreakdown(this.env, "country", range as TimelineRange, limit);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_clicks_by_referrer",
      "Get a cross-link referrer breakdown: which traffic sources drive the most clicks across all links.",
      {
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("all").describe("Time range filter"),
        limit: limitSchema,
      },
      async ({ range, limit }) => {
        const result = await getGlobalBreakdown(this.env, "referrer_host", range as TimelineRange, limit);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_clicks_by_device",
      "Get a cross-link device/OS/browser breakdown. Choose a dimension to answer questions like 'what share of traffic is mobile?'",
      {
        dimension: z.enum(["device_type", "os", "browser"]).default("device_type").describe("Which device dimension to group by"),
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("all").describe("Time range filter"),
        limit: limitSchema,
      },
      async ({ dimension, range, limit }) => {
        const result = await getGlobalBreakdown(this.env, dimension, range as TimelineRange, limit);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "compare_links",
      "Compare two or more links side by side. Returns total clicks, top country, and top referrer for each link over a shared time range.",
      {
        link_ids: z.array(z.number().int().positive()).min(2).describe("Array of link IDs to compare"),
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("all").describe("Shared time range for comparison"),
      },
      async ({ link_ids, range }) => {
        const result = await compareLinkStats(this.env, link_ids, range as TimelineRange);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_link_breakdown",
      "Drill down into a single dimension for one link with range filtering and a configurable result limit. Use this instead of get_link_analytics when you need deeper detail on one dimension.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        dimension: dimensionSchema,
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("all").describe("Time range filter"),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum results"),
      },
      async ({ link_id, dimension, range, limit }) => {
        const result = await getLinkBreakdown(this.env, link_id, dimension, range as TimelineRange, limit);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "get_total_clicks",
      "Get the total click count across all links, optionally filtered by time range. A quick health check for overall traffic.",
      {
        range: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("all").describe("Time range filter"),
      },
      async ({ range }) => {
        const result = await getTotalClicks(this.env, range as TimelineRange);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );

    this.server.tool(
      "delete_link",
      "Delete a short link. Only links with zero clicks can be deleted. Links with clicks should be disabled instead.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link to delete"),
      },
      async ({ link_id }) => {
        const result = await deleteLink(this.env, link_id);
        if (!result.ok) return fail(result.error);
        return ok(result.data);
      },
    );
  }
}
