// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyAccessJwt, type AccessUser } from "./access";
import { handleRedirect } from "./redirect";
import { unauthorizedResponse } from "./auth";
import {
  authenticateApiKey,
  getAllLinks,
  getLinkById,
  getDashboardStats,
  getLinkClickStats,
  getAllApiKeys,
  getSetting,
} from "./db";
import { DEFAULT_SLUG_LENGTH } from "./constants";
import { createTranslateFn, getTranslations } from "./i18n";
import { handleHealth } from "./api/health";
import {
  handleListLinks,
  handleGetLink,
  handleCreateLink,
  handleUpdateLink,
  handleDisableLink,
} from "./api/links";
import { handleAddVanitySlug } from "./api/slugs";
import { handleGetSettings, handleUpdateSettings } from "./api/settings";
import { handleListKeys, handleCreateKey, handleDeleteKey } from "./api/keys";
import {
  handleDashboardStats as handleDashboardStatsApi,
  handleLinkAnalytics,
} from "./api/analytics";
import { handleLinkQr } from "./api/qr";
import { notFoundResponse } from "./404";
import { mcpLandingResponse } from "./mcp/page";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { ShrtnrMCP } from "./mcp/server";
import { handleAccessRequest } from "./mcp/access-handler";

import { Layout } from "./pages/layout";
import { DashboardPage } from "./pages/dashboard";
import { LinksPage } from "./pages/links";
import { LinkDetailPage } from "./pages/link-detail";
import { KeysPage } from "./pages/keys";
import { SettingsPage } from "./pages/settings";

// ---- Types ----

type AuthContext = {
  source: "apikey";
  scope: string | null;
};

type HonoEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthContext;
    user: AccessUser | null;
  };
};

const app = new Hono<HonoEnv>();

// ---- Health check (public) ----

app.get("/_/health", () => handleHealth());

// ---- Admin auth middleware ----

app.use("/_/admin/*", async (c, next) => {
  const user = await verifyAccessJwt(c.req.raw, c.env);
  // When ACCESS_AUD is configured, reject unauthenticated requests
  if (c.env.ACCESS_AUD && !user) {
    return c.text("Unauthorized", 403);
  }
  c.set("user", user);
  await next();
});

// ---- Admin logout ----

app.get("/_/admin/logout", (c) => {
  const teamDomain = c.env.ACCESS_JWKS_URL
    ? new URL(c.env.ACCESS_JWKS_URL).origin
    : null;
  const logoutUrl = teamDomain
    ? `${teamDomain}/cdn-cgi/access/logout`
    : "/_/admin/dashboard";
  return new Response(null, {
    status: 302,
    headers: {
      Location: logoutUrl,
      "Set-Cookie": "CF_Authorization=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    },
  });
});

// ---- Admin page helpers ----

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getPageData(c: { env: Env; req: { raw: Request } }) {
  const db = c.env.DB;
  const theme = getCookie(c.req.raw, "theme") || "oddbit";
  const lang = getCookie(c.req.raw, "lang") || "en";
  const t = createTranslateFn(lang);
  const translations = getTranslations(lang);
  const slugLengthStr = await getSetting(db, "slug_default_length");
  const slugLength = slugLengthStr ? parseInt(slugLengthStr, 10) : DEFAULT_SLUG_LENGTH;
  return { db, theme, slugLength, lang, t, translations };
}

// ---- Admin pages ----

app.get("/_/admin/dashboard", async (c) => {
  const { db, theme, t, lang, translations } = await getPageData(c);
  const stats = await getDashboardStats(db);
  const userEmail = c.var.user?.email ?? null;
  return c.html(
    <Layout active="dashboard" theme={theme} t={t} lang={lang} translations={translations} userEmail={userEmail}>
      <DashboardPage stats={stats} t={t} lang={lang} />
    </Layout>,
  );
});

app.get("/_/admin/links", async (c) => {
  const { db, theme, slugLength, t, lang, translations } = await getPageData(c);
  const links = await getAllLinks(db);
  const sort = c.req.query("sort") || "recent";
  const page = parseInt(c.req.query("page") || "1", 10) || 1;
  const perPage = parseInt(c.req.query("per_page") || "25", 10) || 25;
  const showDisabled = c.req.query("show_disabled") === "1";
  const userEmail = c.var.user?.email ?? null;
  return c.html(
    <Layout active="links" theme={theme} t={t} lang={lang} translations={translations} userEmail={userEmail}>
      <LinksPage
        links={links}
        sort={sort}
        page={page}
        perPage={perPage}
        showDisabled={showDisabled}
        t={t}
        lang={lang}
      />
    </Layout>,
  );
});

app.get("/_/admin/links/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return notFoundResponse();
  const { db, theme, t, lang, translations } = await getPageData(c);
  const link = await getLinkById(db, id);
  if (!link) return notFoundResponse();
  const analytics = await getLinkClickStats(db, id);
  const userEmail = c.var.user?.email ?? null;
  return c.html(
    <Layout active="links" theme={theme} t={t} lang={lang} translations={translations} userEmail={userEmail}>
      <LinkDetailPage link={link} analytics={analytics} t={t} lang={lang} />
    </Layout>,
  );
});

