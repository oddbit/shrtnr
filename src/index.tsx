// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Hono } from "hono";
import type { Env } from "./types";
import { handleRedirect } from "./redirect";
import { getAuthenticatedEmail, unauthorizedResponse } from "./auth";
import {
  authenticateApiKey,
  getAllLinks,
  getLinkById,
  getDashboardStats,
  getLinkClickStats,
  getApiKeysByEmail,
  getSetting,
  getUserPreferences,
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
import {
  handleGetPreferences,
  handleUpdatePreferences,
} from "./api/preferences";
import { handleListKeys, handleCreateKey, handleDeleteKey } from "./api/keys";
import {
  handleDashboardStats as handleDashboardStatsApi,
  handleLinkAnalytics,
} from "./api/analytics";
import { serveAsset } from "./assets";
import { notFoundResponse } from "./404";
import { handleMcpRequest } from "./mcp/handler";

import { Layout } from "./pages/layout";
import { DashboardPage } from "./pages/dashboard";
import { LinksPage } from "./pages/links";
import { LinkDetailPage } from "./pages/link-detail";
import { KeysPage } from "./pages/keys";
import { SettingsPage } from "./pages/settings";

// ---- Types ----

type AuthContext = {
  email: string;
  source: "access" | "apikey";
  scope: string | null;
};

type HonoEnv = {
  Bindings: Env;
  Variables: {
    email: string;
    auth: AuthContext;
  };
};

const app = new Hono<HonoEnv>();

// ---- Static assets ----

app.get("/favicon.ico", (c) => {
  const asset = serveAsset("/favicon.ico");
  return asset || notFoundResponse();
});

app.get("/apple-touch-icon.png", (c) => {
  const asset = serveAsset("/apple-touch-icon.png");
  return asset || notFoundResponse();
});

// ---- Health check (public) ----

app.get("/_/health", () => handleHealth());

// ---- Admin page helpers ----

async function getPageData(c: { env: Env; var: { email: string } }) {
  const db = c.env.DB;
  const email = c.var.email;
  const prefs = await getUserPreferences(db, email);
  const theme = prefs.theme || "oddbit";
  const lang = prefs.language || "en";
  const t = createTranslateFn(lang);
  const translations = getTranslations(lang);
  const slugLengthStr = await getSetting(db, "slug_default_length");
  const slugLength = slugLengthStr ? parseInt(slugLengthStr, 10) : DEFAULT_SLUG_LENGTH;
  return { db, email, theme, slugLength, lang, t, translations };
}

// ---- Admin page auth middleware ----

app.use("/_/dashboard", cfAccessMiddleware);
app.use("/_/links", cfAccessMiddleware);
app.use("/_/links/*", cfAccessMiddleware);
app.use("/_/keys", cfAccessMiddleware);
app.use("/_/settings", cfAccessMiddleware);

async function cfAccessMiddleware(
  c: { req: { raw: Request }; set: (key: string, value: string) => void },
  next: () => Promise<void>,
) {
  const email = getAuthenticatedEmail(c.req.raw);
  if (!email) return unauthorizedResponse();
  c.set("email", email);
  await next();
}

// ---- Admin pages ----

app.get("/_/dashboard", async (c) => {
  const { db, email, theme, t, lang, translations } = await getPageData(c);
  const stats = await getDashboardStats(db);
  return c.html(
    <Layout email={email} active="dashboard" theme={theme} t={t} lang={lang} translations={translations}>
      <DashboardPage stats={stats} t={t} />
    </Layout>,
  );
});

app.get("/_/links", async (c) => {
  const { db, email, theme, slugLength, t, lang, translations } = await getPageData(c);
  const links = await getAllLinks(db);
  const sort = c.req.query("sort") || "recent";
  const page = parseInt(c.req.query("page") || "1", 10) || 1;
  const perPage = parseInt(c.req.query("per_page") || "25", 10) || 25;
  const showDisabled = c.req.query("show_disabled") === "1";
  return c.html(
    <Layout email={email} active="links" theme={theme} t={t} lang={lang} translations={translations}>
      <LinksPage
        links={links}
        sort={sort}
        page={page}
        perPage={perPage}
        showDisabled={showDisabled}
        slugLength={slugLength}
        t={t}
        lang={lang}
      />
    </Layout>,
  );
});

app.get("/_/links/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return notFoundResponse();
  const { db, email, theme, t, lang, translations } = await getPageData(c);
  const link = await getLinkById(db, id);
  if (!link) return notFoundResponse();
  const analytics = await getLinkClickStats(db, id);
  return c.html(
    <Layout email={email} active="links" theme={theme} t={t} lang={lang} translations={translations}>
      <LinkDetailPage link={link} analytics={analytics} t={t} />
    </Layout>,
  );
});

