import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

function authed(email: string, path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, {
    ...init,
    headers: { "Cf-Access-Jwt-Assertion": makeJwt(email), ...(init?.headers ?? {}) },
  });
}

async function createLinkFor(email: string, url: string, slug: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const res = await env.DB
    .prepare("INSERT INTO links (url, label, created_at, created_via, created_by) VALUES (?, NULL, ?, 'app', ?)")
    .bind(url, now, email)
    .run();
  const linkId = res.meta.last_row_id as number;
  await env.DB
    .prepare("INSERT INTO slugs (link_id, slug, is_custom, is_primary, created_at) VALUES (?, ?, 0, 1, ?)")
    .bind(linkId, slug, now)
    .run();
  return linkId;
}

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

describe("Admin API: bundles", () => {
  it("POST /_/admin/api/bundles creates a bundle", async () => {
    const res = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS", icon: "inventory_2", accent: "orange" }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; created_by: string };
    expect(body.name).toBe("OSS");
    expect(body.created_by).toBe("owner@x");
  });

  it("POST /_/admin/api/bundles rejects blank name", async () => {
    const res = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }));
    expect(res.status).toBe(400);
  });

  it("GET /_/admin/api/bundles lists the caller's bundles", async () => {
    await SELF.fetch(authed("a@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mine" }),
    }));
    await SELF.fetch(authed("b@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Theirs" }),
    }));

    const res = await SELF.fetch(authed("a@x", "/_/admin/api/bundles"));
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Mine");
  });

  it("GET /_/admin/api/bundles/:id 404s for non-owner", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Private" }),
    }));
    const created = await createRes.json() as { id: number };

    const res = await SELF.fetch(authed("intruder@x", `/_/admin/api/bundles/${created.id}`));
    expect(res.status).toBe(404);
  });

  it("POST /_/admin/api/bundles/:id/links adds a link", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };
    const linkId = await createLinkFor("owner@x", "https://github.com/owner/repo", "aaa");

    const res = await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { added: boolean };
    expect(body.added).toBe(true);
  });

  it("GET /_/admin/api/bundles/:id/analytics returns aggregated stats", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };
    const linkId = await createLinkFor("owner@x", "https://a.com", "aaa");
    await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId }),
    }));
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, country, link_mode) VALUES ('aaa', ?, 'US', 'link')").bind(now - 10).run();

    const res = await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/analytics?range=30d`));
    expect(res.status).toBe(200);
    const body = await res.json() as { total_clicks: number; link_count: number };
    expect(body.total_clicks).toBe(1);
    expect(body.link_count).toBe(1);
  });

  it("POST /_/admin/api/bundles/:id/archive archives the bundle", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };

    const archRes = await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/archive`, { method: "POST" }));
    expect(archRes.status).toBe(200);
    const archived = await archRes.json() as { archived_at: number | null };
    expect(archived.archived_at).not.toBeNull();

    // Default list excludes archived.
    const listRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles"));
    const listBody = await listRes.json() as unknown[];
    expect(listBody).toHaveLength(0);
  });

  it("DELETE /_/admin/api/bundles/:id deletes the bundle", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };

    const delRes = await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}`, { method: "DELETE" }));
    expect(delRes.status).toBe(200);

    const getRes = await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}`));
    expect(getRes.status).toBe(404);
  });

  it("GET /_/admin/api/links/:id/bundles returns bundles the link belongs to", async () => {
    const linkId = await createLinkFor("owner@x", "https://a.com", "aaa");
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };
    await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId }),
    }));

    const res = await SELF.fetch(authed("owner@x", `/_/admin/api/links/${linkId}/bundles`));
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; name: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(bundle.id);
  });
});
