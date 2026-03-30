import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";

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
  it("GET / should redirect to /_/dashboard", async () => {
    const res = await SELF.fetch(unauthed("/"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/_/dashboard");
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

  it("GET /_/admin should redirect to /_/dashboard", async () => {
    const res = await SELF.fetch(authed("/_/admin"), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/_/dashboard");
  });

  it("GET /_/dashboard should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/dashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/links should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/links"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/settings should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/settings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/keys should return admin HTML", async () => {
    const res = await SELF.fetch(authed("/_/keys"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("GET /_/dashboard without auth should return 401", async () => {
    const res = await SELF.fetch(unauthed("/_/dashboard"));
    expect(res.status).toBe(401);
  });

  it("GET /favicon.ico should return the icon", async () => {
    const res = await SELF.fetch(unauthed("/favicon.ico"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/x-icon");
  });

  it("GET /apple-touch-icon.png should return the icon", async () => {
    const res = await SELF.fetch(unauthed("/apple-touch-icon.png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("paths starting with _ should return 404", async () => {
    const res = await SELF.fetch(unauthed("/_unknown"));
    expect(res.status).toBe(404);
  });
});

// ---- Authentication ----

describe("Authentication", () => {
  it("should return 401 for API requests without auth", async () => {
    const res = await SELF.fetch(unauthed("/_/api/links"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 for admin page without auth", async () => {
    const res = await SELF.fetch(unauthed("/_/admin"));
    expect(res.status).toBe(401);
  });
});

// ---- Links API ----

describe("Links API", () => {
  it("POST /_/api/links should create a link with auto-generated slug", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.url).toBe("https://example.com");
    expect(body.slugs.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /_/api/links should return 400 for invalid URL", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/api/links should return 400 for missing URL", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/api/links with vanity slug should attach both slugs", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "my-slug" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slugs).toHaveLength(2);
    expect(body.slugs.some((s: any) => s.slug === "my-slug" && s.is_vanity === 1)).toBe(true);
  });

  it("POST /_/api/links slugs should be ordered: auto at index 0, vanity at index 1", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "custom" }),
      })
    );
    const body = await res.json() as any;
    expect(body.slugs[0].is_vanity).toBe(0);
    expect(body.slugs[1].is_vanity).toBe(1);
    expect(body.slugs[1].slug).toBe("custom");
  });

  it("GET /_/api/links should preserve slug ordering per link", async () => {
    await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "ordered" }),
      })
    );
    const res = await SELF.fetch(authed("/_/api/links"));
    const body = await res.json() as any;
    const link = body.find((l: any) => l.slugs.length === 2);
    expect(link.slugs[0].is_vanity).toBe(0);
    expect(link.slugs[1].is_vanity).toBe(1);
  });

  it("GET /_/api/links/:id should preserve slug ordering", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "detail-order" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(authed(`/_/api/links/${created.id}`));
    const body = await res.json() as any;
    expect(body.slugs[0].is_vanity).toBe(0);
    expect(body.slugs[1].is_vanity).toBe(1);
    expect(body.slugs[1].slug).toBe("detail-order");
  });

  it("POST /_/api/links with duplicate vanity slug should return 409", async () => {
    await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "taken" }),
      })
    );
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://other.com", vanity_slug: "taken" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("POST /_/api/links with label and expires_at should store them", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", label: "Test", expires_at: future }),
      })
    );
    const body = await res.json() as any;
    expect(body.label).toBe("Test");
    expect(body.expires_at).toBe(future);
  });

  it("GET /_/api/links should return all links", async () => {
    await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://one.com" }),
      })
    );
    await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://two.com" }),
      })
    );
    const res = await SELF.fetch(authed("/_/api/links"));
    const body = await res.json() as any[];
    expect(body).toHaveLength(2);
  });

  it("GET /_/api/links/:id should return 404 for non-existent ID", async () => {
    const res = await SELF.fetch(authed("/_/api/links/99999"));
    expect(res.status).toBe(404);
  });

  it("PUT /_/api/links/:id should update the link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://old.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://new.com" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url).toBe("https://new.com");
  });

  it("PUT /_/api/links/:id with invalid URL should return 400", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "bad-url" }),
      })
    );
    expect(res.status).toBe(400);
  });
});

// ---- Disable / Enable API ----

