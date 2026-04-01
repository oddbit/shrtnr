// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import {
  listManagedLinks,
  createManagedLink,
  getManagedLink,
  updateManagedLink,
  disableManagedLink,
  addVanitySlugToLink,
  getManagedLinkAnalytics,
} from "../services/link-management";

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- MCP endpoint auth ----

describe("MCP endpoint auth", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects API key Bearer tokens on the MCP endpoint", async () => {
    // Create an API key via the admin API
    const createRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "mcp-test-key", scope: "create,read" }),
      }),
    );
    const { raw_key } = (await createRes.json()) as { raw_key: string };

    // Try to use API key on MCP endpoint: should be rejected
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${raw_key}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(res.status).toBe(401);
  });
});

// ---- OAuth discovery ----

describe("OAuth discovery", () => {
  it("serves OAuth authorization server metadata", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/.well-known/oauth-authorization-server"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.token_endpoint).toBeDefined();
    expect(body.authorization_endpoint).toBeDefined();
  });

  it("serves OAuth protected resource metadata", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/.well-known/oauth-protected-resource"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.resource).toBeDefined();
    expect(body.authorization_servers).toBeDefined();
  });

  it("serves per-route protected resource metadata for /_/mcp", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/.well-known/oauth-protected-resource/_/mcp"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.resource).toContain("/_/mcp");
  });

  it("accepts dynamic client registration", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
          client_name: "Test Client",
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.client_id).toBeDefined();
  });

  it("token endpoint rejects invalid grant", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=invalid&client_id=fake&redirect_uri=https://example.com/cb&code_verifier=test",
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });
});

// ---- MCP tool behavior (service layer) ----
// These tests verify the same tool logic that the McpAgent exposes,
// tested through the service functions directly since the OAuth flow
// cannot be simulated in unit tests.

describe("MCP tool behavior (service layer)", () => {
  it("create_link creates a short link", async () => {
    const result = await createManagedLink(env as never, {
      url: "https://example.com/test",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://example.com/test");
      expect(result.data.slugs.length).toBeGreaterThan(0);
    }
  });

  it("list_links returns created links", async () => {
    await createManagedLink(env as never, {
      url: "https://example.com/listed",
    });
    const result = await listManagedLinks(env as never);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].url).toBe("https://example.com/listed");
    }
  });

  it("get_link returns a specific link", async () => {
    const created = await createManagedLink(env as never, {
      url: "https://example.com/detail",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getManagedLink(env as never, created.data.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://example.com/detail");
    }
  });

  it("update_link modifies a link", async () => {
    const created = await createManagedLink(env as never, {
      url: "https://example.com/original",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateManagedLink(env as never, created.data.id, {
      url: "https://example.com/updated",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://example.com/updated");
    }
  });

  it("disable_link disables a link", async () => {
    const created = await createManagedLink(env as never, {
      url: "https://example.com/disable-me",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await disableManagedLink(env as never, created.data.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expires_at).toBeDefined();
      expect(result.data.expires_at).not.toBeNull();
    }
  });

  it("add_vanity_slug adds a custom slug", async () => {
    const created = await createManagedLink(env as never, {
      url: "https://example.com/vanity",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await addVanitySlugToLink(env as never, created.data.id, {
      slug: "my-custom",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("my-custom");
    }
  });

  it("get_link_analytics returns click stats", async () => {
    const created = await createManagedLink(env as never, {
      url: "https://example.com/analytics",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getManagedLinkAnalytics(env as never, created.data.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total_clicks).toBe(0);
      expect(result.data.countries).toEqual([]);
    }
  });
});
