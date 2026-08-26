// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import {
  listLinks,
  createLink,
  getLink,
  updateLink,
  disableLink,
  addCustomSlugToLink,
  getLinkAnalytics,
  searchLinks,
} from "../../services/link-management";
import { ShrtnrMCP } from "../../mcp/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Helper: build an unsigned fake JWT for dev/test mode ----

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

// ---- Old OAuth routes return 404 ----

describe("Old OAuth routes return 404", () => {
  it("GET /oauth/authorize returns 404", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/oauth/authorize"),
    );
    expect(res.status).toBe(404);
  });

  it("POST /oauth/callback returns 404", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/oauth/callback", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });

  it("POST /oauth/token returns 404", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/oauth/token", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });

  it("POST /oauth/register returns 404", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/oauth/register", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });
});

// ---- MCP landing page ----

describe("MCP landing page", () => {
  it("GET /_/mcp with Accept: text/html returns 200 with app name", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        headers: { Accept: "text/html" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("shrtnr");
  });

  it("returns text/html content type", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        headers: { Accept: "text/html" },
      }),
    );
    expect(res.headers.get("Content-Type")).toBe("text/html;charset=UTF-8");
  });

  it("sets a no-cache Cache-Control header so inline styles refresh on each deploy", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        headers: { Accept: "text/html" },
      }),
    );
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });
});

// ---- MCP transport in dev mode ----

