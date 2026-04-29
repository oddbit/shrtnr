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
