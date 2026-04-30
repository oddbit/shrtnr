import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

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

// Seeds an api_keys row directly so cross-owner isolation tests can mint a
// Bearer key bound to an arbitrary identity without round-tripping through
// the admin keys endpoint (which always uses the JWT identity).
async function seedApiKey(
  db: D1Database,
  scope: string | null,
  identity = "test@shrtnr.test",
): Promise<string> {
  const raw = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = raw.slice(0, 7);
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare(
    "INSERT INTO api_keys (identity, title, key_prefix, key_hash, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(identity, "test", prefix, hash, scope, Math.floor(Date.now() / 1000)).run();
  return raw;
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

  it("GET /_/admin/api/bundles lists every bundle regardless of creator (open read by design)", async () => {
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
    expect(body.map((b) => b.name).sort()).toEqual(["Mine", "Theirs"]);
  });

  it("GET /_/admin/api/bundles/:id returns the bundle to any caller (open read by design)", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Public" }),
    }));
    const created = await createRes.json() as { id: number };

    const res = await SELF.fetch(authed("collab@x", `/_/admin/api/bundles/${created.id}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number; name: string; created_by: string };
    expect(body.id).toBe(created.id);
    expect(body.created_by).toBe("owner@x");
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

  it("POST /_/admin/api/bundles/:id/unarchive restores an archived bundle", async () => {
    const createRes = await SELF.fetch(authed("owner@x", "/_/admin/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };
    await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/archive`, { method: "POST" }));

    const res = await SELF.fetch(authed("owner@x", `/_/admin/api/bundles/${bundle.id}/unarchive`, { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { archived_at: number | null };
    expect(body.archived_at).toBeNull();
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

describe("Public API: bundles archive/unarchive", () => {
  async function apiKey(email: string, scope: string): Promise<string> {
    const res = await SELF.fetch(authed(email, "/_/admin/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${scope} key`, scope }),
    }));
    const body = await res.json() as { raw_key: string };
    return body.raw_key;
  }

  it("POST /_/api/bundles/:id/archive archives the bundle", async () => {
    const createKey = await apiKey("owner@x", "create,read");
    const createRes = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Authorization": `Bearer ${createKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };

    const archRes = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundle.id}/archive`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${createKey}` },
    }));
    expect(archRes.status).toBe(200);
    const archived = await archRes.json() as { archived_at: number | null };
    expect(archived.archived_at).not.toBeNull();
  });

  it("POST /_/api/bundles/:id/unarchive restores the bundle", async () => {
    const createKey = await apiKey("owner@x", "create,read");
    const createRes = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Authorization": `Bearer ${createKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };
    await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundle.id}/archive`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${createKey}` },
    }));

    const res = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundle.id}/unarchive`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${createKey}` },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { archived_at: number | null };
    expect(body.archived_at).toBeNull();
  });

  it("POST /_/api/bundles/:id/archive requires the create scope", async () => {
    const createKey = await apiKey("owner@x", "create,read");
    const createRes = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Authorization": `Bearer ${createKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "OSS" }),
    }));
    const bundle = await createRes.json() as { id: number };

    const readKey = await apiKey("owner@x", "read");
    const res = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundle.id}/archive`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${readKey}` },
    }));
    expect(res.status).toBe(403);
  });
});

// ---- Cross-owner bundle write isolation at the live handler ----
//
// Bundle reads are intentionally open across owners (see the "Bundle access
// model (design)" describe below). Writes that mutate or destroy bundle state
// are still owner-only: the ownership guard in src/services/bundle-management.ts
// returns 403 for non-owners, mirroring link-side ownership semantics. Genuine
// "id does not exist" still returns 404.

describe("cross-owner bundle write isolation", () => {
  it("owner A's API key cannot DELETE owner B's bundle (403)", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const create = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "Owner B Only Delete" }),
    }));
    const { id } = await create.json() as { id: number };

    const del = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(del.status).toBe(403);
  });
});

