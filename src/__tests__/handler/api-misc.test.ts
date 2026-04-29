import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

const AUTH_HEADER = { "Cf-Access-Jwt-Assertion": makeJwt("test@example.com") };

function authed(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, {
    ...init,
    headers: { ...AUTH_HEADER, ...(init?.headers ?? {}) },
  });
}

function unauthed(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, init);
}

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Routing ----

describe("Routing", () => {
  it("GET / should return the landing page with status 200", async () => {
    const res = await SELF.fetch(unauthed("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET / landing page should display URL SHORTENER subtitle", async () => {
    const res = await SELF.fetch(unauthed("/"));
    const body = await res.text();
    expect(body).toContain("URL SHORTENER");
  });

  it("GET / landing page should contain a login link to /_/admin/dashboard", async () => {
    const res = await SELF.fetch(unauthed("/"));
    const body = await res.text();
    expect(body).toContain('href="/_/admin/dashboard"');
    expect(body).toMatch(/login/i);
  });

  it("GET /_/health should return ok without auth", async () => {
    const res = await SELF.fetch(unauthed("/_/health"));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("GET /_/health should include version string", async () => {
    const res = await SELF.fetch(unauthed("/_/health"));
    const body = await res.json() as { version: string };
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("GET /_/admin should redirect to /_/admin/dashboard", async () => {
    const res = await SELF.fetch(unauthed("/_/admin"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/_/admin/dashboard");
  });

  it("GET /_/admin/dashboard should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/admin/dashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/admin/dashboard should set a no-cache Cache-Control header", async () => {
    const res = await SELF.fetch(authed("/_/admin/dashboard"));
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });

  it("GET /_/admin/links should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/admin/links"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/admin/links should set a no-cache Cache-Control header", async () => {
    const res = await SELF.fetch(authed("/_/admin/links"));
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });

  it("GET /_/admin/settings should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/admin/settings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/admin/settings should set a no-cache Cache-Control header", async () => {
    const res = await SELF.fetch(authed("/_/admin/settings"));
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });

  it("GET /_/admin/keys should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/admin/keys"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/admin/keys should set a no-cache Cache-Control header", async () => {
    const res = await SELF.fetch(authed("/_/admin/keys"));
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });

  it("GET /_/admin/dashboard without auth should render as anonymous", async () => {
    const res = await SELF.fetch(unauthed("/_/admin/dashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("paths starting with _ should return 404", async () => {
    const res = await SELF.fetch(unauthed("/_unknown"));
    expect(res.status).toBe(404);
  });
});
// ---- Redirect ----

describe("Redirect", () => {
  it("should 301 redirect for a valid active slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://destination.com" }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    const res = await SELF.fetch(unauthed(`/${slug}`), { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://destination.com/");
  });

  it("should return 404 for a non-existent slug", async () => {
    const res = await SELF.fetch(unauthed("/nonexistent999"));
    expect(res.status).toBe(404);
  });

  it("should return 404 for an expired slug", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", expires_at: past }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    const res = await SELF.fetch(unauthed(`/${slug}`));
    expect(res.status).toBe(404);
  });

  it("should redirect for a slug with future expiry", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", expires_at: future }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    const res = await SELF.fetch(unauthed(`/${slug}`), { redirect: "manual" });
    expect(res.status).toBe(301);
  });

  it("should redirect for a slug with null expires_at", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    const res = await SELF.fetch(unauthed(`/${slug}`), { redirect: "manual" });
    expect(res.status).toBe(301);
  });

  it("should stop redirecting after disable", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    // Set expires_at to a past timestamp (avoids same-second race with disableLink)
    const past = Math.floor(Date.now() / 1000) - 60;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_at: past }),
      })
    );
    // Redirect should now 404
    const res = await SELF.fetch(unauthed(`/${slug}`), { redirect: "manual" });
    expect(res.status).toBe(404);
  });

  it("should resume redirecting after re-enable", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    // Disable then enable
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/disable`, { method: "POST" })
    );
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_at: null }),
      })
    );
    const res = await SELF.fetch(unauthed(`/${slug}`), { redirect: "manual" });
    expect(res.status).toBe(301);
  });
});
// ---- Settings API ----

describe("Settings API", () => {
  it("GET /_/admin/api/settings should return slug_default_length", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/settings"));
    const body = await res.json() as any;
    expect(body.slug_default_length).toBe(3);
  });

  it("PUT /_/admin/api/settings should update slug_default_length", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug_default_length: 5 }),
      })
    );
    const body = await res.json() as any;
    expect(body.slug_default_length).toBe(5);
  });

  it("PUT /_/admin/api/settings with value below 3 should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug_default_length: 2 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("GET /_/admin/api/settings should return 30d default_range when unset", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/settings"));
    const body = await res.json() as any;
    expect(body.default_range).toBe("30d");
  });

  it("PUT /_/admin/api/settings should update default_range", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_range: "7d" }),
      })
    );
    const body = await res.json() as any;
    expect(body.default_range).toBe("7d");
  });

  it("PUT /_/admin/api/settings with invalid default_range should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_range: "nope" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("dashboard page uses default_range when no ?range= is given", async () => {
    await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_range: "7d" }),
      })
    );
    const res = await SELF.fetch(authed("/_/admin/dashboard"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/class="active"\s+data-range="7d"/);
  });

  it("dashboard ?range= query param overrides default_range", async () => {
    await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_range: "7d" }),
      })
    );
    const res = await SELF.fetch(authed("/_/admin/dashboard?range=90d"));
    const html = await res.text();
    expect(html).toMatch(/class="active"\s+data-range="90d"/);
  });

  it("dashboard page falls back to 30d when no default_range is set", async () => {
    const res = await SELF.fetch(authed("/_/admin/dashboard"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/class="active"\s+data-range="30d"/);
  });

  it("links page falls back to 30d when no default_range is set", async () => {
    const res = await SELF.fetch(authed("/_/admin/links"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/class="active"\s+data-range="30d"/);
  });

  it("bundles page falls back to 30d when no default_range is set", async () => {
    const res = await SELF.fetch(authed("/_/admin/bundles"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/class="active"\s+data-range="30d"/);
  });

  it("new links should use updated default length", async () => {
    await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug_default_length: 6 }),
      })
    );
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const body = await res.json() as any;
    const autoSlug = body.slugs.find((s: any) => s.is_custom === 0);
    expect(autoSlug.slug).toHaveLength(6);
  });
});
// ---- Analytics API ----

describe("Analytics API", () => {
  it("GET /_/admin/api/links/:id/analytics should return click stats", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(authed(`/_/admin/api/links/${created.id}/analytics`));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_clicks).toBe(0);
    expect(body.countries).toEqual([]);
  });

  it("GET /_/admin/api/dashboard should return dashboard stats", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.total_links).toBe("number");
    expect(typeof body.total_clicks).toBe("number");
    expect(Array.isArray(body.recent_links)).toBe(true);
  });

  it("GET /_/admin/api/dashboard top_links should include url for each link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://target.example.com" }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    // top_links is ranked by clicks within the range window, so the link
    // must be clicked at least once to appear. Use a browser UA so the click
    // is not flagged as a bot (default analytics filters exclude bot traffic).
    await SELF.fetch(unauthed(`/${slug}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    }));
    const res = await SELF.fetch(authed("/_/admin/api/dashboard"));
    const body = await res.json() as any;
    expect(Array.isArray(body.top_links)).toBe(true);
    expect(body.top_links.length).toBeGreaterThan(0);
    expect(body.top_links[0].url).toBe("https://target.example.com");
  });

  it("GET /_/admin/api/dashboard top_links is empty when no clicks exist in range", async () => {
    await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://noclicks.example.com" }),
      })
    );
    const res = await SELF.fetch(authed("/_/admin/api/dashboard"));
    const body = await res.json() as any;
    expect(Array.isArray(body.top_links)).toBe(true);
    expect(body.top_links.length).toBe(0);
  });

  it("GET /_/admin/api/dashboard top_countries should return country codes", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/dashboard"));
    const body = await res.json() as any;
    expect(Array.isArray(body.top_countries)).toBe(true);
  });
});
// ---- Invalid JSON Bodies ----