app.get("/_/admin/keys", async (c) => {
  const { db, theme, t, lang, translations } = await getPageData(c);
  const keys = await getAllApiKeys(db);
  const userEmail = c.var.user?.email ?? null;
  return c.html(
    <Layout active="keys" theme={theme} t={t} lang={lang} translations={translations} userEmail={userEmail}>
      <KeysPage keys={keys} t={t} lang={lang} />
    </Layout>,
  );
});

app.get("/_/admin/settings", async (c) => {
  const { theme, slugLength, t, lang, translations } = await getPageData(c);
  const mcpConfigured = Boolean(
    c.env.ACCESS_CLIENT_ID &&
    c.env.ACCESS_CLIENT_SECRET &&
    c.env.ACCESS_TOKEN_URL &&
    c.env.ACCESS_AUTHORIZATION_URL &&
    c.env.ACCESS_JWKS_URL &&
    c.env.COOKIE_ENCRYPTION_KEY,
  );
  const userEmail = c.var.user?.email ?? null;
  return c.html(
    <Layout active="settings" theme={theme} t={t} lang={lang} translations={translations} userEmail={userEmail}>
      <SettingsPage theme={theme} slugLength={slugLength} lang={lang} t={t} mcpConfigured={mcpConfigured} />
    </Layout>,
  );
});

// ---- Legacy redirects ----

app.get("/_/admin", (c) => c.redirect("/_/admin/dashboard", 302));
app.get("/_/admin/", (c) => c.redirect("/_/admin/dashboard", 302));
app.get("/_/admin/link/:slug", (c) => c.redirect("/_/admin/links", 301));
app.get("/_/dashboard", (c) => c.redirect("/_/admin/dashboard", 301));
app.get("/_/links", (c) => c.redirect("/_/admin/links", 301));
app.get("/_/links/:id", (c) => c.redirect(`/_/admin/links/${c.req.param("id")}`, 301));
app.get("/_/keys", (c) => c.redirect("/_/admin/keys", 301));
app.get("/_/settings", (c) => c.redirect("/_/admin/settings", 301));

// ---- Admin API routes ----

// Keys
app.get("/_/admin/api/keys", (c) => handleListKeys(c.env));
app.post("/_/admin/api/keys", (c) => handleCreateKey(c.req.raw, c.env));
app.delete("/_/admin/api/keys/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDeleteKey(c.env, id);
});

