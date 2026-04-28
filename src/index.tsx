// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Worker entry point.
//
// Authentication architecture:
// - Cloudflare Access protects the MCP endpoint (/_/mcp) as a self-hosted
//   application with Managed OAuth enabled. Access handles the full OAuth
//   protocol for MCP clients: discovery, client registration, token
//   issuance, and token validation.
// - By the time requests reach this Worker, Access has validated the
//   token and added identity headers (Cf-Access-Jwt-Assertion,
//   Cf-Access-Authenticated-User-Email).
// - The Worker extracts identity from these headers and passes it as
//   props to the McpAgent Durable Object via ctx.props.
// - The admin dashboard (/_/admin/*) is protected by a separate Access
//   application with its own policies.
// - In dev mode (no ACCESS_AUD), identity falls back to DEV_IDENTITY
//   or "anonymous" so MCP and admin routes work without Access.

import { Hono } from "hono";
import type { Env, TimelineRange } from "./types";
import { verifyAccessJwt, extractIdentity, isSignedIn, type AccessUser } from "./access";
import { handleRedirect } from "./redirect";
import { unauthorizedResponse } from "./auth";
import {
  authenticateApiKey,
  getAppSettings,
  resolveClickFilters,
  getDashboardStats,
  getLinkAnalytics,
  listLinks,
  getLink,
  searchLinks,
  listAllApiKeys,
  listBundlesForLink,
  listBundles,
  getBundle,
  listBundleLinks,
  getBundleAnalytics,
} from "./services";
import { DEFAULT_SLUG_LENGTH } from "./constants";
import { createTranslateFn, getTranslations } from "./i18n";
import { handleHealth } from "./api/health";
import {
  handleListLinks,
  handleGetLink,
  handleCreateLink,
  handleUpdateLink,
  handleDisableLink,
  handleEnableLink,
  handleDeleteLink,
  handleGetLinkBySlug,
} from "./api/links";
import {
  handleAddCustomSlug,
  handleSetPrimarySlug,
  handleDisableSlug,
  handleEnableSlug,
  handleRemoveSlug,
} from "./api/slugs";
import { handleGetSettings, handleUpdateSettings } from "./api/settings";
import { handleListKeys, handleCreateKey, handleDeleteKey } from "./api/keys";
import {
  handleDashboardStats as handleDashboardStatsApi,
  handleLinkAnalytics,
  handleLinkTimeline,
} from "./api/analytics";
import {
  handleAddLinkToBundle,
  handleArchiveBundle,
  handleBundleAnalytics,
  handleBundleLinks,
  handleCreateBundle,
  handleDeleteBundle,
  handleGetBundle,
  handleListBundles,
  handleListBundlesForLink,
  handleRemoveLinkFromBundle,
  handleUnarchiveBundle,
  handleUpdateBundle,
} from "./api/bundles";
import { handleLinkQr } from "./api/qr";
import { notFoundResponse } from "./404";
import { landingResponse } from "./pages/landing";
import { mcpLandingResponse } from "./mcp/page";
import { ShrtnrMCP } from "./mcp/server";

import { Layout } from "./pages/layout";
import { DashboardPage } from "./pages/dashboard";
import { LinksPage } from "./pages/links";
import { LinkDetailPage } from "./pages/link-detail";
import { KeysPage } from "./pages/keys";
import { SettingsPage } from "./pages/settings";
import { BundlesPage } from "./pages/bundles";
import { BundleDetailPage } from "./pages/bundle-detail";

// ---- Types ----

type AuthContext = {
  source: "apikey";
  scope: string | null;
  identity: string;
};

type HonoEnv = {
  Bindings: Env;
  Variables: {
    auth: AuthContext;
    user: AccessUser | null;
    identity: string;
  };
};

const app = new Hono<HonoEnv>();

// ---- Health check (public) ----

app.get("/_/health", () => handleHealth());

// ---- Admin auth middleware ----

app.use("/_/admin/*", async (c, next) => {
  const user = await verifyAccessJwt(c.req.raw, c.env);
  // When ACCESS_AUD is configured, redirect unauthenticated visitors to
  // the landing page rather than showing a raw 403.
  if (c.env.ACCESS_AUD && !user) {
    return c.redirect("/", 302);
  }
  c.set("user", user);
  const identity = await extractIdentity(c.req.raw, c.env);
  c.set("identity", identity);
  await next();
});

