// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "./types";
import { handleRedirect } from "./redirect";
import { getAuthenticatedEmail, unauthorizedResponse } from "./auth";
import { authenticateApiKey } from "./db";
import { handleHealth } from "./api/health";
import { handleListLinks, handleGetLink, handleCreateLink, handleUpdateLink, handleDisableLink } from "./api/links";
import { handleAddVanitySlug } from "./api/slugs";
import { handleGetSettings, handleUpdateSettings } from "./api/settings";
import { handleGetPreferences, handleUpdatePreferences } from "./api/preferences";
import { handleListKeys, handleCreateKey, handleDeleteKey } from "./api/keys";
import { handleDashboardStats, handleLinkAnalytics } from "./api/analytics";
import { serveAdminUI } from "./admin/ui";
import { serveAsset } from "./assets";
import { notFoundResponse } from "./404";

type AuthContext = {
  email: string;
  source: "access" | "apikey";
  scope: string | null; // null = full access (admin), "create" | "read" | "create,read"
};

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

    // API routes — require auth (Access JWT or API key)
    if (path.startsWith("/_/api/")) {
      const auth = await resolveAuth(request, env);
      if (!auth) {
        return unauthorizedResponse();
      }
      return handleApiRoute(request, env, path, auth);
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

async function resolveAuth(request: Request, env: Env): Promise<AuthContext | null> {
  // Try Cloudflare Access JWT first (admin access)
  const email = getAuthenticatedEmail(request);
  if (email) {
    return { email, source: "access", scope: null };
  }

  // Try Bearer token (API key)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const key = await authenticateApiKey(env.DB, token);
    if (key) {
      return { email: key.email, source: "apikey", scope: key.scope };
    }
  }

  return null;
}

function hasScope(auth: AuthContext, required: string): boolean {
  if (auth.scope === null) return true; // Admin has full access
  return auth.scope.split(",").includes(required);
}

function forbiddenResponse(): Response {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

function requireAdmin(auth: AuthContext): Response | null {
  if (auth.source !== "access") return forbiddenResponse();
  return null;
}

async function handleApiRoute(request: Request, env: Env, path: string, auth: AuthContext): Promise<Response> {
  const method = request.method;

  // --- API key management (admin only) ---

  if (path === "/_/api/keys" && method === "GET") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleListKeys(env, auth.email);
  }
  if (path === "/_/api/keys" && method === "POST") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleCreateKey(request, env, auth.email);
  }
  const keyDeleteMatch = path.match(/^\/_\/api\/keys\/(\d+)$/);
  if (keyDeleteMatch && method === "DELETE") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleDeleteKey(env, auth.email, parseInt(keyDeleteMatch[1], 10));
  }

  // --- Scoped: create ---

  if (path === "/_/api/links" && method === "POST") {
    if (!hasScope(auth, "create")) return forbiddenResponse();
    return handleCreateLink(request, env);
  }

  // --- Scoped: read ---

  if (path === "/_/api/links" && method === "GET") {
    if (!hasScope(auth, "read")) return forbiddenResponse();
    return handleListLinks(env);
  }

  const analyticsMatch = path.match(/^\/_\/api\/links\/(\d+)\/analytics$/);
  if (analyticsMatch && method === "GET") {
    if (!hasScope(auth, "read")) return forbiddenResponse();
    return handleLinkAnalytics(env, parseInt(analyticsMatch[1], 10));
  }

  // --- Admin-only routes ---

  if (path === "/_/api/settings" && method === "GET") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleGetSettings(env);
  }
  if (path === "/_/api/settings" && method === "PUT") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleUpdateSettings(request, env);
  }
  if (path === "/_/api/preferences" && method === "GET") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleGetPreferences(env, auth.email);
  }
  if (path === "/_/api/preferences" && method === "PUT") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleUpdatePreferences(request, env, auth.email);
  }
  if (path === "/_/api/dashboard" && method === "GET") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleDashboardStats(env);
  }

  const linkMatch = path.match(/^\/_\/api\/links\/(\d+)$/);
  if (linkMatch) {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    const id = parseInt(linkMatch[1], 10);
    if (method === "GET") return handleGetLink(env, id);
    if (method === "PUT") return handleUpdateLink(request, env, id);
  }

  const disableMatch = path.match(/^\/_\/api\/links\/(\d+)\/disable$/);
  if (disableMatch && method === "POST") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleDisableLink(env, parseInt(disableMatch[1], 10));
  }

  const addSlugMatch = path.match(/^\/_\/api\/links\/(\d+)\/slugs$/);
  if (addSlugMatch && method === "POST") {
    const denied = requireAdmin(auth);
    if (denied) return denied;
    return handleAddVanitySlug(request, env, parseInt(addSlugMatch[1], 10));
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}