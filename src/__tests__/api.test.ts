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

// ---- Links API ----

describe("Links API", () => {
  it("POST /_/admin/api/links should create a link with auto-generated slug", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
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

  it("POST /_/admin/api/links should return 400 for invalid URL", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/admin/api/links should return 400 for javascript: URL", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "javascript:alert(1)" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/https?/);
  });

  it("POST /_/admin/api/links should return 400 for data: URL", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "data:text/html,<script>alert(1)</script>" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/admin/api/links should return 400 for missing URL", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/admin/api/links then POST slugs should attach both slugs", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    const slugRes = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "my-slug" }),
      })
    );
    expect(slugRes.status).toBe(201);
    const linkRes = await SELF.fetch(authed(`/_/admin/api/links/${created.id}`));
    const body = await linkRes.json() as any;
    expect(body.slugs).toHaveLength(2);
    expect(body.slugs.some((s: any) => s.slug === "my-slug" && s.is_custom === 1)).toBe(true);
  });

  it("POST /_/admin/api/links then POST slugs should be ordered: auto at index 0, custom at index 1", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "custom" }),
      })
    );
    const linkRes = await SELF.fetch(authed(`/_/admin/api/links/${created.id}`));
    const body = await linkRes.json() as any;
    expect(body.slugs[0].is_custom).toBe(0);
    expect(body.slugs[1].is_custom).toBe(1);
    expect(body.slugs[1].slug).toBe("custom");
  });

  it("GET /_/admin/api/links should preserve slug ordering per link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "ordered" }),
      })
    );
    const res = await SELF.fetch(authed("/_/admin/api/links"));
    const body = await res.json() as any;
    const link = body.find((l: any) => l.slugs.length === 2);
    expect(link.slugs[0].is_custom).toBe(0);
    expect(link.slugs[1].is_custom).toBe(1);
  });

  it("GET /_/admin/api/links/:id should preserve slug ordering", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "detail-order" }),
      })
    );
    const res = await SELF.fetch(authed(`/_/admin/api/links/${created.id}`));
    const body = await res.json() as any;
    expect(body.slugs[0].is_custom).toBe(0);
    expect(body.slugs[1].is_custom).toBe(1);
    expect(body.slugs[1].slug).toBe("detail-order");
  });

  it("POST /_/admin/api/links creates link without custom_slug field", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slugs).toHaveLength(1);
    expect(body.slugs[0].is_custom).toBe(0);
  });

  it("POST /_/admin/api/links with label and expires_at should store them", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", label: "Test", expires_at: future }),
      })
    );
    const body = await res.json() as any;
    expect(body.label).toBe("Test");
    expect(body.expires_at).toBe(future);
  });

  it("POST /_/admin/api/links with existing URL should return 200 with duplicate flag", async () => {
    await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.duplicate).toBe(true);
    expect(body.url).toBe("https://example.com");
  });

  it("POST /_/admin/api/links with allow_duplicate should create new link", async () => {
    const first = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const firstBody = await first.json() as any;
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", allow_duplicate: true }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).not.toBe(firstBody.id);
    expect(body.url).toBe("https://example.com");
  });

  it("POST /_/admin/api/links first-time creation should return 201", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://brand-new.com" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.duplicate).toBeUndefined();
  });

  it("GET /_/admin/api/links should return all links", async () => {
    await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://one.com" }),
      })
    );
    await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://two.com" }),
      })
    );
    const res = await SELF.fetch(authed("/_/admin/api/links"));
    const body = await res.json() as any[];
    expect(body).toHaveLength(2);
  });

  it("GET /_/admin/api/links/:id should return 404 for non-existent ID", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/links/99999"));
    expect(res.status).toBe(404);
  });

  it("PUT /_/admin/api/links/:id should update the link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://old.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://new.com" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.url).toBe("https://new.com");
  });

  it("PUT /_/admin/api/links/:id with invalid URL should return 400", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, {
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
  it("POST /_/admin/api/links/:id/disable should set expires_at to now", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const before = Math.floor(Date.now() / 1000);
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/disable`, { method: "POST" })
    );
    const after = Math.floor(Date.now() / 1000);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.expires_at).toBeGreaterThanOrEqual(before);
    expect(body.expires_at).toBeLessThanOrEqual(after);
  });

  it("POST /_/admin/api/links/:id/disable for non-existent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links/99999/disable", { method: "POST" })
    );
    expect(res.status).toBe(404);
  });

  it("enabling a link by clearing expires_at should restore it", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    // Disable
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/disable`, { method: "POST" })
    );
    // Enable by clearing expires_at
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_at: null }),
      })
    );
    const body = await res.json() as any;
    expect(body.expires_at).toBeNull();
  });
});

// ---- Custom Slugs API ----