// Admin HTML pages inline their CSS and JS, so a cached document pins the
// old styles after a deploy. Force revalidation on every HTML response under
// /_/admin/* (JSON API responses under /_/admin/api/* are left untouched).
app.use("/_/admin/*", async (c, next) => {
  await next();
  const contentType = c.res.headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    c.res.headers.set("Cache-Control", "private, no-cache, must-revalidate");
  }
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

async function getPageData(c: { env: Env; req: { raw: Request } }, identity: string) {
  const settingsResult = await getAppSettings(c.env, identity);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const theme = settings?.theme ?? getCookie(c.req.raw, "theme") ?? "oddbit";
  const lang = settings?.lang ?? getCookie(c.req.raw, "lang") ?? "en";
  const slugLength = settings?.slug_default_length ?? DEFAULT_SLUG_LENGTH;
  const defaultRange = settings?.default_range ?? null;
  const filterBots = settings?.filter_bots ?? true;
  const filterSelfReferrers = settings?.filter_self_referrers ?? true;
  const t = createTranslateFn(lang);
  const translations = getTranslations(lang);
  return { theme, slugLength, lang, defaultRange, filterBots, filterSelfReferrers, t, translations };
}

// ---- Admin pages ----

app.get("/_/admin/dashboard", async (c) => {
  const identity = c.var.identity;
  const { theme, t, lang, translations, defaultRange } = await getPageData(c, identity);
  const rangeParam = c.req.query("range");
  const validRanges = new Set(["24h", "7d", "30d", "90d", "1y", "all"]);
  const range = (validRanges.has(rangeParam || "") ? rangeParam : (defaultRange ?? "30d")) as TimelineRange;
  const statsResult = await getDashboardStats(c.env, range, identity);
  const stats = statsResult.ok
    ? statsResult.data
    : {
        range,
        total_links: 0,
        total_clicks: 0,
        total_clicks_previous: 0,
        total_clicks_delta: undefined,
        new_links_delta: undefined,
        clicks_per_day: 0,
        clicks_per_day_delta: undefined,
        num_domains: 0,
        num_countries: 0,
        clicked_links: 0,
        clicked_links_delta: undefined,
        timeline: [],
        timeline_links: [],
        timeline_clicked_links: [],
        recent_links: [],
        top_links: [],
        top_countries: [],
        top_referrers: [],
        num_referrers: 0,
      };
  return c.html(
    <Layout active="dashboard" theme={theme} t={t} lang={lang} translations={translations}>
      <DashboardPage stats={stats} t={t} lang={lang} range={range} />
    </Layout>,
  );
});

app.get("/_/admin/links", async (c) => {
  const identity = c.var.identity;
  const { theme, slugLength, t, lang, translations, defaultRange } = await getPageData(c, identity);
  const searchQuery = c.req.query("search") || "";
  const filters = await resolveClickFilters(c.env, identity);
  const validRanges = new Set<TimelineRange>(["24h", "7d", "30d", "90d", "1y", "all"]);
  const rangeParam = c.req.query("range");
  const range = (validRanges.has(rangeParam as TimelineRange) ? rangeParam : (defaultRange ?? "30d")) as TimelineRange;
  const linksResult = searchQuery
    ? await searchLinks(c.env, searchQuery, { includeOwner: true, withDeltaRange: range, filters, range })
    : await listLinks(c.env, { withDeltaRange: range, filters, range });
  const links = linksResult.ok ? linksResult.data : [];
  const sort = c.req.query("sort") || "recent";
  const page = parseInt(c.req.query("page") || "1", 10) || 1;
  const perPage = parseInt(c.req.query("per_page") || "25", 10) || 25;
  const filterParam = c.req.query("filter");
  const legacyShowDisabled = c.req.query("show_disabled") === "1";
  const filter = filterParam === "disabled" || filterParam === "all" || filterParam === "active"
    ? filterParam
    : legacyShowDisabled
      ? "all"
      : "active";
  return c.html(
    <Layout active="links" theme={theme} t={t} lang={lang} translations={translations}>
      <LinksPage
        links={links}
        sort={sort}
        page={page}
        perPage={perPage}
        filter={filter}
        range={range}
        searchQuery={searchQuery}
        t={t}
        lang={lang}
      />
    </Layout>,
  );
});

app.get("/_/admin/links/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return notFoundResponse();
  const identity = c.var.identity;
  const { theme, t, lang, translations, defaultRange } = await getPageData(c, identity);
  const initialRange: TimelineRange = defaultRange ?? "all";
  const filters = await resolveClickFilters(c.env, identity);
  const linkResult = await getLink(c.env, id, { filters, range: initialRange });
  if (!linkResult.ok) return notFoundResponse();
  const [analyticsResult, bundlesResult] = await Promise.all([
    getLinkAnalytics(c.env, id, initialRange, identity),
    listBundlesForLink(c.env, id, identity),
  ]);
  const analytics = analyticsResult.ok ? analyticsResult.data : {
    total_clicks: 0,
    countries: [], referrers: [], referrer_hosts: [], devices: [], os: [], browsers: [],
    link_modes: [], channels: [], clicks_over_time: [], slug_clicks: [],
    num_countries: 0, num_referrers: 0, num_referrer_hosts: 0, num_os: 0, num_browsers: 0,
  };
  const bundles = bundlesResult.ok ? bundlesResult.data : [];
  return c.html(
    <Layout active="links" theme={theme} t={t} lang={lang} translations={translations}>
      <LinkDetailPage link={linkResult.data} analytics={analytics} bundles={bundles} t={t} lang={lang} identity={identity} initialRange={initialRange} />
    </Layout>,
  );
});