describe("MCP transport (dev mode, no MCP_ACCESS_AUD)", () => {
  it("POST /_/mcp with Content-Type: application/json reaches MCP handler", async () => {
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
    // Should reach the MCP handler (not 404, not 401, not 403)
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /_/mcp with Cf-Access-Jwt-Assertion fake JWT reaches MCP handler", async () => {
    const token = makeFakeJwt({ email: "test@example.com" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Cf-Access-Jwt-Assertion": token,
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
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ---- OAuth discovery ----

describe("OAuth discovery", () => {
  it("GET /.well-known/oauth-authorization-server returns 200 with correct endpoints", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/.well-known/oauth-authorization-server"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.issuer).toBe("https://shrtnr.test");
    expect(body.authorization_endpoint).toBe(
      "https://shrtnr.test/cdn-cgi/access/oauth/authorization",
    );
    expect(body.token_endpoint).toBe(
      "https://shrtnr.test/cdn-cgi/access/oauth/token",
    );
    expect(body.registration_endpoint).toBe(
      "https://shrtnr.test/cdn-cgi/access/oauth/registration",
    );
    // Endpoints start with the test origin
    expect((body.authorization_endpoint as string).startsWith("https://shrtnr.test")).toBe(true);
  });

  it("includes CORS header", async () => {
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/.well-known/oauth-authorization-server"),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ---- MCP tool behavior (service layer) ----
// These tests verify the same tool logic that the McpAgent exposes,
// tested through the service functions directly since the OAuth flow
// cannot be simulated in unit tests.

describe("MCP tool behavior (service layer)", () => {
  it("create_link creates a short link", async () => {
    const result = await createLink(env as never, {
      url: "https://example.com/test",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://example.com/test");
      expect(result.data.slugs.length).toBeGreaterThan(0);
    }
  });

  it("list_links returns created links", async () => {
    await createLink(env as never, {
      url: "https://example.com/listed",
    });
    const result = await listLinks(env as never);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].url).toBe("https://example.com/listed");
    }
  });

  it("get_link returns a specific link", async () => {
    const created = await createLink(env as never, {
      url: "https://example.com/detail",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getLink(env as never, created.data.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://example.com/detail");
    }
  });

  it("update_link modifies a link", async () => {
    const created = await createLink(env as never, {
      url: "https://example.com/original",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateLink(env as never, created.data.id, {
      url: "https://example.com/updated",
    }, "anonymous");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://example.com/updated");
    }
  });

  it("disable_link disables a link", async () => {
    const created = await createLink(env as never, {
      url: "https://example.com/disable-me",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await disableLink(env as never, created.data.id, created.data.created_by);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expires_at).toBeDefined();
      expect(result.data.expires_at).not.toBeNull();
    }
  });

  it("add_custom_slug adds a custom slug", async () => {
    const created = await createLink(env as never, {
      url: "https://example.com/custom",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await addCustomSlugToLink(env as never, created.data.id, {
      slug: "my-custom",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("my-custom");
    }
  });

  it("get_link_analytics returns click stats", async () => {
    const created = await createLink(env as never, {
      url: "https://example.com/analytics",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await getLinkAnalytics(env as never, created.data.id, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total_clicks).toBe(0);
      expect(result.data.countries).toEqual([]);
    }
  });

  it("search_links finds a link by label", async () => {
    await createLink(env as never, { url: "https://oddbit.id", label: "Oddbit website" });
    await createLink(env as never, { url: "https://example.com", label: "Unrelated page" });

    const result = await searchLinks(env as never, "oddbit");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].label).toBe("Oddbit website");
    }
  });

  it("search_links finds a link by slug", async () => {
    const created = await createLink(env as never, { url: "https://oddbit.id/pricing" });
    if (created.ok) {
      await addCustomSlugToLink(env as never, created.data.id, { slug: "pricing-page" });
    }
    await createLink(env as never, { url: "https://example.com" });

    const result = await searchLinks(env as never, "pricing");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].url).toBe("https://oddbit.id/pricing");
    }
  });

  it("search_links returns all slugs on matched links", async () => {
    const created = await createLink(env as never, {
      url: "https://oddbit.id",
      label: "Oddbit website",
    });
    if (created.ok) {
      await addCustomSlugToLink(env as never, created.data.id, { slug: "oddbit-home" });
    }

    const result = await searchLinks(env as never, "oddbit");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].slugs.length).toBeGreaterThanOrEqual(2);
      const slugNames = result.data[0].slugs.map((s) => s.slug);
      expect(slugNames).toContain("oddbit-home");
    }
  });

  it("search_links returns empty array when no match", async () => {
    await createLink(env as never, { url: "https://example.com", label: "Some page" });

    const result = await searchLinks(env as never, "xyzzy-no-match");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("search_links returns empty array for blank query", async () => {
    await createLink(env as never, { url: "https://example.com" });

    const result = await searchLinks(env as never, "");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });
});

// ---- MCP identity resolution ----
// Regression: the identity getter once returned `this.identity`, which
// caused every write tool (create/disable/enable/delete) to stack-overflow.

describe("ShrtnrMCP identity getter", () => {
  it("returns the authenticated email from props without recursing", () => {
    const agent = Object.create(ShrtnrMCP.prototype) as { props: { email: string }; identity: string };
    agent.props = { email: "dennis@oddbit.id" };
    expect(agent.identity).toBe("dennis@oddbit.id");
  });

  it("throws when invoked without props", () => {
    const agent = Object.create(ShrtnrMCP.prototype) as { identity: string };
    expect(() => agent.identity).toThrow(/without identity props/);
  });
});

// ---- create_link duplicate semantics ----
// The UI and API return the existing link (with `duplicate: true`) instead of
// failing when the URL already exists. The MCP tool must expose the same
// contract so callers don't pre-search defensively.

describe("create_link duplicate semantics", () => {
  it("second call with the same URL returns the existing link with duplicate meta", async () => {
    const first = await createLink(env as never, { url: "https://duplicate.example/test", created_by: "dennis@oddbit.id" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await createLink(env as never, { url: "https://duplicate.example/test", created_by: "dennis@oddbit.id" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.data.id).toBe(first.data.id);
    expect(second.status).toBe(200);
    expect(second.meta?.duplicate).toBe(true);
    expect(second.meta?.duplicate_count).toBe(1);
  });

  it("first call returns 201 with no duplicate meta", async () => {
    const result = await createLink(env as never, { url: "https://fresh.example/test", created_by: "dennis@oddbit.id" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(201);
    expect(result.meta).toBeUndefined();
  });
});

// ---- MCP error surface ----
// The streamable-HTTP transport in the `agents` runtime returns parse and
// session-validation errors directly as a JSON 400 with a JSON-RPC error
// envelope in the body. Tool-level errors come back via the SSE response
// stream as a JSON-RPC error envelope inside `data:` lines, so the helper
// below parses the first such frame.

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
};

/**
 * Read a streamable-HTTP SSE response and pull the first JSON-RPC envelope
 * out of its `data:` payloads. Returns null if the stream closes before any
 * JSON message is observed.
 */
async function readFirstSseMessage(res: Response): Promise<JsonRpcResponse | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    // SSE frames are terminated by a blank line.
    while (buffer.includes("\n\n")) {
      const idx = buffer.indexOf("\n\n");
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload) {
            try {
              await reader.cancel();
            } catch {
              // Stream already closed; ignore.
            }
            return JSON.parse(payload) as JsonRpcResponse;
          }
        }
      }
    }
    if (done) return null;
  }
}

/**
 * Initialize an MCP session and return the negotiated session ID. Throws if
 * the response is not the expected SSE stream with an `mcp-session-id` header.
 */
async function initSession(): Promise<string> {
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
  expect(res.status).toBe(200);
  const sessionId = res.headers.get("mcp-session-id");
  expect(sessionId).toBeTruthy();
  // Drain the initialize response so the durable transport is ready for the
  // follow-up call. We do not need the body here.
  await readFirstSseMessage(res);
  return sessionId!;
}

describe("MCP get_link_qr", () => {
  it("encodes the short URL with the utm_medium=qr tracking parameter", async () => {
    const created = await createLink(env as any, { url: "https://example.com/qr-target" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const sessionId = await initSession();
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "get_link_qr",
            arguments: { link_id: created.data.id, base_url: "https://shrtnr.test" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const message = await readFirstSseMessage(res);
    expect(message).not.toBeNull();
    const result = message!.result as { isError?: boolean; content?: { type: string; text?: string }[] } | undefined;
    expect(result?.isError).toBeFalsy();

    const text = result?.content?.find((c) => c.type === "text")?.text ?? "";
    const slug = created.data.slugs[0].slug;
    // The QR must encode the same tracked URL shape as the REST endpoint
    // (api/qr.ts), so redirect.ts records the scan with link_mode = "qr".
    expect(text).toContain(`https://shrtnr.test/${slug}?utm_medium=qr`);
  });

  it("matches an explicit slug argument regardless of case, since stored slugs are always lowercase", async () => {
    const created = await createLink(env as any, { url: "https://example.com/qr-case" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const slug = created.data.slugs[0].slug;

    const sessionId = await initSession();
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "get_link_qr",
            arguments: { link_id: created.data.id, slug: slug.toUpperCase(), base_url: "https://shrtnr.test" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const message = await readFirstSseMessage(res);
    const result = message!.result as { isError?: boolean; content?: { type: string; text?: string }[] } | undefined;
    expect(result?.isError).toBeFalsy();
    const text = result?.content?.find((c) => c.type === "text")?.text ?? "";
    expect(text).toContain(`https://shrtnr.test/${slug}?utm_medium=qr`);
  });
});

describe("MCP error surface", () => {
  it("malformed JSON-RPC body returns parse error (-32700)", async () => {
    // No session needed: the parse error fires before session validation.
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: "{ not valid json",
      }),
    );
    // The agents transport returns HTTP 400 with the JSON-RPC error envelope
    // directly in the JSON body (no SSE for parse errors).
    expect(res.status).toBe(400);
    const body = (await res.json()) as JsonRpcResponse;
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe(-32700);
  });

  it("invalid tool name returns a tool-error result", async () => {
    // The @modelcontextprotocol/sdk wraps tool-resolution and tool-execution
    // failures inside CallToolResult { isError: true, content: [{ text }] }
    // rather than emitting a JSON-RPC error envelope. See
    // node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js:
    //   createToolError() -> { content: [{ type: 'text', text }], isError: true }
    // The JSON-RPC layer therefore reports a `result`, not an `error`.
    const sessionId = await initSession();
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "no_such_tool_definitely", arguments: {} },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const message = await readFirstSseMessage(res);
    expect(message).not.toBeNull();
    const result = message!.result as { isError?: boolean; content?: { text?: string }[] } | undefined;
    expect(result).toBeDefined();
    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toMatch(/no_such_tool_definitely/);
  });

  it("malformed args on a real tool returns a tool-error result", async () => {
    // create_link requires `url`. Omit it to trigger schema validation, which
    // the SDK converts into a tool-error CallToolResult (same wrapping path
    // as unknown-tool above).
    const sessionId = await initSession();
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "create_link", arguments: {} },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const message = await readFirstSseMessage(res);
    expect(message).not.toBeNull();
    const result = message!.result as { isError?: boolean; content?: { text?: string }[] } | undefined;
    expect(result).toBeDefined();
    expect(result?.isError).toBe(true);
    // The validation error mentions the tool name and the failing field.
    expect(result?.content?.[0]?.text).toMatch(/create_link/);
    expect(result?.content?.[0]?.text?.toLowerCase()).toMatch(/url|required|invalid/);
  });
});

// ---- MCP tool description accuracy ----
// Regression: list_bundles' description claimed bundles are "owned by the
// caller", but listBundles() is deliberately open-read across owners (see
// bundle-management.ts). A tool description that overstates privacy could
// mislead an agent into disclosing another user's bundles while believing
// the results were caller-scoped.

describe("MCP tool descriptions", () => {
  it("list_bundles does not claim caller-owned scoping", async () => {
    const agent = Object.create(ShrtnrMCP.prototype) as ShrtnrMCP;
    agent.server = new McpServer({ name: "shrtnr", version: "test" });
    await agent.init();

    // Read the descriptions back over the wire protocol (tools/list) rather
    // than off the server's internals, so the test depends only on the
    // contract an MCP client actually sees.
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "test" });
    await Promise.all([
      client.connect(clientTransport),
      agent.server.connect(serverTransport),
    ]);

    try {
      const { tools } = await client.listTools();
      const listBundles = tools.find((t) => t.name === "list_bundles");
      expect(listBundles).toBeDefined();
      expect(listBundles?.description).not.toMatch(/owned by the caller/i);
      expect(listBundles?.description).toMatch(/visible to any authenticated caller/i);
    } finally {
      await client.close();
    }
  });

  // createLink() normalizes the URL and returns the existing row on a repeat
  // call, so a caller never has to search before shortening. The description
  // and the idempotent annotation both have to announce that, otherwise every
  // agent re-discovers the contract by trial or by a wasted lookup.
  it("create_link announces its idempotent upsert contract", async () => {
    const agent = Object.create(ShrtnrMCP.prototype) as ShrtnrMCP;
    agent.server = new McpServer({ name: "shrtnr", version: "test" });
    await agent.init();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "test" });
    await Promise.all([
      client.connect(clientTransport),
      agent.server.connect(serverTransport),
    ]);

    try {
      const { tools } = await client.listTools();
      const createLinkTool = tools.find((t) => t.name === "create_link");
      expect(createLinkTool).toBeDefined();
      expect(createLinkTool?.description).toMatch(/idempotent/i);
      expect(createLinkTool?.description).toMatch(/trailing slash/i);
      expect(createLinkTool?.description).toMatch(/no need to (search|look)/i);
      expect(createLinkTool?.annotations?.idempotentHint).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// ---- create_link trailing-slash normalization ----
// The description promises that a trailing slash does not fork a second link.
// This pins the behaviour behind that promise.

describe("create_link URL normalization", () => {
  it("treats a trailing-slash variant as the same destination", async () => {
    const first = await createLink(env as never, { url: "https://slash.example/docs", created_by: "dennis@oddbit.id" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await createLink(env as never, { url: "https://slash.example/docs/", created_by: "dennis@oddbit.id" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.data.id).toBe(first.data.id);
    expect(second.meta?.duplicate).toBe(true);
  });
});
