// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// The same authorization matrix, exercised through each of the three auth
// surfaces rather than through the service functions directly: the admin UI
// (Cloudflare Access JWT), the public API (Bearer key), and MCP (OAuth
// identity forwarded from Access as JSON-RPC tool calls).
//
// The point is placement, not repetition. If the owner gate and the
// zero-click delete rule hold at all three entry points, enforcement sits in
// the service layer where every caller passes through it. Where a surface
// differs (MCP flattens the HTTP status into an error string), that is
// recorded too.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

const OWNER = "owner@surfaces.test";
const OTHER = "other@surfaces.test";

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

/** Admin surface: identity rides a Cloudflare Access JWT. */
function asAdmin(email: string, path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, {
    ...init,
    headers: { "Cf-Access-Jwt-Assertion": makeJwt(email), ...(init?.headers ?? {}) },
  });
}

/**
 * Mint a Bearer key bound to an identity. Seeded directly so a test can hold
 * two keys for two owners without driving the admin UI twice.
 */
async function seedApiKey(identity: string, scope = "create,read"): Promise<string> {
  const raw = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.DB
    .prepare("INSERT INTO api_keys (identity, title, key_prefix, key_hash, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(identity, "surfaces test", raw.slice(0, 7), hash, scope, Math.floor(Date.now() / 1000))
    .run();
  return raw;
}

/** Public API surface: identity rides the Bearer key's stored owner. */
function asApi(key: string, path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init?.headers ?? {}) },
  });
}

async function seedClick(slug: string) {
  await env.DB
    .prepare("INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)")
    .bind(slug, Math.floor(Date.now() / 1000))
    .run();
}

type Link = { id: number; created_by: string; slugs: { slug: string; is_custom: number }[] };

async function createLinkAsAdmin(email: string, url: string): Promise<Link> {
  const res = await SELF.fetch(
    asAdmin(email, "/_/admin/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Link;
}

function primarySlug(link: Link): string {
  return link.slugs.find((s) => s.is_custom === 0)!.slug;
}

// ---- MCP plumbing ----

type JsonRpcResponse = { result?: unknown; error?: { code: number; message: string } };

async function readFirstSseMessage(res: Response): Promise<JsonRpcResponse | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    while (buffer.includes("\n\n")) {
      const idx = buffer.indexOf("\n\n");
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          await reader.cancel();
        } catch {
          // already closed
        }
        return JSON.parse(payload) as JsonRpcResponse;
      }
    }
    if (done) return null;
  }
}

/**
 * Open an MCP session under one identity. The JWT rides every request in the
 * session, including initialize, which is how a real client behaves.
 */
async function mcpSession(email: string): Promise<string> {
  const res = await SELF.fetch(
    new Request("https://shrtnr.test/_/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Cf-Access-Jwt-Assertion": makeJwt(email),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
      }),
    }),
  );
  expect(res.status).toBe(200);
  const sessionId = res.headers.get("mcp-session-id");
  expect(sessionId).toBeTruthy();
  await readFirstSseMessage(res);
  return sessionId!;
}

let mcpCallId = 100;

type ToolOutcome = { isError: boolean; text: string };

