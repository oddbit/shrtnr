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