describe("Custom Slugs API", () => {
  it("POST /_/admin/api/links/:id/slugs should add a custom slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "my-custom" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slug).toBe("my-custom");
    expect(body.is_custom).toBe(1);
  });

  it("should return 409 for duplicate custom slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "taken" }),
      })
    );
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "taken" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("should allow adding a second custom slug to a link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "existing" }),
      })
    );
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "another" }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slug).toBe("another");
    expect(body.is_custom).toBe(1);
  });

  it("should return 400 for invalid custom slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "-bad" }),
      })
    );
    expect(res.status).toBe(400);
  });

});

describe("Public slug-mutation API (/_/api/*)", () => {
  async function setupLinkWithCustomSlug(): Promise<{ linkId: number; slug: string; rawKey: string }> {
    const linkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "custom" }),
      })
    );
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Mutator", scope: "create,read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    return { linkId: link.id, slug: "custom", rawKey: raw_key };
  }

  it("owner's key can disable their own custom slug", async () => {
    const { linkId, slug, rawKey } = await setupLinkWithCustomSlug();
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}/slugs/${slug}/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.slug).toBe(slug);
    expect(body.disabled_at).not.toBeNull();
  });

  it("owner's key can re-enable their previously-disabled slug", async () => {
    const { linkId, slug, rawKey } = await setupLinkWithCustomSlug();
    await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}/slugs/${slug}/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}/slugs/${slug}/enable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.disabled_at).toBeNull();
  });

  it("owner's key can remove a custom slug with zero clicks", async () => {
    const { linkId, slug, rawKey } = await setupLinkWithCustomSlug();
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}/slugs/${slug}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.removed).toBe(true);
  });

  it("cannot disable the auto slug (400)", async () => {
    const { linkId, rawKey } = await setupLinkWithCustomSlug();
    const linkInfo = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}`, {
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    const info = await linkInfo.json() as any;
    const autoSlug = info.slugs.find((s: any) => !s.is_custom).slug;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}/slugs/${autoSlug}/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown slug on an owned link", async () => {
    const { linkId, rawKey } = await setupLinkWithCustomSlug();
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${linkId}/slugs/nope/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${rawKey}` },
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown link id", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Mutator", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/99999/slugs/x/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(404);
  });

  it("forbids a different identity's key from mutating another user's slug", async () => {
    // Link + custom slug owned by test@example.com (the default AUTH_HEADER identity).
    const linkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "owned" }),
      })
    );

    // Create an API key as a different identity (other@example.com).
    const otherAuth = { "Cf-Access-Jwt-Assertion": makeJwt("other@example.com") };
    const keyRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/admin/api/keys", {
        method: "POST",
        headers: { ...otherAuth, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Intruder", scope: "create" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/slugs/owned/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
  });

  it("read-only key is rejected with 403 from the scope gate", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "readable" }),
      })
    );
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${link.id}/slugs/readable/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(403);
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

  it("GET /_/admin/api/settings should return null default_range when unset", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/settings"));
    const body = await res.json() as any;
    expect(body.default_range).toBeNull();
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

// ---- API Keys Management ----

describe("API Keys Management", () => {
  it("POST /_/admin/api/keys should create a key and return the raw key", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/keys", {
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

  it("GET /_/admin/api/keys should list keys for the authenticated user", async () => {
    await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Key 1", scope: "create" }),
      })
    );
    await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Key 2", scope: "read" }),
      })
    );
    const res = await SELF.fetch(authed("/_/admin/api/keys"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toHaveLength(2);
    expect(body[0].key_hash).toBeUndefined();
  });

  it("GET /_/admin/api/keys should only return keys for the requesting identity", async () => {
    await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test Key", scope: "create" }),
      })
    );
    // unauthed = anonymous identity — should see 0 keys
    const res = await SELF.fetch(unauthed("/_/admin/api/keys"));
    const body = await res.json() as any;
    expect(body).toHaveLength(0);
  });

  it("DELETE /_/admin/api/keys/:id should revoke own key", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Revokable", scope: "create" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(authed(`/_/admin/api/keys/${created.key.id}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
    const listRes = await SELF.fetch(authed("/_/admin/api/keys"));
    const list = await listRes.json() as any;
    expect(list).toHaveLength(0);
  });

  it("DELETE /_/admin/api/keys/:id should return 404 when trying to revoke a key owned by another user", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Shared Key", scope: "create" }),
      })
    );
    const created = await createRes.json() as any;
    const res = await SELF.fetch(
      unauthed(`/_/admin/api/keys/${created.key.id}`, { method: "DELETE" })
    );
    expect(res.status).toBe(404);
  });

  it("POST /_/admin/api/keys with invalid scope should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Bad Scope", scope: "admin" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST /_/admin/api/keys without title should return 400", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    // Then create a read key
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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

  it("create-scoped key should be able to add custom slugs", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;

    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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

  it("read-scoped key should not be able to update links", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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

  it("read-scoped key should not be able to add custom slugs", async () => {
    const linkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/keys", {
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
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await linkRes.json() as any;
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
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

  it("GET /_/api/slugs/:slug should return link details", async () => {
    // 1. Create a link
    const createLinkRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const link = await createLinkRes.json() as any;

    // 1b. Add a custom slug
    await SELF.fetch(
      authed(`/_/admin/api/links/${link.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "find-me" }),
      })
    );

    // 2. Create a key
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    // 3. Get link by slug
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/slugs/find-me", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(link.id);
    expect(body.url).toBe("https://example.com");
  });

  it("GET /_/api/slugs/:slug should return 404 for non-existent slug", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Reader", scope: "read" }),
      })
    );
    const { raw_key } = await keyRes.json() as any;

    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/slugs/no-such-slug", {
        headers: { "Authorization": `Bearer ${raw_key}` },
      })
    );
    expect(res.status).toBe(404);
  });
});

// ---- Custom Slug Redirect ----

describe("Custom Slug Redirect", () => {
  it("should 301 redirect via a custom slug", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://custom-target.com" }),
      })
    );
    const created = await createRes.json() as any;
    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "go" }),
      })
    );
    const res = await SELF.fetch(unauthed("/go"), { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://custom-target.com/");
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

// ---- Feature: Smart search/shorten input on links page ----

describe("Smart search input", () => {
  // TODO: Implement smart search/shorten input. The input field on the
  // links page should detect whether the user typed a URL or plain text.
  // URLs trigger shorten (existing behavior). Plain text triggers search.
  // The button label should switch from "Shorten" to "Go" dynamically.

  it("GET /_/admin/links?search=test should search by text terms", async () => {
    // Create links with matching labels/slugs
    await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      })
    );
    const created = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://testsite.com", label: "test campaign" }),
      })
    );
    const link = await created.json() as any;

    // Search with text term
    const res = await SELF.fetch(authed("/_/admin/links?search=test"));
    expect(res.status).toBe(200);
    const body = await res.text();
    // Should find the link with "test" in label
    expect(body).toContain("testsite.com");
  });

  it("links page should render search-aware button text", async () => {
    const res = await SELF.fetch(authed("/_/admin/links"));
    expect(res.status).toBe(200);
    const body = await res.text();
    // The page should include the client-side logic for switching button text
    expect(body).toContain("quickShorten");
  });

  it("links page input should have smart action button ids", async () => {
    const res = await SELF.fetch(authed("/_/admin/links"));
    const body = await res.text();
    expect(body).toContain('id="quick-action-btn"');
    expect(body).toContain('id="quick-action-icon"');
    expect(body).toContain('id="quick-action-label"');
    expect(body).toContain('type="text"');
  });

  it("dashboard should render the same smart input as links page", async () => {
    const res = await SELF.fetch(authed("/_/admin/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('id="quick-action-btn"');
    expect(body).toContain('id="quick-action-icon"');
    expect(body).toContain('id="quick-action-label"');
    expect(body).toContain('type="text"');
    expect(body).toContain("quickShorten");
  });
});

// ---- Feature: Delete zero-click links ----

describe("Delete Link API", () => {
  // TODO: Implement delete endpoint for links with zero clicks.
  // Links with zero total_clicks should be deletable via
  // DELETE /_/admin/api/links/:id. Links with clicks should
  // return 400 and suggest disabling instead.

  it("DELETE /_/admin/api/links/:id should delete a zero-click link", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://deletable.com" }),
      })
    );
    const created = await createRes.json() as any;
    expect(created.total_clicks).toBe(0);

    const deleteRes = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, { method: "DELETE" })
    );
    expect(deleteRes.status).toBe(200);

    // Confirm the link is gone
    const getRes = await SELF.fetch(authed(`/_/admin/api/links/${created.id}`));
    expect(getRes.status).toBe(404);
  });

  it("DELETE /_/admin/api/links/:id should reject deletion of a link with clicks", async () => {
    // Create a link and record a click via redirect
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://popular.com" }),
      })
    );
    const created = await createRes.json() as any;
    const slug = created.slugs[0].slug;

    // Generate a click by following the redirect
    await SELF.fetch(unauthed(`/${slug}`), { redirect: "manual" });

    const deleteRes = await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}`, { method: "DELETE" })
    );
    expect(deleteRes.status).toBe(400);
    const body = await deleteRes.json() as any;
    expect(body.error).toBeTruthy();
  });

  it("DELETE /_/admin/api/links/:id for non-existent link should return 404", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links/99999", { method: "DELETE" })
    );
    expect(res.status).toBe(404);
  });
});
