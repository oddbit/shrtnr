// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// A deployment that has not configured Cloudflare Access verification must
// refuse the operator surfaces, not trust whatever identity a request names.
// Only an explicit DEV_MODE (set in .dev.vars and the test pools, never in a
// deployment) turns on the unverified identity sources: the
// Cf-Access-Authenticated-User-Email header, an unsigned JWT, the
// dev_identity cookie and DEV_IDENTITY.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, createExecutionContext } from "cloudflare:test";
import worker from "../../index";
import { createLink, getLink } from "../../services/link-management";
import { applyMigrations, resetData } from "../setup";
import type { Env } from "../../types";

beforeAll(applyMigrations);
beforeEach(resetData);

const JWKS_URL = "https://team.cloudflareaccess.com/cdn-cgi/access/certs";

async function seedLink(url: string): Promise<{ id: number; slug: string }> {
  const result = await createLink(env as Env, { url, created_by: "owner@example.com" });
  if (!result.ok) throw new Error("seed failed");
  return { id: result.data.id, slug: result.data.slugs[0].slug };
}

async function storedUrl(id: number): Promise<string | undefined> {
  const result = await getLink(env as Env, id);
  return result.ok ? result.data.url : undefined;
}

/** A deployment: no DEV_MODE, and Access secrets as given. */
function deployedEnv(overrides: Partial<Env> = {}): Env {
  return { ...env, DEV_MODE: undefined, DEV_IDENTITY: undefined, ...overrides } as Env;
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `${btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${btoa(JSON.stringify(payload))}.fakesig`;
}

async function call(e: Env, path: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(
    new Request(`https://shrtnr.test${path}`, { redirect: "manual", ...init }),
    e,
    createExecutionContext(),
  );
}

const mcpInit = (headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
  }),
});

describe("admin without ACCESS_AUD outside dev mode", () => {
  it("refuses an admin API write that names its identity in a header", async () => {
    const link = await seedLink("https://example.com/owned");
    const res = await call(deployedEnv(), `/_/admin/api/links/${link.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cf-Access-Authenticated-User-Email": "owner@example.com" },
      body: JSON.stringify({ url: "https://phish.example" }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await storedUrl(link.id)).toBe("https://example.com/owned");
  });

  it("refuses an unsigned JWT and a dev_identity cookie the same way", async () => {
    const identityHeaders: Record<string, string>[] = [
      { "Cf-Access-Jwt-Assertion": fakeJwt({ email: "owner@example.com" }) },
      { Cookie: "dev_identity=owner%40example.com" },
    ];
    for (const headers of identityHeaders) {
      const res = await call(deployedEnv(), "/_/admin/api/keys", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ title: "k", scope: "create" }) });
      expect(res.status).toBe(503);
    }
  });

  it("answers an admin page with a setup page that names the missing secrets", async () => {
    const res = await call(deployedEnv(), "/_/admin/dashboard", {
      headers: { "Cf-Access-Authenticated-User-Email": "owner@example.com" },
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("ACCESS_AUD");
    expect(html).toContain("ACCESS_JWKS_URL");
    expect(html).toContain("DEV_MODE");
  });

  it("keeps short links redirecting", async () => {
    const link = await seedLink("https://example.com/public");
    const res = await call(deployedEnv(), `/${link.slug}`);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://example.com/public");
  });
});

describe("/_/dev/* outside dev mode", () => {
  it("answers 404 when ACCESS_AUD is unset but DEV_MODE is too", async () => {
    for (const path of ["/_/dev/login?as=owner@example.com", "/_/dev/login", "/_/dev/logout"]) {
      const res = await call(deployedEnv(), path);
      expect(res.status).toBe(404);
      expect(res.headers.get("Set-Cookie")).toBeNull();
    }
  });
});

describe("DEV_MODE never overrides a configured ACCESS_AUD", () => {
  it("still requires a verified JWT on the admin API", async () => {
    const res = await call(
      deployedEnv({ DEV_MODE: "true", ACCESS_AUD: "aud-tag", ACCESS_JWKS_URL: JWKS_URL }),
      "/_/admin/api/keys",
      { headers: { "Cf-Access-Authenticated-User-Email": "owner@example.com" } },
    );
    expect(res.status).toBe(401);
  });
});

describe("MCP without MCP_ACCESS_AUD outside dev mode", () => {
  it("does not serve the transport when only the admin AUD is configured", async () => {
    const res = await call(deployedEnv({ ACCESS_AUD: "aud-tag", ACCESS_JWKS_URL: JWKS_URL }), "/_/mcp", mcpInit());
    expect(res.status).toBe(404);
  });

  it("does not serve the transport when no AUD is configured, whatever identity the request names", async () => {
    const res = await call(
      deployedEnv(),
      "/_/mcp",
      mcpInit({ "Cf-Access-Authenticated-User-Email": "owner@example.com" }),
    );
    expect(res.status).toBe(404);
  });

  it("does not serve the transport on the mcp. host either", async () => {
    const res = await worker.fetch(
      new Request("https://mcp.shrtnr.test/mcp", mcpInit({ "Cf-Access-Authenticated-User-Email": "owner@example.com" })),
      deployedEnv(),
      createExecutionContext(),
    );
    expect(res.status).toBe(404);
  });

  it("rejects an unverified request once MCP_ACCESS_AUD is set, even in dev mode", async () => {
    const res = await call(
      deployedEnv({ DEV_MODE: "true", MCP_ACCESS_AUD: "mcp-aud", ACCESS_JWKS_URL: JWKS_URL }),
      "/_/mcp",
      mcpInit({ "Cf-Access-Authenticated-User-Email": "owner@example.com" }),
    );
    expect(res.status).toBe(401);
  });
});