app.get("/_/admin/bundles", async (c) => {
  const identity = c.var.identity;
  const { theme, t, lang, translations, defaultRange } = await getPageData(c, identity);
  const filterParam = c.req.query("filter");
  const filter = filterParam === "archived" || filterParam === "all" ? filterParam : "active";
  const validRanges = new Set<TimelineRange>(["24h", "7d", "30d", "90d", "1y", "all"]);
  const rangeParam = c.req.query("range");
  const range = (validRanges.has(rangeParam as TimelineRange) ? rangeParam : (defaultRange ?? "all")) as TimelineRange;
  const listResult = await listBundles(c.env, identity, {
    includeArchived: filter === "all",
    archivedOnly: filter === "archived",
    range,
  });
  const bundles = listResult.ok ? listResult.data : [];
  return c.html(
    <Layout active="bundles" theme={theme} t={t} lang={lang} translations={translations}>
      <BundlesPage bundles={bundles} t={t} lang={lang} filter={filter} range={range} />
    </Layout>,
  );
});

app.get("/_/admin/bundles/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return notFoundResponse();
  const identity = c.var.identity;
  const { theme, t, lang, translations, defaultRange } = await getPageData(c, identity);
  const rangeParam = c.req.query("range");
  const validRanges = new Set(["24h", "7d", "30d", "90d", "1y", "all"]);
  const range = (validRanges.has(rangeParam || "") ? rangeParam : (defaultRange ?? "30d")) as TimelineRange;
  const statsResult = await getBundleAnalytics(c.env, id, range, identity);
  if (!statsResult.ok) return notFoundResponse();
  return c.html(
    <Layout active="bundles" theme={theme} t={t} lang={lang} translations={translations}>
      <BundleDetailPage stats={statsResult.data} identity={identity} t={t} lang={lang} range={range} />
    </Layout>,
  );
});

app.get("/_/admin/keys", async (c) => {
  const identity = c.var.identity;
  const { theme, t, lang, translations } = await getPageData(c, identity);
  const keysResult = await listAllApiKeys(c.env, identity);
  const keys = keysResult.ok ? keysResult.data : [];
  return c.html(
    <Layout active="keys" theme={theme} t={t} lang={lang} translations={translations}>
      <KeysPage keys={keys as any} t={t} lang={lang} />
    </Layout>,
  );
});