async function callTool(email: string, sessionId: string, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const res = await SELF.fetch(
    new Request("https://shrtnr.test/_/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
        "Cf-Access-Jwt-Assertion": makeJwt(email),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: mcpCallId++, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  expect(res.status).toBe(200);
  const message = await readFirstSseMessage(res);
  const result = message?.result as { isError?: boolean; content?: { text?: string }[] } | undefined;
  return { isError: result?.isError === true, text: result?.content?.[0]?.text ?? "" };
}

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

// ===================================================================
// Identity: where each surface gets the owner it writes.
// ===================================================================

describe("identity establishment on each surface", () => {
  it("the admin surface stamps created_by from the Access JWT email", async () => {
    const link = await createLinkAsAdmin(OWNER, "https://example.com/admin-identity");
    expect(link.created_by).toBe(OWNER);
  });

  it("an API key carries its issuer's identity, and that becomes created_by", async () => {
    const key = await seedApiKey(OWNER);
    const res = await SELF.fetch(
      asApi(key, "/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/api-identity" }),
      }),
    );
    expect(res.status).toBe(201);
    const link = (await res.json()) as Link;
    expect(link.created_by).toBe(OWNER);
  });

  it("two keys for two owners are two identities, not one shared API identity", async () => {
    const keyA = await seedApiKey(OWNER);
    const keyB = await seedApiKey(OTHER);

    const a = await SELF.fetch(asApi(keyA, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/key-a" }),
    }));
    const b = await SELF.fetch(asApi(keyB, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/key-b" }),
    }));

    expect(((await a.json()) as Link).created_by).toBe(OWNER);
    expect(((await b.json()) as Link).created_by).toBe(OTHER);
  });

  it("the MCP surface stamps created_by from the forwarded Access identity", async () => {
    const session = await mcpSession(OWNER);
    const outcome = await callTool(OWNER, session, "create_link", { url: "https://example.com/mcp-identity" });
    expect(outcome.isError).toBe(false);
    const link = JSON.parse(outcome.text) as Link;
    expect(link.created_by).toBe(OWNER);
  });

  it("the public API rejects a request with no bearer token", async () => {
    const res = await SELF.fetch(new Request("https://shrtnr.test/_/api/links"));
    expect(res.status).toBe(401);
  });

  it("an API key scope gate is separate from ownership: a read-only key cannot write its own links", async () => {
    const readOnly = await seedApiKey(OWNER, "read");
    const res = await SELF.fetch(
      asApi(readOnly, "/_/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/scope-gate" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

// ===================================================================
// The delete rule and the owner gate, surface by surface.
// ===================================================================

describe("admin surface: owner gate and zero-click delete rule", () => {
  it("the owner deletes a zero-click link", async () => {
    const link = await createLinkAsAdmin(OWNER, "https://example.com/admin-del-ok");
    const res = await SELF.fetch(asAdmin(OWNER, `/_/admin/api/links/${link.id}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
  });

  it("the owner deleting a clicked link gets 400 with the disable hint", async () => {
    const link = await createLinkAsAdmin(OWNER, "https://example.com/admin-del-clicked");
    await seedClick(primarySlug(link));

    const res = await SELF.fetch(asAdmin(OWNER, `/_/admin/api/links/${link.id}`, { method: "DELETE" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cannot delete a link with clicks, disable it instead" });
  });

  it("the owner disables the clicked link instead", async () => {
    const link = await createLinkAsAdmin(OWNER, "https://example.com/admin-disable-clicked");
    await seedClick(primarySlug(link));

    const res = await SELF.fetch(asAdmin(OWNER, `/_/admin/api/links/${link.id}/disable`, { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("a non-owner gets 403 on delete, update and disable", async () => {
    const link = await createLinkAsAdmin(OWNER, "https://example.com/admin-cross");

    const del = await SELF.fetch(asAdmin(OTHER, `/_/admin/api/links/${link.id}`, { method: "DELETE" }));
    const put = await SELF.fetch(asAdmin(OTHER, `/_/admin/api/links/${link.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://evil.example" }),
    }));
    const disable = await SELF.fetch(asAdmin(OTHER, `/_/admin/api/links/${link.id}/disable`, { method: "POST" }));

    expect([del.status, put.status, disable.status]).toEqual([403, 403, 403]);
  });

  it("a non-owner reads another user's link and analytics", async () => {
    const link = await createLinkAsAdmin(OWNER, "https://example.com/admin-read");
    await seedClick(primarySlug(link));

    const get = await SELF.fetch(asAdmin(OTHER, `/_/admin/api/links/${link.id}`));
    expect(get.status).toBe(200);

    const analytics = await SELF.fetch(asAdmin(OTHER, `/_/admin/api/links/${link.id}/analytics`));
    expect(analytics.status).toBe(200);
  });
});

describe("public API surface: owner gate and zero-click delete rule", () => {
  it("the owner deletes a zero-click link", async () => {
    const key = await seedApiKey(OWNER);
    const created = await SELF.fetch(asApi(key, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-del-ok" }),
    }));
    const link = (await created.json()) as Link;

    const res = await SELF.fetch(asApi(key, `/_/api/links/${link.id}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
  });

  it("the owner deleting a clicked link gets 400 with the disable hint", async () => {
    const key = await seedApiKey(OWNER);
    const created = await SELF.fetch(asApi(key, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-del-clicked" }),
    }));
    const link = (await created.json()) as Link;
    await seedClick(primarySlug(link));

    const res = await SELF.fetch(asApi(key, `/_/api/links/${link.id}`, { method: "DELETE" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cannot delete a link with clicks, disable it instead" });
  });

  it("the owner disables the clicked link instead", async () => {
    const key = await seedApiKey(OWNER);
    const created = await SELF.fetch(asApi(key, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-disable-clicked" }),
    }));
    const link = (await created.json()) as Link;
    await seedClick(primarySlug(link));

    const res = await SELF.fetch(asApi(key, `/_/api/links/${link.id}/disable`, { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("a non-owner key gets 403 on update, disable, enable and delete", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const created = await SELF.fetch(asApi(keyOwner, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-cross" }),
    }));
    const link = (await created.json()) as Link;

    const statuses = [
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://evil.example" }),
      }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/disable`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/enable`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}`, { method: "DELETE" }))).status,
    ];
    expect(statuses).toEqual([403, 403, 403, 403]);
  });

  it("a non-owner key reads another owner's link, analytics and timeline", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const created = await SELF.fetch(asApi(keyOwner, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-read-across" }),
    }));
    const link = (await created.json()) as Link;
    await seedClick(primarySlug(link));

    const statuses = [
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}`))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/analytics`))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/timeline`))).status,
    ];
    expect(statuses).toEqual([200, 200, 200]);
  });

  it("a non-owner key gets 403 on slug disable, enable and remove", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const created = await SELF.fetch(asApi(keyOwner, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-slug-cross" }),
    }));
    const link = (await created.json()) as Link;
    await SELF.fetch(asApi(keyOwner, `/_/api/links/${link.id}/slugs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "api-guarded" }),
    }));

    const statuses = [
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/slugs/api-guarded/disable`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/slugs/api-guarded/enable`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/slugs/api-guarded`, { method: "DELETE" }))).status,
    ];
    expect(statuses).toEqual([403, 403, 403]);
  });

  it("removing a clicked slug gets 400 with the disable hint", async () => {
    const key = await seedApiKey(OWNER);
    const created = await SELF.fetch(asApi(key, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-slug-clicked" }),
    }));
    const link = (await created.json()) as Link;
    await SELF.fetch(asApi(key, `/_/api/links/${link.id}/slugs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "api-clicked" }),
    }));
    await seedClick("api-clicked");

    const res = await SELF.fetch(asApi(key, `/_/api/links/${link.id}/slugs/api-clicked`, { method: "DELETE" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cannot remove a slug with clicks, disable it instead" });
  });

  it("GAP: a non-owner key adds a custom slug to another owner's link and gets 201", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const created = await SELF.fetch(asApi(keyOwner, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-slug-gap" }),
    }));
    const link = (await created.json()) as Link;

    const res = await SELF.fetch(asApi(keyOther, `/_/api/links/${link.id}/slugs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "stranger-minted" }),
    }));
    expect(res.status).toBe(201);
  });
});

describe("public API surface: bundles", () => {
  async function createBundleVia(key: string, name: string): Promise<{ id: number }> {
    const res = await SELF.fetch(asApi(key, "/_/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }));
    expect(res.status).toBe(201);
    return (await res.json()) as { id: number };
  }

  it("the owner updates, archives, unarchives and deletes their bundle", async () => {
    const key = await seedApiKey(OWNER);
    const bundle = await createBundleVia(key, "API bundle");

    const statuses = [
      (await SELF.fetch(asApi(key, `/_/api/bundles/${bundle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      }))).status,
      (await SELF.fetch(asApi(key, `/_/api/bundles/${bundle.id}/archive`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(key, `/_/api/bundles/${bundle.id}/unarchive`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(key, `/_/api/bundles/${bundle.id}`, { method: "DELETE" }))).status,
    ];
    expect(statuses).toEqual([200, 200, 200, 200]);
  });

  it("a non-owner key gets 403 on update, archive, unarchive and delete", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const bundle = await createBundleVia(keyOwner, "Guarded bundle");

    const statuses = [
      (await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hijacked" }),
      }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}/archive`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}/unarchive`, { method: "POST" }))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}`, { method: "DELETE" }))).status,
    ];
    expect(statuses).toEqual([403, 403, 403, 403]);
  });

  it("a non-owner key reads another owner's bundle and its links", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const bundle = await createBundleVia(keyOwner, "Readable bundle");

    const statuses = [
      (await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}`))).status,
      (await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}/links`))).status,
      (await SELF.fetch(asApi(keyOther, "/_/api/bundles"))).status,
    ];
    expect(statuses).toEqual([200, 200, 200]);
  });

  it("a bundle holding a clicked link deletes without a click refusal", async () => {
    const key = await seedApiKey(OWNER);
    const bundle = await createBundleVia(key, "Clicked bundle");
    const created = await SELF.fetch(asApi(key, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-bundle-clicked" }),
    }));
    const link = (await created.json()) as Link;
    await SELF.fetch(asApi(key, `/_/api/bundles/${bundle.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: link.id }),
    }));
    await seedClick(primarySlug(link));

    const res = await SELF.fetch(asApi(key, `/_/api/bundles/${bundle.id}`, { method: "DELETE" }));
    expect(res.status).toBe(200);
  });

  it("GAP: a non-owner key adds a link to another owner's bundle and gets 200", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const bundle = await createBundleVia(keyOwner, "Open-add bundle");
    const created = await SELF.fetch(asApi(keyOther, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-bundle-gap" }),
    }));
    const link = (await created.json()) as Link;

    const res = await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: link.id }),
    }));
    expect(res.status).toBe(200);
  });

  it("a non-owner key gets 403 removing a link from another owner's bundle", async () => {
    const keyOwner = await seedApiKey(OWNER);
    const keyOther = await seedApiKey(OTHER);
    const bundle = await createBundleVia(keyOwner, "Guarded removal");
    const created = await SELF.fetch(asApi(keyOther, "/_/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api-bundle-remove" }),
    }));
    const link = (await created.json()) as Link;
    await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: link.id }),
    }));

    const res = await SELF.fetch(asApi(keyOther, `/_/api/bundles/${bundle.id}/links/${link.id}`, { method: "DELETE" }));
    expect(res.status).toBe(403);
  });
});