describe("Invalid JSON Bodies", () => {
  it("POST /_/admin/api/links with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("PUT /_/admin/api/settings with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/admin/api/keys with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });
});
// ---- Nonexistent Resources ----

describe("Nonexistent Resources", () => {
  it("GET /_/admin/api/links/:id/analytics for nonexistent link should return 404", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/links/99999/analytics"));
    expect(res.status).toBe(404);
  });

  it("POST /_/admin/api/links/:id/slugs for nonexistent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links/99999/slugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "orphan" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("PUT /_/admin/api/links/:id for nonexistent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links/99999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://nowhere.com" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /_/admin/api/keys/:id for nonexistent key should return 404", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/keys/99999", { method: "DELETE" }));
    expect(res.status).toBe(404);
  });
});
// ---- Feature: Landing page redirect for authenticated users ----

describe("Landing page redirect", () => {
  // TODO: Implement landing page redirect for authenticated users.
  // When a user visits / with a valid auth token, they should be
  // redirected (302) to /_/admin/dashboard instead of seeing the
  // landing page.

  it("GET / with auth should redirect to /_/admin/dashboard", async () => {
    const res = await SELF.fetch(authed("/"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/_/admin/dashboard");
  });

  it("GET / without auth should still return the landing page", async () => {
    const res = await SELF.fetch(unauthed("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("URL SHORTENER");
  });
});
// ---- Feature: /_/admin/ redirect to dashboard ----

describe("Admin root redirect", () => {
  // TODO: Verify existing redirect from /_/admin/ to /_/admin/dashboard.
  // Both /_/admin and /_/admin/ should 302 to /_/admin/dashboard.

  it("GET /_/admin/ should redirect to /_/admin/dashboard", async () => {
    const res = await SELF.fetch(unauthed("/_/admin/"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/_/admin/dashboard");
  });

  it("GET /_/admin should redirect to /_/admin/dashboard", async () => {
    const res = await SELF.fetch(unauthed("/_/admin"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/_/admin/dashboard");
  });
});
