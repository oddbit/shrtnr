// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";

beforeAll(applyMigrations);
beforeEach(resetData);

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

async function createApiKey(scope = "create,read"): Promise<string> {
  const res = await SELF.fetch(
    new Request("https://shrtnr.test/_/admin/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cf-Access-Jwt-Assertion": makeJwt("test@example.com"),
      },
      body: JSON.stringify({ title: "mcp-test-key", scope }),
    }),
  );
  const data = (await res.json()) as { raw_key: string };
  return data.raw_key;
}

function mcpRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://shrtnr.test/_/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("MCP endpoint auth", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await SELF.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts requests with a valid API key", async () => {
    const apiKey = await createApiKey();
    const res = await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jsonrpc: string;
      result: { serverInfo: { name: string } };
    };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.result.serverInfo.name).toBe("shrtnr");
  });
});

describe("MCP tool listing", () => {
  it("lists all 8 tools", async () => {
    const apiKey = await createApiKey();

    // Initialize first
    const initRes = await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );
    expect(initRes.status).toBe(200);
    const initBody = (await initRes.json()) as { result: { serverInfo: { name: string } } };
    expect(initBody.result.serverInfo.name).toBe("shrtnr");

    // List tools
    const toolsRes = await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );
    expect(toolsRes.status).toBe(200);
    const toolsBody = (await toolsRes.json()) as {
      result: { tools: { name: string }[] };
    };
    const names = toolsBody.result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "add_vanity_slug",
      "create_link",
      "disable_link",
      "get_link",
      "get_link_analytics",
      "health",
      "list_links",
      "update_link",
    ]);
  });
});

describe("MCP tool execution", () => {
  it("health tool returns status ok", async () => {
    const apiKey = await createApiKey();

    // Initialize
    await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );

    // Call health tool
    const res = await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "health", arguments: {} },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: { type: string; text: string }[] };
    };
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.status).toBe("ok");
  });

  it("create_link tool shortens a URL", async () => {
    const apiKey = await createApiKey();

    await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );

    const res = await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "create_link",
            arguments: { url: "https://example.com/test" },
          },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: { type: string; text: string }[]; isError?: boolean };
    };
    expect(body.result.isError).toBeUndefined();
    const link = JSON.parse(body.result.content[0].text);
    expect(link.url).toBe("https://example.com/test");
    expect(link.slugs.length).toBeGreaterThan(0);
  });

  it("list_links tool returns created links", async () => {
    const apiKey = await createApiKey();

    await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );

    // Create a link first via API
    await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ url: "https://example.com/listed" }),
      }),
    );

    const res = await SELF.fetch(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "list_links", arguments: {} },
        },
        { Authorization: `Bearer ${apiKey}` },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: { type: string; text: string }[] };
    };
    const links = JSON.parse(body.result.content[0].text);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].url).toBe("https://example.com/listed");
  });
});
