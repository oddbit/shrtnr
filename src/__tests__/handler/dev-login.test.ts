// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF, createExecutionContext } from "cloudflare:test";
import worker from "../../index";
import { applyMigrations, resetData } from "../setup";

beforeAll(applyMigrations);
beforeEach(resetData);

const req = (path: string, init?: RequestInit) => new Request(`http://localhost:8787${path}`, { redirect: "manual", ...init });

describe("GET /_/dev/login (dev mode)", () => {
  it("sets the dev_identity cookie and redirects to the dashboard", async () => {
    const res = await SELF.fetch(req("/_/dev/login?as=alice@example.com"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/_/admin/dashboard");
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("dev_identity=alice%40example.com");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    // Local dev runs over plain http, so a Secure cookie would never be sent.
    expect(cookie).not.toContain("Secure");
  });

  it("honours a same-origin `to` path and rejects an absolute or protocol-relative one", async () => {
    const ok = await SELF.fetch(req("/_/dev/login?as=alice@example.com&to=/_/admin/links?sort=popular"));
    expect(ok.headers.get("Location")).toBe("/_/admin/links?sort=popular");
    for (const to of ["https://evil.example", "//evil.example/x", "javascript:alert(1)"]) {
      const res = await SELF.fetch(req(`/_/dev/login?as=alice@example.com&to=${encodeURIComponent(to)}`));
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/_/admin/dashboard");
    }
  });

  it("renders a form when no identity is given", async () => {
    const res = await SELF.fetch(req("/_/dev/login"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<form");
    expect(html).toContain('name="as"');
  });

  it("rejects an identity with whitespace, a semicolon, or over 254 characters", async () => {
    for (const bad of ["a b@example.com", "a;b@example.com", `${"x".repeat(250)}@example.com`]) {
      const res = await SELF.fetch(req(`/_/dev/login?as=${encodeURIComponent(bad)}`));
      expect(res.status).toBe(400);
      expect(res.headers.get("Set-Cookie")).toBeNull();
    }
  });

  it("makes the cookie identity the owner of what the browser creates", async () => {
    const login = await SELF.fetch(req("/_/dev/login?as=alice@example.com"));
    const cookie = (login.headers.get("Set-Cookie") ?? "").split(";")[0];
    const created = await SELF.fetch(
      req("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: "https://example.com/owned" }),
      }),
    );
    expect(created.status).toBe(201);
    const link = (await created.json()) as { created_by: string };
    expect(link.created_by).toBe("alice@example.com");
  });

  it("signs the landing page in, so / redirects to the dashboard", async () => {
    const res = await SELF.fetch(req("/", { headers: { Cookie: "dev_identity=alice%40example.com" } }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/_/admin/dashboard");
  });
});

describe("GET /_/dev/logout (dev mode)", () => {
  it("clears the cookie and returns to the landing page", async () => {
    const res = await SELF.fetch(req("/_/dev/logout", { headers: { Cookie: "dev_identity=alice%40example.com" } }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    expect(res.headers.get("Set-Cookie")).toContain("dev_identity=;");
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});

describe("/_/dev/* under ACCESS_AUD (production mode)", () => {
  const prodEnv = { ...env, ACCESS_AUD: "aud-tag", ACCESS_JWKS_URL: "https://team.cloudflareaccess.com/cdn-cgi/access/certs" };

  it("does not exist: login and logout both 404 and set no cookie", async () => {
    for (const path of ["/_/dev/login?as=alice@example.com", "/_/dev/login", "/_/dev/logout"]) {
      const res = await worker.fetch(req(path), prodEnv, createExecutionContext());
      expect(res.status).toBe(404);
      expect(res.headers.get("Set-Cookie")).toBeNull();
    }
  });
});