// Links (admin path: no scope checks, full access)
app.post("/_/admin/api/links", (c) => handleCreateLink(c.req.raw, c.env, "app"));
app.get("/_/admin/api/links", (c) => handleListLinks(c.env));
app.get("/_/admin/api/links/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleGetLink(c.env, id);
});
app.put("/_/admin/api/links/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleUpdateLink(c.req.raw, c.env, id);
});
app.get("/_/admin/api/links/:id/analytics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleLinkAnalytics(c.env, id);
});
app.post("/_/admin/api/links/:id/disable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDisableLink(c.env, id);
});
app.post("/_/admin/api/links/:id/slugs", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleAddVanitySlug(c.req.raw, c.env, id);
});
app.get("/_/admin/api/links/:id/qr", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleLinkQr(c.req.raw, c.env, id);
});

// Settings
app.get("/_/admin/api/settings", (c) => handleGetSettings(c.env));
app.put("/_/admin/api/settings", (c) => handleUpdateSettings(c.req.raw, c.env));

// Dashboard stats
app.get("/_/admin/api/dashboard", (c) => handleDashboardStatsApi(c.env));

// ---- Public API auth middleware ----

app.use("/_/api/*", async (c, next) => {
  const auth = await resolveAuth(c.req.raw, c.env);
  if (!auth) return unauthorizedResponse();
  c.set("auth", auth);
  await next();
});

// ---- Public API routes (link management only) ----

app.post("/_/api/links", (c) => {
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  const via = c.req.header("X-Client") === "sdk" ? "sdk" : "api";
  return handleCreateLink(c.req.raw, c.env, via);
});
app.get("/_/api/links", (c) => {
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleListLinks(c.env);
});
app.get("/_/api/links/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleGetLink(c.env, id);
});
app.put("/_/api/links/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleUpdateLink(c.req.raw, c.env, id);
});
app.get("/_/api/links/:id/analytics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleLinkAnalytics(c.env, id);
});
app.post("/_/api/links/:id/disable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleDisableLink(c.env, id);
});
app.post("/_/api/links/:id/slugs", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleAddVanitySlug(c.req.raw, c.env, id);
});
app.get("/_/api/links/:id/qr", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleLinkQr(c.req.raw, c.env, id);
});

// ---- Root redirect ----

app.get("/", (c) => c.redirect("/_/admin/dashboard", 302));

// ---- Slug redirect (catch-all) ----

app.get("/:slug", (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug.startsWith("_")) return notFoundResponse();
  return handleRedirect(slug, c.req.raw, c.env.DB, c.executionCtx);
});

// ---- 404 fallback ----

app.notFound(() => notFoundResponse());

// ---- MCP OAuth provider (top-level Worker export) ----

export { ShrtnrMCP };

const oauthProvider = new OAuthProvider({
  apiHandler: ShrtnrMCP.serve("/_/mcp"),
  apiRoute: "/_/mcp",
  authorizeEndpoint: "/oauth/authorize",
  clientRegistrationEndpoint: "/oauth/register",
  defaultHandler: {
    fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/oauth/authorize" || pathname === "/oauth/callback") {
        return handleAccessRequest(request, env as never, ctx);
      }
      return app.fetch(request, env, ctx);
    },
  },
  tokenEndpoint: "/oauth/token",
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Serve the landing page for unauthenticated browser visits to /_/mcp.
    // The OAuthProvider treats all /_/mcp requests as API calls requiring a
    // Bearer token, so we intercept browser GETs before it runs.
    const url = new URL(request.url);
    if (
      request.method === "GET" &&
      url.pathname === "/_/mcp" &&
      !request.headers.has("Authorization") &&
      request.headers.get("Accept")?.includes("text/html")
    ) {
      return mcpLandingResponse();
    }
    return oauthProvider.fetch(request, env, ctx);
  },
};

// ---- Auth helpers ----

async function resolveAuth(
  request: Request,
  env: Env,
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const key = await authenticateApiKey(env.DB, token);
    if (key) {
      return { source: "apikey", scope: key.scope };
    }
  }
  return null;
}

function hasScope(auth: AuthContext, required: string): boolean {
  if (auth.scope === null) return true;
  return auth.scope.split(",").includes(required);
}

function forbiddenResponse(): Response {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
