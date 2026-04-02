// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import type { Props } from "./oauth-types";
import { handleHealth } from "../api/health";
import {
  listLinks,
  getLink,
  createLink,
  updateLink,
  disableLink,
  addVanitySlugToLink,
  getLinkAnalytics,
} from "../services/link-management";
import { renderQrSvg } from "../qr";
import { dbGetLinkById } from "../db";
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
        vanity_slug: z.string().optional().describe("Custom slug, e.g. 'my-blog-post'"),
        expires_at: z.number().int().optional().describe("Unix timestamp when the link expires"),
      },
      async (opts) => {
        const result = await createLink(this.env, { ...opts, created_via: "mcp" });
        if (!result.ok) return fail(result.error);
        return ok(result.data);
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
      "add_vanity_slug",
      "Add a custom vanity slug to an existing link",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        slug: z.string().min(1).describe("Custom slug to add, e.g. 'my-post'"),
      },
      async ({ link_id, slug }) => {
        const result = await addVanitySlugToLink(this.env, link_id, { slug });
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
      "get_link_qr",
      "Get a QR code SVG for a short link. The QR encodes the short URL with a ?qr tracking parameter.",
      {
        link_id: z.number().int().positive().describe("Numeric ID of the link"),
        slug: z.string().optional().describe("Specific slug to use (defaults to vanity slug or primary)"),
        base_url: z.string().url().describe("Base URL of the shrtnr instance, e.g. https://oddb.it"),
      },
      async ({ link_id, slug: requestedSlug, base_url }) => {
        const link = await dbGetLinkById(this.env.DB, link_id);
        if (!link) return fail("Link not found");

        const target = requestedSlug
          ? link.slugs.find((s) => s.slug === requestedSlug)
          : link.slugs.find((s) => s.is_vanity) ?? link.slugs[0];

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
  }
}