app.get("/_/admin/settings", async (c) => {
  const identity = c.var.identity;
  const { theme, slugLength, t, lang, translations, defaultRange, filterBots, filterSelfReferrers } = await getPageData(c, identity);
  const mcpConfigured = Boolean(c.env.MCP_ACCESS_AUD && c.env.ACCESS_JWKS_URL);
  const userEmail = c.var.user?.email ?? null;
  return c.html(
    <Layout active="settings" theme={theme} t={t} lang={lang} translations={translations}>
      <SettingsPage theme={theme} slugLength={slugLength} lang={lang} defaultRange={defaultRange} filterBots={filterBots} filterSelfReferrers={filterSelfReferrers} t={t} mcpConfigured={mcpConfigured} userEmail={userEmail} />
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
app.get("/_/admin/api/keys", (c) => handleListKeys(c.env, c.var.identity));
app.post("/_/admin/api/keys", (c) => handleCreateKey(c.req.raw, c.env, c.var.identity));
app.delete("/_/admin/api/keys/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDeleteKey(c.env, c.var.identity, id);
});

// Links (admin path: no scope checks, full access)
app.post("/_/admin/api/links", (c) => handleCreateLink(c.req.raw, c.env, "app", c.var.identity, c.executionCtx));
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
  return handleLinkAnalytics(c.env, c.var.identity, id, c.req.query("range"));
});
app.get("/_/admin/api/links/:id/timeline", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleLinkTimeline(c.env, c.var.identity, id, c.req.query("range"));
});
app.post("/_/admin/api/links/:id/disable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDisableLink(c.env, id, c.var.identity);
});
app.post("/_/admin/api/links/:id/enable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleEnableLink(c.env, id, c.var.identity);
});
app.delete("/_/admin/api/links/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDeleteLink(c.env, id, c.var.identity);
});
app.post("/_/admin/api/links/:id/slugs", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleAddCustomSlug(c.req.raw, c.env, id);
});
app.put("/_/admin/api/links/:id/slugs/primary", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleSetPrimarySlug(c.req.raw, c.env, id);
});
app.post("/_/admin/api/links/:id/slugs/:slug/disable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const slug = c.req.param("slug");
  if (isNaN(id) || !slug) return c.json({ error: "Not Found" }, 404);
  return handleDisableSlug(c.env, id, slug, c.var.identity);
});
app.post("/_/admin/api/links/:id/slugs/:slug/enable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const slug = c.req.param("slug");
  if (isNaN(id) || !slug) return c.json({ error: "Not Found" }, 404);
  return handleEnableSlug(c.env, id, slug, c.var.identity);
});
app.delete("/_/admin/api/links/:id/slugs/:slug", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const slug = c.req.param("slug");
  if (isNaN(id) || !slug) return c.json({ error: "Not Found" }, 404);
  return handleRemoveSlug(c.env, id, slug, c.var.identity);
});
app.get("/_/admin/api/links/:id/qr", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleLinkQr(c.req.raw, c.env, id);
});

// Settings
app.get("/_/admin/api/settings", (c) => handleGetSettings(c.env, c.var.identity));
app.put("/_/admin/api/settings", (c) => handleUpdateSettings(c.req.raw, c.env, c.var.identity));

// Dashboard stats
app.get("/_/admin/api/dashboard", (c) => handleDashboardStatsApi(c.env, c.var.identity, c.req.query("range")));