describe("MCP surface: the same rules reach the tool layer", () => {
  it("the owner deletes a zero-click link through delete_link", async () => {
    const session = await mcpSession(OWNER);
    const created = await callTool(OWNER, session, "create_link", { url: "https://example.com/mcp-del-ok" });
    const link = JSON.parse(created.text) as Link;

    const outcome = await callTool(OWNER, session, "delete_link", { link_id: link.id });
    expect(outcome.isError).toBe(false);
  });

  it("deleting a clicked link is refused, and the tool says to disable instead", async () => {
    const session = await mcpSession(OWNER);
    const created = await callTool(OWNER, session, "create_link", { url: "https://example.com/mcp-del-clicked" });
    const link = JSON.parse(created.text) as Link;
    await seedClick(primarySlug(link));

    const outcome = await callTool(OWNER, session, "delete_link", { link_id: link.id });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toBe("Cannot delete a link with clicks, disable it instead");
  });

  it("disable_link succeeds on the same clicked link", async () => {
    const session = await mcpSession(OWNER);
    const created = await callTool(OWNER, session, "create_link", { url: "https://example.com/mcp-disable-clicked" });
    const link = JSON.parse(created.text) as Link;
    await seedClick(primarySlug(link));

    const outcome = await callTool(OWNER, session, "disable_link", { link_id: link.id });
    expect(outcome.isError).toBe(false);
  });

  it("a second identity cannot delete, update, disable or enable the first identity's link", async () => {
    const ownerSession = await mcpSession(OWNER);
    const created = await callTool(OWNER, ownerSession, "create_link", { url: "https://example.com/mcp-cross" });
    const link = JSON.parse(created.text) as Link;

    const otherSession = await mcpSession(OTHER);
    const outcomes = [
      await callTool(OTHER, otherSession, "delete_link", { link_id: link.id }),
      await callTool(OTHER, otherSession, "update_link", { link_id: link.id, url: "https://evil.example" }),
      await callTool(OTHER, otherSession, "disable_link", { link_id: link.id }),
      await callTool(OTHER, otherSession, "enable_link", { link_id: link.id }),
    ];
    for (const outcome of outcomes) {
      expect(outcome.isError).toBe(true);
      expect(outcome.text).toMatch(/Only the link owner can/);
    }
  });

  it("a second identity still reads the first identity's link and analytics", async () => {
    const ownerSession = await mcpSession(OWNER);
    const created = await callTool(OWNER, ownerSession, "create_link", { url: "https://example.com/mcp-read" });
    const link = JSON.parse(created.text) as Link;
    await seedClick(primarySlug(link));

    const otherSession = await mcpSession(OTHER);
    const read = await callTool(OTHER, otherSession, "get_link", { link_id: link.id, range: "all" });
    expect(read.isError).toBe(false);
    expect(read.text).toContain(OWNER);

    const analytics = await callTool(OTHER, otherSession, "get_link_analytics", { link_id: link.id, range: "all" });
    expect(analytics.isError).toBe(false);
  });

  it("MCP reports the refusal as text only: the HTTP status is not carried through", async () => {
    // fail() in src/mcp/server.ts wraps result.error and drops result.status,
    // so a client cannot tell 403 from 400 except by reading the sentence.
    const ownerSession = await mcpSession(OWNER);
    const created = await callTool(OWNER, ownerSession, "create_link", { url: "https://example.com/mcp-status" });
    const link = JSON.parse(created.text) as Link;
    await seedClick(primarySlug(link));

    const otherSession = await mcpSession(OTHER);
    const forbidden = await callTool(OTHER, otherSession, "delete_link", { link_id: link.id });
    const clickRule = await callTool(OWNER, ownerSession, "delete_link", { link_id: link.id });

    expect(forbidden.text).toBe("Only the link owner can delete this link");
    expect(clickRule.text).toBe("Cannot delete a link with clicks, disable it instead");
    expect(forbidden.text).not.toMatch(/40[03]/);
    expect(clickRule.text).not.toMatch(/40[03]/);
  });

  it("bundle write tools are owner-gated and bundle reads are not", async () => {
    const ownerSession = await mcpSession(OWNER);
    const created = await callTool(OWNER, ownerSession, "create_bundle", { name: "MCP bundle" });
    const bundle = JSON.parse(created.text) as { id: number };

    const otherSession = await mcpSession(OTHER);
    const writes = [
      await callTool(OTHER, otherSession, "update_bundle", { bundle_id: bundle.id, name: "Hijacked" }),
      await callTool(OTHER, otherSession, "archive_bundle", { bundle_id: bundle.id }),
      await callTool(OTHER, otherSession, "unarchive_bundle", { bundle_id: bundle.id }),
      await callTool(OTHER, otherSession, "delete_bundle", { bundle_id: bundle.id }),
    ];
    for (const outcome of writes) {
      expect(outcome.isError).toBe(true);
      expect(outcome.text).toMatch(/Only the bundle owner can/);
    }

    const read = await callTool(OTHER, otherSession, "get_bundle", { bundle_id: bundle.id, range: "all" });
    expect(read.isError).toBe(false);
  });

  it("GAP: add_custom_slug and add_link_to_bundle are open to any identity", async () => {
    const ownerSession = await mcpSession(OWNER);
    const createdLink = await callTool(OWNER, ownerSession, "create_link", { url: "https://example.com/mcp-gap" });
    const link = JSON.parse(createdLink.text) as Link;
    const createdBundle = await callTool(OWNER, ownerSession, "create_bundle", { name: "MCP gap bundle" });
    const bundle = JSON.parse(createdBundle.text) as { id: number };

    const otherSession = await mcpSession(OTHER);
    const slug = await callTool(OTHER, otherSession, "add_custom_slug", { link_id: link.id, slug: "mcp-stranger" });
    expect(slug.isError).toBe(false);

    const member = await callTool(OTHER, otherSession, "add_link_to_bundle", { bundle_id: bundle.id, link_id: link.id });
    expect(member.isError).toBe(false);
  });
});
