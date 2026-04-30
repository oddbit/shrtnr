// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Helpers (copied from src/__tests__/handler/mcp.test.ts) ----

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
};

/**
 * Read a streamable-HTTP SSE response and pull the first JSON-RPC envelope
 * out of its `data:` payloads. Returns null if the stream closes before any
 * JSON message is observed. Mirrors the helper in handler/mcp.test.ts.
 */
async function readFirstSseMessage(res: Response): Promise<JsonRpcResponse | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
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
              // already closed
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
  await readFirstSseMessage(res);
  return sessionId!;
}

// Same poll helper used in redirect-flow / bundle-aggregation: redirect-time
// click recording runs through ctx.waitUntil(...), so the row may lag the
// SELF.fetch return.
async function waitForClick(linkId: number, timeoutMs = 1000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM clicks c JOIN slugs s ON s.slug = c.slug WHERE s.link_id = ?",
    )
      .bind(linkId)
      .first<{ cnt: number }>();
    const cnt = row?.cnt ?? 0;
    if (cnt > 0) return cnt;
    await new Promise((r) => setTimeout(r, 25));
  }
  return 0;
}

describe("MCP create_link followed by redirect", () => {
  it("a link minted via MCP redirects and records a click like an API-created link", async () => {
    // 1. Open an MCP session.
    const sessionId = await initSession();

    // 2. Call tools/call create_link with a destination URL. The MCP server
    //    echoes the LinkWithSlugs payload as JSON inside result.content[0].text
    //    (see ok() in src/mcp/server.ts).
    const callRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
          "Cf-Access-Jwt-Assertion": makeFakeJwt({ email: "dev@local" }),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "create_link",
            arguments: { url: "https://example.com/mcp-flow" },
          },
        }),
      }),
    );
    expect(callRes.status).toBe(200);

    const message = await readFirstSseMessage(callRes);
    expect(message).not.toBeNull();
    const result = message!.result as
      | { isError?: boolean; content?: { text?: string }[] }
      | undefined;
    expect(result).toBeDefined();
    expect(result?.isError).toBeFalsy();

    const text = result?.content?.[0]?.text;
    expect(typeof text).toBe("string");
    const created = JSON.parse(text!) as {
      id: number;
      url: string;
      slugs: { slug: string; is_primary: number | boolean }[];
    };
    expect(created.url).toBe("https://example.com/mcp-flow");
    expect(created.id).toBeGreaterThan(0);
    expect(created.slugs.length).toBeGreaterThan(0);

    const primary =
      created.slugs.find((s) => s.is_primary === 1 || s.is_primary === true) ??
      created.slugs[0];
    const slug = primary.slug;

    // 3. Hit /<slug> as a real-looking browser so the click is not bot-flagged.
    const redirectRes = await SELF.fetch(
      new Request(`https://shrtnr.test/${slug}`, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        },
      }),
    );
    expect(redirectRes.status).toBe(301);
    expect(redirectRes.headers.get("Location")).toBe("https://example.com/mcp-flow");

    // 4. The click recorded by the redirect handler must reference the same
    //    link.id the MCP tool returned.
    const cnt = await waitForClick(created.id);
    expect(cnt).toBeGreaterThanOrEqual(1);
  });
});