// Bundles
app.get("/_/admin/api/bundles", (c) => handleListBundles(c.env, c.var.identity, { archived: c.req.query("archived") }));
app.post("/_/admin/api/bundles", (c) => handleCreateBundle(c.req.raw, c.env, c.var.identity, "app"));
app.get("/_/admin/api/bundles/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleGetBundle(c.env, id, c.var.identity);
});
app.put("/_/admin/api/bundles/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleUpdateBundle(c.req.raw, c.env, id, c.var.identity);
});
app.delete("/_/admin/api/bundles/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleDeleteBundle(c.env, id, c.var.identity);
});
app.post("/_/admin/api/bundles/:id/archive", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleArchiveBundle(c.env, id, c.var.identity);
});
app.post("/_/admin/api/bundles/:id/unarchive", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleUnarchiveBundle(c.env, id, c.var.identity);
});
app.get("/_/admin/api/bundles/:id/analytics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleBundleAnalytics(c.env, id, c.req.query("range"), c.var.identity);
});
app.get("/_/admin/api/bundles/:id/links", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleBundleLinks(c.env, id, c.var.identity);
});
app.post("/_/admin/api/bundles/:id/links", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleAddLinkToBundle(c.req.raw, c.env, id, c.var.identity);
});
app.delete("/_/admin/api/bundles/:id/links/:linkId", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const linkId = parseInt(c.req.param("linkId"), 10);
  if (isNaN(id) || isNaN(linkId)) return c.json({ error: "Not Found" }, 404);
  return handleRemoveLinkFromBundle(c.env, id, linkId, c.var.identity);
});
app.get("/_/admin/api/links/:id/bundles", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  return handleListBundlesForLink(c.env, id, c.var.identity);
});

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
  return handleCreateLink(c.req.raw, c.env, via, c.var.auth.identity, c.executionCtx);
});
app.get("/_/api/links", (c) => {
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleListLinks(c.env, c.req.query("owner") || undefined);
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
  return handleLinkAnalytics(c.env, c.var.auth.identity, id);
});
app.get("/_/api/links/:id/timeline", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleLinkTimeline(c.env, c.var.auth.identity, id, c.req.query("range"));
});
app.post("/_/api/links/:id/disable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleDisableLink(c.env, id, c.var.auth.identity);
});
app.post("/_/api/links/:id/enable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleEnableLink(c.env, id, c.var.auth.identity);
});
app.delete("/_/api/links/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleDeleteLink(c.env, id, c.var.auth.identity);
});
app.post("/_/api/links/:id/slugs", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleAddCustomSlug(c.req.raw, c.env, id);
});
app.post("/_/api/links/:id/slugs/:slug/disable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleDisableSlug(c.env, id, c.req.param("slug"), c.var.auth.identity);
});
app.post("/_/api/links/:id/slugs/:slug/enable", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleEnableSlug(c.env, id, c.req.param("slug"), c.var.auth.identity);
});
app.delete("/_/api/links/:id/slugs/:slug", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleRemoveSlug(c.env, id, c.req.param("slug"), c.var.auth.identity);
});
app.get("/_/api/links/:id/qr", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleLinkQr(c.req.raw, c.env, id);
});
app.get("/_/api/slugs/:slug", (c) => {
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleGetLinkBySlug(c.env, c.req.param("slug"));
});

// Public API: bundles
app.get("/_/api/bundles", (c) => {
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleListBundles(c.env, c.var.auth.identity, { archived: c.req.query("archived") });
});
app.post("/_/api/bundles", (c) => {
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  const via = c.req.header("X-Client") === "sdk" ? "sdk" : "api";
  return handleCreateBundle(c.req.raw, c.env, c.var.auth.identity, via);
});
app.get("/_/api/bundles/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleGetBundle(c.env, id, c.var.auth.identity);
});
app.put("/_/api/bundles/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleUpdateBundle(c.req.raw, c.env, id, c.var.auth.identity);
});
app.delete("/_/api/bundles/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleDeleteBundle(c.env, id, c.var.auth.identity);
});
app.post("/_/api/bundles/:id/archive", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleArchiveBundle(c.env, id, c.var.auth.identity);
});
app.post("/_/api/bundles/:id/unarchive", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleUnarchiveBundle(c.env, id, c.var.auth.identity);
});
app.get("/_/api/bundles/:id/analytics", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleBundleAnalytics(c.env, id, c.req.query("range"), c.var.auth.identity);
});
app.get("/_/api/bundles/:id/links", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleBundleLinks(c.env, id, c.var.auth.identity);
});
app.post("/_/api/bundles/:id/links", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleAddLinkToBundle(c.req.raw, c.env, id, c.var.auth.identity);
});
app.delete("/_/api/bundles/:id/links/:linkId", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const linkId = parseInt(c.req.param("linkId"), 10);
  if (isNaN(id) || isNaN(linkId)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "create")) return forbiddenResponse();
  return handleRemoveLinkFromBundle(c.env, id, linkId, c.var.auth.identity);
});
app.get("/_/api/links/:id/bundles", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Not Found" }, 404);
  if (!hasScope(c.var.auth, "read")) return forbiddenResponse();
  return handleListBundlesForLink(c.env, id, c.var.auth.identity);
});

// ---- Root landing page ----

