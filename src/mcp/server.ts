// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../types";
import { handleHealth } from "../api/health";
import {
  listManagedLinks,
  getManagedLink,
  createManagedLink,
  updateManagedLink,
  disableManagedLink,
  addVanitySlugToLink,
  getManagedLinkAnalytics,
} from "../services/link-management";
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

export function createMcpServer(env: Env): McpServer {
  const server = new McpServer({ name: "shrtnr", version: pkg.version });

  server.tool(
    "health",
    "Check the shrtnr server health and current version",
    {},
    async () => {
      const res = handleHealth();
      return ok(await res.json());
    },
  );

  server.tool(
    "list_links",
    "List all short links with their slugs and click counts",
    {},
    async () => {
      const result = await listManagedLinks(env);
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  server.tool(
    "get_link",
    "Get full details for a short link by its numeric ID",
    {
      link_id: z.number().int().positive().describe("Numeric ID of the link"),
    },
    async ({ link_id }) => {
      const result = await getManagedLink(env, link_id);
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  server.tool(
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
      const result = await createManagedLink(env, opts);
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  server.tool(
    "update_link",
    "Update the destination URL, label, or expiry of an existing short link",
    {
      link_id: z.number().int().positive().describe("Numeric ID of the link to update"),
      url: z.string().url().optional().describe("New destination URL"),
      label: z.string().nullable().optional().describe("New label (null removes it)"),
      expires_at: z.number().int().nullable().optional().describe("New expiry Unix timestamp (null removes it)"),
    },
    async ({ link_id, ...opts }) => {
      const result = await updateManagedLink(env, link_id, opts);
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  server.tool(
    "disable_link",
    "Disable a short link so it stops redirecting",
    {
      link_id: z.number().int().positive().describe("Numeric ID of the link to disable"),
    },
    async ({ link_id }) => {
      const result = await disableManagedLink(env, link_id);
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  server.tool(
    "add_vanity_slug",
    "Add a custom vanity slug to an existing link",
    {
      link_id: z.number().int().positive().describe("Numeric ID of the link"),
      slug: z.string().min(1).describe("Custom slug to add, e.g. 'my-post'"),
    },
    async ({ link_id, slug }) => {
      const result = await addVanitySlugToLink(env, link_id, { slug });
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  server.tool(
    "get_link_analytics",
    "Get click analytics for a short link: countries, referrers, devices, browsers, and daily click history",
    {
      link_id: z.number().int().positive().describe("Numeric ID of the link"),
    },
    async ({ link_id }) => {
      const result = await getManagedLinkAnalytics(env, link_id);
      if (!result.ok) return fail(result.error);
      return ok(result.data);
    },
  );

  return server;
}
