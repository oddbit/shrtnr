// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin API authenticates with the Access session cookie, which the
// browser attaches to any request it sends to the admin host, including one a
// page on another site triggers. Several writes need no body at all
// (disable, enable, archive), and the JSON routes read a body whatever its
// Content-Type, so a plain cross-site form is enough to reach them. The admin
// API therefore refuses a write a browser marks as coming from another origin.
// A caller that sends neither marker is not a browser and carries no ambient
// cookie, so it passes.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import app from "../../index";
import { applyMigrations, resetData } from "../setup";
import { createLink, getLink } from "../../services/link-management";
import type { Env } from "../../types";

const OWNER = "owner@example.com";
const ORIGIN = "https://shrtnr.test";
const e = env as unknown as Env;

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

function admin(method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  return SELF.fetch(
    new Request(`${ORIGIN}${path}`, {
      method,
      redirect: "manual",
      headers: { "Cf-Access-Jwt-Assertion": makeJwt(OWNER), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function seedLink(): Promise<number> {
  const created = await createLink(e, { url: "https://example.com/seed", created_by: OWNER });
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

async function isDisabled(id: number): Promise<boolean> {
  const link = await getLink(e, id);
  if (!link.ok) throw new Error(link.error);
  return link.data.expires_at !== null;
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("admin API writes from another origin", () => {
  it("refuses a bodyless write whose Origin is another site, and changes nothing", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(((await res.json()) as { error: string }).error).toBeTruthy();
    expect(await isDisabled(id)).toBe(false);
  });

  it("refuses a JSON write whose Origin is another site, and creates nothing", async () => {
    const res = await admin("POST", "/_/admin/api/links", { Origin: "https://evil.example" }, { url: "https://example.com/x" });
    expect(res.status).toBe(403);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM links").first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it.each(["PUT", "DELETE"])("refuses a cross-origin %s", async (method) => {
    const id = await seedLink();
    const res = await admin(method, `/_/admin/api/links/${id}`, { Origin: "https://evil.example" }, { label: "x" });
    expect(res.status).toBe(403);
  });

  it("refuses an opaque origin (sandboxed frame, data: URL)", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "null" });
    expect(res.status).toBe(403);
    expect(await isDisabled(id)).toBe(false);
  });

  it("refuses a sibling subdomain: same site is not same origin", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "https://other.shrtnr.test" });
    expect(res.status).toBe(403);
  });

  it("refuses the same host over another scheme", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "http://shrtnr.test" });
    expect(res.status).toBe(403);
  });

  it("refuses the same host on another port", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "https://shrtnr.test:8443" });
    expect(res.status).toBe(403);
    expect(await isDisabled(id)).toBe(false);
  });

  it("refuses a host that merely starts with the admin's host", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "https://shrtnr.test.evil.example" });
    expect(res.status).toBe(403);
  });

  // The Origin header is the stronger statement: a forged or stale
  // Sec-Fetch-Site must not talk the guard out of it.
  it("refuses a foreign Origin even when Sec-Fetch-Site claims same-origin", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, {
      Origin: "https://evil.example",
      "Sec-Fetch-Site": "same-origin",
    });
    expect(res.status).toBe(403);
    expect(await isDisabled(id)).toBe(false);
  });

  it("refuses every kind of admin write, not only links", async () => {
    const evil = { Origin: "https://evil.example" };
    const attempts: [string, string, unknown][] = [
      ["POST", "/_/admin/api/keys", { title: "stolen", scope: "create,read" }],
      ["PUT", "/_/admin/api/settings", { theme: "dark" }],
      ["POST", "/_/admin/api/bundles", { name: "planted" }],
    ];
    for (const [method, path, body] of attempts) {
      expect((await admin(method, path, evil, body)).status, `${method} ${path}`).toBe(403);
    }
    const keys = await env.DB.prepare("SELECT COUNT(*) AS n FROM api_keys").first<{ n: number }>();
    expect(keys?.n).toBe(0);
  });

  it("refuses a write the browser labels cross-site when it sends no Origin", async () => {
    const id = await seedLink();
    for (const site of ["cross-site", "same-site"]) {
      const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { "Sec-Fetch-Site": site });
      expect(res.status).toBe(403);
    }
    expect(await isDisabled(id)).toBe(false);
  });

  it("does not bump the widget cache version for a refused write", async () => {
    const id = await seedLink();
    const before = await env.SLUG_KV!.get(`wcache:ver:${OWNER}`);
    await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "https://evil.example" });
    expect(await env.SLUG_KV!.get(`wcache:ver:${OWNER}`)).toBe(before);
  });
});

describe("admin API writes from the admin UI and from non-browser callers", () => {
  it("accepts a write whose Origin is the admin's own origin", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" });
    expect(res.status).toBe(200);
    expect(await isDisabled(id)).toBe(true);
  });

  it("compares origins, not strings: host case and a default port do not matter", async () => {
    const id = await seedLink();
    const res = await admin("POST", `/_/admin/api/links/${id}/disable`, { Origin: "https://SHRTNR.test:443" });
    expect(res.status).toBe(200);
  });

  it("accepts a write that carries neither Origin nor Sec-Fetch-Site", async () => {
    const res = await admin("POST", "/_/admin/api/links", {}, { url: "https://example.com/cli" });
    expect(res.status).toBe(201);
  });

  it("accepts Sec-Fetch-Site: same-origin and none without an Origin", async () => {
    for (const site of ["same-origin", "none"]) {
      const res = await admin("POST", "/_/admin/api/links", { "Sec-Fetch-Site": site }, { url: `https://example.com/${site}`, allow_duplicate: true });
      expect(res.status).toBe(201);
    }
  });

  it("leaves reads alone, whatever origin asks", async () => {
    await seedLink();
    const res = await admin("GET", "/_/admin/api/links", { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" });
    expect(res.status).toBe(200);
  });

  it("leaves the public API alone: a bearer key is not an ambient credential", async () => {
    const res = await SELF.fetch(
      new Request(`${ORIGIN}/_/api/links`, { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }),
    );
    // Refused for the missing key, not for the origin.
    expect(res.status).toBe(401);
  });
});

describe("admin HTML cannot be framed or sniffed", () => {
  it("sends frame and sniffing protection on an admin page", async () => {
    const res = await admin("GET", "/_/admin/dashboard");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // The caching rule on the same response still holds.
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache, must-revalidate");
  });

  it("sends nosniff on admin API JSON too", async () => {
    const res = await admin("GET", "/_/admin/api/links");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sends the same protection on the page that says Access is not configured", async () => {
    const deployed = { ...env, DEV_MODE: undefined, DEV_IDENTITY: undefined } as unknown as Env;
    const res = await app.fetch(
      new Request(`${ORIGIN}/_/admin/dashboard`),
      deployed,
      { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext,
    );
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("admin pages survive malformed input they do not control", () => {
  it("renders with a theme cookie that is not valid percent-encoding", async () => {
    const res = await admin("GET", "/_/admin/dashboard", { Cookie: "theme=%E0%A4%A; lang=%" });
    expect(res.status).toBe(200);
  });

  it("logout falls back to the dashboard when ACCESS_JWKS_URL is not a URL", async () => {
    const broken = { ...env, ACCESS_JWKS_URL: "team.cloudflareaccess.com/cdn-cgi/access/certs" } as unknown as Env;
    const res = await app.fetch(
      new Request(`${ORIGIN}/_/admin/logout`, { headers: { "Cf-Access-Jwt-Assertion": makeJwt(OWNER) } }),
      broken,
      { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/_/admin/dashboard");
  });
});