app.get("/_/keys", async (c) => {
  const { db, email, theme, t, lang, translations } = await getPageData(c);
  const keys = await getApiKeysByEmail(db, email);
  return c.html(
    <Layout email={email} active="keys" theme={theme} t={t} lang={lang} translations={translations}>
      <KeysPage keys={keys} t={t} lang={lang} />
    </Layout>,
  );
});

app.get("/_/settings", async (c) => {
  const { email, theme, slugLength, t, lang, translations } = await getPageData(c);
  return c.html(
    <Layout email={email} active="settings" theme={theme} t={t} lang={lang} translations={translations}>
      <SettingsPage theme={theme} slugLength={slugLength} lang={lang} t={t} />
    </Layout>,
  );
});

// ---- Legacy admin redirects ----

app.get("/_/admin", (c) => c.redirect("/_/dashboard", 302));
app.get("/_/admin/", (c) => c.redirect("/_/dashboard", 302));
app.get("/_/admin/dashboard", (c) => c.redirect("/_/dashboard", 301));
app.get("/_/admin/links", (c) => c.redirect("/_/links", 301));
app.get("/_/admin/keys", (c) => c.redirect("/_/keys", 301));
app.get("/_/admin/settings", (c) => c.redirect("/_/settings", 301));
app.get("/_/admin/link/:slug", (c) => c.redirect("/_/links", 301));

// ---- MCP endpoint (API key auth) ----

app.all("/_/mcp", async (c) => {
  const auth = await resolveAuth(c.req.raw, c.env);
  if (!auth) return unauthorizedResponse();
  return handleMcpRequest(c.req.raw, c.env, c.executionCtx);
});

// ---- API auth middleware ----

app.use("/_/api/*", async (c, next) => {
  const auth = await resolveAuth(c.req.raw, c.env);
  if (!auth) return unauthorizedResponse();
  c.set("auth", auth);
  c.set("email", auth.email);
  await next();
});

// ---- API routes ----

// Keys (admin only)
app.get("/_/api/keys", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleListKeys(c.env, c.var.auth.email);
});
app.post("/_/api/keys", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleCreateKey(c.req.raw, c.env, c.var.auth.email);
});
app.delete("/_/api/keys/:id", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDeleteKey(c.env, c.var.auth.email, id);
});

// Links (scoped)
app.post("/_/api/links", (c) => {
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleCreateLink(c.req.raw, c.env);
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

// Settings (admin only)
app.get("/_/api/settings", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleGetSettings(c.env);
});
app.put("/_/api/settings", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleUpdateSettings(c.req.raw, c.env);
});

// Preferences (admin only)
app.get("/_/api/preferences", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleGetPreferences(c.env, c.var.auth.email);
});
app.put("/_/api/preferences", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleUpdatePreferences(c.req.raw, c.env, c.var.auth.email);
});

// Dashboard stats (admin only)
app.get("/_/api/dashboard", (c) => {
  const denied = requireAdmin(c.var.auth);
  if (denied) return denied;
  return handleDashboardStatsApi(c.env);
});

// ---- Root redirect ----

app.get("/", (c) => c.redirect("/_/dashboard", 302));

// ---- Slug redirect (catch-all) ----

app.get("/:slug", (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug.startsWith("_")) return notFoundResponse();
  return handleRedirect(slug, c.req.raw, c.env.DB, c.executionCtx);
});

// ---- 404 fallback ----

app.notFound(() => notFoundResponse());

export default app;

// ---- Auth helpers ----

async function resolveAuth(
  request: Request,
  env: Env,
): Promise<AuthContext | null> {
  const email = getAuthenticatedEmail(request);
  if (email) {
    return { email, source: "access", scope: null };
  }
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
  if (auth.scope === null) return true;
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