app.get("/", async (c) => {
  if (await isSignedIn(c.req.raw, c.env)) return c.redirect("/_/admin/dashboard", 302);
  return landingResponse();
});

app.get("/_", async (c) => {
  if (await isSignedIn(c.req.raw, c.env)) return c.redirect("/_/admin/dashboard", 302);
  return c.redirect("/", 302);
});

// ---- Slug redirect (catch-all) ----

app.get("/:slug", (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug.startsWith("_")) return notFoundResponse();
  return handleRedirect(slug, c.req.raw, c.env, c.executionCtx);
});

// ---- 404 fallback ----

app.notFound(() => notFoundResponse());

// ---- MCP transport handler ----

export { ShrtnrMCP };

const mcpHandler = ShrtnrMCP.serve("/_/mcp");

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let url = new URL(request.url);

    // CF Access MCP-type applications cannot be scoped to a path — they must
    // own a full subdomain. Requests arriving on mcp.* are rewritten to the
    // /_/mcp path so the rest of the routing logic stays unchanged.
    // The CF MCP portal sends requests to /mcp on the subdomain, so strip that
    // prefix before prepending the internal /_/mcp mount point.
    if (
      url.host.startsWith("mcp.") &&
      !url.pathname.startsWith("/.well-known") &&
      !url.pathname.startsWith("/cdn-cgi/")
    ) {
      const rewritten = new URL(url.href);
      const stripped = url.pathname.replace(/^\/mcp(?=\/|$)/, "") || "/";
      rewritten.pathname = "/_/mcp" + (stripped === "/" ? "" : stripped);
      request = new Request(rewritten, request);
      url = rewritten;
    }

    // MCP landing page for browser visits (no Bearer token, wants HTML).
    if (
      request.method === "GET" &&
      url.pathname === "/_/mcp" &&
      !request.headers.has("Authorization") &&
      request.headers.get("Accept")?.includes("text/html")
    ) {
      return mcpLandingResponse();
    }

    // MCP transport endpoint.
    // The MCP Access application has its own AUD tag (MCP_ACCESS_AUD),
    // distinct from the admin application (ACCESS_AUD). Pass it explicitly
    // so JWT validation uses the correct audience.
    if (url.pathname === "/_/mcp" || url.pathname.startsWith("/_/mcp/")) {
      const identity = await extractIdentity(request, env, env.MCP_ACCESS_AUD);
      // In production (MCP_ACCESS_AUD set), reject anonymous requests so
      // MCP clients and the CF Access AI Controls portal correctly detect
      // that this endpoint requires authentication.
      if (identity === "anonymous" && env.MCP_ACCESS_AUD) {
        return new Response("Unauthorized", {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer realm="shrtnr"`,
          },
        });
      }
      (ctx as unknown as { props: Record<string, unknown> }).props = {
        email: identity,
      };
      return mcpHandler.fetch!(request, env, ctx);
    }

    // OAuth Authorization Server Metadata (RFC 8414).
    // MCP clients fetch this to discover OAuth endpoints. Endpoints are
    // served at the application domain so CF Access can intercept
    // /cdn-cgi/access/* requests with the correct application context.
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      const base = `${url.protocol}//${url.host}`;
      return Response.json(
        {
          issuer: base,
          authorization_endpoint: `${base}/cdn-cgi/access/oauth/authorization`,
          token_endpoint: `${base}/cdn-cgi/access/oauth/token`,
          registration_endpoint: `${base}/cdn-cgi/access/oauth/registration`,
          jwks_uri: `${base}/cdn-cgi/access/certs`,
          revocation_endpoint: `${base}/cdn-cgi/access/oauth/revoke`,
          response_types_supported: ["code"],
          response_modes_supported: ["query"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "client_secret_post",
            "none",
          ],
          code_challenge_methods_supported: ["S256"],
        },
        { headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Old OAuth routes: return 404.
    if (url.pathname.startsWith("/oauth/")) {
      return notFoundResponse();
    }

    // Everything else goes to the Hono app.
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

// ---- Auth helpers ----

async function resolveAuth(
  request: Request,
  env: Env,
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const key = await authenticateApiKey(env, token);
    if (key) {
      return { source: "apikey", scope: key.scope, identity: key.identity };
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