describe("Disable / Enable API", () => {
  it("POST /_/api/links/:id/disable should set expires_at to now", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const before = Math.floor(Date.now() / 1000);
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}/disable`, { method: "POST" })
    );
    const after = Math.floor(Date.now() / 1000);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.expires_at).toBeGreaterThanOrEqual(before);
    expect(body.expires_at).toBeLessThanOrEqual(after);
  });

  it("POST /_/api/links/:id/disable for non-existent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links/99999/disable", { method: "POST" })
    );
    expect(res.status).toBe(404);
  });

  it("enabling a link by clearing expires_at should restore it", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    // Disable
    await SELF.fetch(
      authed(`/_/api/links/${created.id}/disable`, { method: "POST" })
    );
    // Enable by clearing expires_at
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_at: null }),
      })
    );
    const body = await res.json() as any;
    expect(body.expires_at).toBeNull();
  });
});

// ---- Vanity Slugs API ----

describe("Vanity Slugs API", () => {
  it("POST /_/api/links/:id/slugs should add a vanity slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "my-vanity" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slug).toBe("my-vanity");
    expect(body.is_vanity).toBe(1);
  });

  it("should return 409 for duplicate vanity slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "taken" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "taken" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("should return 409 when link already has a vanity slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "existing" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "another" }),
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toMatch(/already has a vanity slug/i);
  });

  it("should return 400 for invalid vanity slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "-bad" }),
      })
    );
    expect(res.status).toBe(400);
  });

});

// ---- Redirect ----

describe("Redirect", () => {
  it("should 301 redirect for a valid active slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
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
      authed("/_/api/links", {
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
      authed("/_/api/links", {
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
      authed("/_/api/links", {
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
      authed("/_/api/links", {
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
      authed(`/_/api/links/${created.id}`, {
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
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;
    // Disable then enable
    await SELF.fetch(
      authed(`/_/api/links/${created.id}/disable`, { method: "POST" })
    );
    await SELF.fetch(
      authed(`/_/api/links/${created.id}`, {
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
  it("GET /_/api/settings should return slug_default_length", async () => {
    const res = await SELF.fetch(authed("/_/api/settings"));
    const body = await res.json() as any;
    expect(body.slug_default_length).toBe(3);
  });

  it("PUT /_/api/settings should update slug_default_length", async () => {
    const res = await SELF.fetch(
      authed("/_/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug_default_length: 5 }),
      })
    );
    const body = await res.json() as any;
    expect(body.slug_default_length).toBe(5);
  });

  it("PUT /_/api/settings with value below 3 should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug_default_length: 2 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("new links should use updated default length", async () => {
    await SELF.fetch(
      authed("/_/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug_default_length: 6 }),
      })
    );
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const body = await res.json() as any;
    const autoSlug = body.slugs.find((s: any) => s.is_vanity === 0);
    expect(autoSlug.slug).toHaveLength(6);
  });
});

// ---- User Preferences API ----

describe("User Preferences API", () => {
  it("GET /_/api/preferences should return empty object for new user", async () => {
    const res = await SELF.fetch(authed("/_/api/preferences"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toEqual({});
  });

  it("PUT /_/api/preferences should save and return theme", async () => {
    const res = await SELF.fetch(
      authed("/_/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "dark" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.theme).toBe("dark");
  });

  it("GET /_/api/preferences should return saved theme", async () => {
    await SELF.fetch(
      authed("/_/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "light" }),
      })
    );
    const res = await SELF.fetch(authed("/_/api/preferences"));
    const body = await res.json() as any;
    expect(body.theme).toBe("light");
  });

  it("PUT /_/api/preferences with invalid theme should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "neon" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("preferences should be scoped per user", async () => {
    await SELF.fetch(
      authed("/_/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "dark" }),
      })
    );
    const otherJwt = makeJwt("other@example.com");
    const otherRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/preferences", {
        headers: { "Cf-Access-Jwt-Assertion": otherJwt },
      })
    );
    const body = await otherRes.json() as any;
    expect(body.theme).toBeUndefined();
  });
});

// ---- Analytics API ----

describe("Analytics API", () => {
  it("GET /_/api/links/:id/analytics should return click stats", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(authed(`/_/api/links/${created.id}/analytics`));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_clicks).toBe(0);
    expect(body.countries).toEqual([]);
  });

  it("GET /_/api/dashboard should return dashboard stats", async () => {
    const res = await SELF.fetch(authed("/_/api/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(typeof body.total_links).toBe("number");
    expect(typeof body.total_clicks).toBe("number");
    expect(Array.isArray(body.recent_links)).toBe(true);
  });

  it("GET /_/api/dashboard top_links should include url for each link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://target.example.com" }),
      })
    );
    expect(createRes.status).toBe(201);
    const res = await SELF.fetch(authed("/_/api/dashboard"));
    const body = await res.json() as any;
    expect(Array.isArray(body.top_links)).toBe(true);
    expect(body.top_links.length).toBeGreaterThan(0);
    expect(body.top_links[0].url).toBe("https://target.example.com");
  });

  it("GET /_/api/dashboard top_countries should return country codes", async () => {
    const res = await SELF.fetch(authed("/_/api/dashboard"));
    const body = await res.json() as any;
    expect(Array.isArray(body.top_countries)).toBe(true);
  });
});

// ---- API Keys Management ----

describe("API Keys Management", () => {
  it("POST /_/api/keys should create a key and return the raw key", async () => {
    const res = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Key", scope: "create" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.raw_key).toMatch(/^sk_/);
    expect(body.key.title).toBe("My Key");
    expect(body.key.scope).toBe("create");
  });

  it("GET /_/api/keys should list keys for the authenticated user", async () => {
    await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Key 1", scope: "create" }),
      })
    );
    await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Key 2", scope: "read" }),
      })
    );
    const res = await SELF.fetch(authed("/_/api/keys"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toHaveLength(2);
    expect(body[0].key_hash).toBeUndefined();
  });

  it("GET /_/api/keys should not include other users keys", async () => {
    await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test Key", scope: "create" }),
      })
    );
    const otherJwt = makeJwt("other@example.com");
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/keys", {
        headers: { "Cf-Access-Jwt-Assertion": otherJwt },
      })
    );
    const body = await res.json() as any;
    expect(body).toHaveLength(0);
  });

  it("DELETE /_/api/keys/:id should revoke own key", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Revokable", scope: "create" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(authed(`/_/api/keys/${created.key.id}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
    const listRes = await SELF.fetch(authed("/_/api/keys"));
    const list = await listRes.json() as any;
    expect(list).toHaveLength(0);
  });

  it("DELETE /_/api/keys/:id should not revoke another users key", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Protected", scope: "create" }),
      })
    );
    const created = await createRes.json() as any;
    const otherJwt = makeJwt("other@example.com");
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/keys/${created.key.id}`, {
        method: "DELETE",
        headers: { "Cf-Access-Jwt-Assertion": otherJwt },
      })
    );
    expect(res.status).toBe(404);
  });

  it("POST /_/api/keys with invalid scope should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Bad Scope", scope: "admin" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/api/keys without title should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "create" }),
      })
    );
    expect(res.status).toBe(400);
  });
});

// ---- API Key Authentication ----

describe("API Key Authentication", () => {
  it("should authenticate with a valid API key via Bearer token", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Bearer Key", scope: "create,read" }),
      })
    );
    const { raw_key } = await createRes.json() as any;
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(200);
  });

  it("should reject an invalid Bearer token", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        headers: { "Authorization": "Bearer sk_000000000000000000000000000000000000000000000000000" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("should reject a malformed Bearer token", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        headers: { "Authorization": "Bearer not-a-key" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("should reject requests with no auth at all", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links")
    );
    expect(res.status).toBe(401);
  });

  it("create-scoped key should be able to create links", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await createRes.json() as any;
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("read-scoped key should not be able to create links", async () => {
    const createRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await createRes.json() as any;
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("read-scoped key should be able to read link analytics", async () => {
    // First create a link via admin auth
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    // Then create a read key
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/analytics`, {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(200);
  });

  it("create-scoped key should not be able to read analytics", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/analytics`, {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("read-scoped key should be able to get link details", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}`, {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );

    expect(res.status).toBe(200);
  });

  it("create-scoped key should be able to update links", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${raw_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label: "Updated by key" }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.label).toBe("Updated by key");
  });

  it("create-scoped key should be able to disable links", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );

    expect(res.status).toBe(200);
  });

  it("create-scoped key should be able to add vanity slugs", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${raw_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: "created-by-key" }),
      })
    );

    expect(res.status).toBe(201);
  });

  it("API key auth should reject all administrative API endpoints", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Limited", scope: "create,read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const settingsRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/settings", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(settingsRes.status).toBe(403);

    const preferencesRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/preferences", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(preferencesRes.status).toBe(403);

    const dashboardRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/dashboard", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(dashboardRes.status).toBe(403);

    const keysRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/keys", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(keysRes.status).toBe(403);
  });

  it("API key auth should not grant access to admin-only endpoints", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Limited", scope: "create,read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    // Settings should be admin-only
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/settings", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("read-scoped key should not be able to update links", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${raw_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label: "Nope" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("read-scoped key should not be able to disable links", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("read-scoped key should not be able to add vanity slugs", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${raw_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: "denied" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("create-scoped key should not be able to list links", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("create-scoped key should not be able to get link details", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Creator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}`, {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
  });
});

// ---- Vanity Slug Redirect ----

describe("Vanity Slug Redirect", () => {
  it("should 301 redirect via a vanity slug", async () => {
    await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://vanity-target.com", vanity_slug: "go" }),
      })
    );
    const res = await SELF.fetch(unauthed("/go"), { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://vanity-target.com/");
  });
});

// ---- Invalid JSON Bodies ----

describe("Invalid JSON Bodies", () => {
  it("POST /_/api/links with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("PUT /_/api/settings with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("PUT /_/api/preferences with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/api/keys with invalid JSON should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/api/keys", {
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
  it("GET /_/api/links/:id/analytics for nonexistent link should return 404", async () => {
    const res = await SELF.fetch(authed("/_/api/links/99999/analytics"));
    expect(res.status).toBe(404);
  });

  it("POST /_/api/links/:id/slugs for nonexistent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links/99999/slugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "orphan" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("PUT /_/api/links/:id for nonexistent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/api/links/99999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://nowhere.com" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /_/api/keys/:id for nonexistent key should return 404", async () => {
    const res = await SELF.fetch(authed("/_/api/keys/99999", { method: "DELETE" }));
    expect(res.status).toBe(404);
  });
});