// ---- Bundle access model (design): mirrors link+slug ----
//
// The app is for internal team/organization use, not public sign-up. Bundles
// follow the same access model as links and their slugs:
//
//   - anyone can read any bundle (GET /:id, list)
//   - anyone can add links to any bundle (POST /:id/links), mirroring how
//     anyone can add a custom slug to anyone's link
//   - only the bundle owner can remove links from a bundle (DELETE
//     /:id/links/:linkId), mirroring slug removal on links
//   - only the bundle owner can delete the bundle (DELETE /:id) or update
//     its metadata (PUT /:id)
//
// This describe locks that contract so a future tightening cannot quietly
// break it. Clarified by user on 2026-04-30.

describe("Bundle access model (design): mirrors link+slug", () => {
  it("anyone can GET another owner's bundle", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const create = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "Owner B Public Read" }),
    }));
    expect(create.status).toBe(201);
    const { id } = await create.json() as { id: number };

    const get = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${id}`, {
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(get.status).toBe(200);
    const body = await get.json() as { id: number; name: string; created_by: string };
    expect(body.id).toBe(id);
    expect(body.name).toBe("Owner B Public Read");
    expect(body.created_by).toBe("ownerB@test");
  });

  it("anyone can list bundles and see other owners' bundles in the response", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const createA = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyA}` },
      body: JSON.stringify({ name: "By A" }),
    }));
    const { id: idA } = await createA.json() as { id: number };

    const createB = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "By B" }),
    }));
    const { id: idB } = await createB.json() as { id: number };

    const list = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(list.status).toBe(200);
    const body = await list.json() as { id: number }[];
    const ids = body.map((b) => b.id);
    expect(ids).toContain(idA);
    expect(ids).toContain(idB);
  });

  it("anyone can add a link to another owner's bundle", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const create = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "Owner B Bundle" }),
    }));
    const { id: bundleId } = await create.json() as { id: number };

    const linkId = await createLinkFor("ownerA@test", "https://example.com/by-a", "axx");

    const add = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundleId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyA}` },
      body: JSON.stringify({ link_id: linkId }),
    }));
    expect(add.status).toBe(200);
    const body = await add.json() as { added: boolean };
    expect(body.added).toBe(true);
  });

  it("only the bundle owner can remove a link from the bundle (non-owner: 403)", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const create = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "Owner B Bundle" }),
    }));
    const { id: bundleId } = await create.json() as { id: number };

    const linkId = await createLinkFor("ownerB@test", "https://example.com/by-b", "bxx");
    const add = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundleId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ link_id: linkId }),
    }));
    expect(add.status).toBe(200);

    const remove = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${bundleId}/links/${linkId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(remove.status).toBe(403);
  });

  it("only the bundle owner can delete the bundle (non-owner: 403)", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const create = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "Owner B Bundle" }),
    }));
    const { id } = await create.json() as { id: number };

    const del = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(del.status).toBe(403);
  });

  it("only the bundle owner can update bundle metadata (non-owner: 403)", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");
    const keyB = await seedApiKey(env.DB, "create,read", "ownerB@test");

    const create = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyB}` },
      body: JSON.stringify({ name: "Owner B Bundle", accent: "blue" }),
    }));
    const { id } = await create.json() as { id: number };

    const update = await SELF.fetch(new Request(`https://shrtnr.test/_/api/bundles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyA}` },
      body: JSON.stringify({ name: "Hijacked", accent: "red" }),
    }));
    expect(update.status).toBe(403);
  });

  it("genuinely-missing bundle ids still return 404 (distinct from 403)", async () => {
    const keyA = await seedApiKey(env.DB, "create,read", "ownerA@test");

    const del = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles/99999", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(del.status).toBe(404);

    const update = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keyA}` },
      body: JSON.stringify({ name: "Phantom" }),
    }));
    expect(update.status).toBe(404);

    const archive = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles/99999/archive", {
      method: "POST",
      headers: { Authorization: `Bearer ${keyA}` },
    }));
    expect(archive.status).toBe(404);
  });
});
