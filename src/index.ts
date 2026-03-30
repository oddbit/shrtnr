// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "./types";
import { handleRedirect } from "./redirect";
import { getAuthenticatedEmail, unauthorizedResponse } from "./auth";
import { handleHealth } from "./api/health";
import { handleListLinks, handleGetLink, handleCreateLink, handleUpdateLink, handleDisableLink } from "./api/links";
import { handleAddVanitySlug, handleRemoveVanitySlug } from "./api/slugs";
import { handleGetSettings, handleUpdateSettings } from "./api/settings";
import { handleDashboardStats, handleLinkAnalytics } from "./api/analytics";
import { serveAdminUI } from "./admin/ui";
import { serveAsset } from "./assets";
import { notFoundResponse } from "./404";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Static assets (favicon, icons)
    const asset = serveAsset(path);
    if (asset) return asset;

    // Health check — public
    if (path === "/_/health") {
      return handleHealth();
    }

    // Admin UI — Cloudflare Access handles login; we just read the email
    if (path === "/_/admin" || path === "/_/admin/") {
      const email = getAuthenticatedEmail(request);
      if (!email) {
        return unauthorizedResponse();
      }
      return Response.redirect(new URL("/_/admin/dashboard", request.url).toString(), 302);
    }
    if (path.startsWith("/_/admin/")) {
      const email = getAuthenticatedEmail(request);
      if (!email) {
        return unauthorizedResponse();
      }
      return serveAdminUI(email);
    }

    // API routes — require auth
    if (path.startsWith("/_/api/")) {
      const email = getAuthenticatedEmail(request);
      if (!email) {
        return unauthorizedResponse();
      }
      return handleApiRoute(request, env, path);
    }

    // Root URL — redirect to admin (Cloudflare Access will handle login)
    if (path === "/" || path === "") {
      return Response.redirect(new URL("/_/admin/dashboard", request.url).toString(), 302);
    }

    // Everything else is a slug redirect
    const slug = path.slice(1); // Remove leading /
    if (!slug || slug.startsWith("_")) {
      return notFoundResponse();
    }

    return handleRedirect(slug, request, env.DB, ctx);
  },
} satisfies ExportedHandler<Env>;

async function handleApiRoute(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /_/api/links
  if (path === "/_/api/links" && method === "GET") {
    return handleListLinks(env);
  }

  // POST /_/api/links
  if (path === "/_/api/links" && method === "POST") {
    return handleCreateLink(request, env);
  }

  // GET /_/api/settings
  if (path === "/_/api/settings" && method === "GET") {
    return handleGetSettings(env);
  }

  // PUT /_/api/settings
  if (path === "/_/api/settings" && method === "PUT") {
    return handleUpdateSettings(request, env);
  }

  // GET /_/api/dashboard
  if (path === "/_/api/dashboard" && method === "GET") {
    return handleDashboardStats(env);
  }

  // Routes with :id
  const linkMatch = path.match(/^\/_\/api\/links\/(\d+)$/);
  if (linkMatch) {
    const id = parseInt(linkMatch[1], 10);
    if (method === "GET") return handleGetLink(env, id);
    if (method === "PUT") return handleUpdateLink(request, env, id);
  }

  // POST /_/api/links/:id/disable
  const disableMatch = path.match(/^\/_\/api\/links\/(\d+)\/disable$/);
  if (disableMatch && method === "POST") {
    const id = parseInt(disableMatch[1], 10);
    return handleDisableLink(env, id);
  }

  // GET /_/api/links/:id/analytics
  const analyticsMatch = path.match(/^\/_\/api\/links\/(\d+)\/analytics$/);
  if (analyticsMatch && method === "GET") {
    const id = parseInt(analyticsMatch[1], 10);
    return handleLinkAnalytics(env, id);
  }

  // POST /_/api/links/:id/slugs
  const addSlugMatch = path.match(/^\/_\/api\/links\/(\d+)\/slugs$/);
  if (addSlugMatch && method === "POST") {
    const id = parseInt(addSlugMatch[1], 10);
    return handleAddVanitySlug(request, env, id);
  }

  // DELETE /_/api/links/:id/slugs/:slug
  const removeSlugMatch = path.match(/^\/_\/api\/links\/(\d+)\/slugs\/(.+)$/);
  if (removeSlugMatch && method === "DELETE") {
    const id = parseInt(removeSlugMatch[1], 10);
    const slug = decodeURIComponent(removeSlugMatch[2]);
    return handleRemoveVanitySlug(env, id, slug);
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}