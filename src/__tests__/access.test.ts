import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyAccessJwt, type AccessUser } from "../access";
import type { Env } from "../types";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    OAUTH_KV: {} as KVNamespace,
    ACCESS_CLIENT_ID: "",
    ACCESS_CLIENT_SECRET: "",
    ACCESS_TOKEN_URL: "",
    ACCESS_AUTHORIZATION_URL: "",
    ACCESS_JWKS_URL: "",
    COOKIE_ENCRYPTION_KEY: "",
    ACCESS_AUD: "",
    MCP_OBJECT: {} as DurableObjectNamespace,
    ...overrides,
  };
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://shrtnr.test/_/admin/dashboard", { headers });
}

describe("verifyAccessJwt", () => {
  // ---- Dev mode: ACCESS_AUD not configured ----

  describe("when ACCESS_AUD is not configured (dev mode)", () => {
    it("should return email from unverified JWT header", async () => {
      const env = fakeEnv();
      const token = makeJwt({ email: "dev@example.com" });
      const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });

      const user = await verifyAccessJwt(req, env);
      expect(user).toEqual({ email: "dev@example.com" });
    });

    it("should return email from Cf-Access-Authenticated-User-Email header when no JWT", async () => {
      const env = fakeEnv();
      const req = makeRequest({ "Cf-Access-Authenticated-User-Email": "header@example.com" });

      const user = await verifyAccessJwt(req, env);
      expect(user).toEqual({ email: "header@example.com" });
    });

    it("should return null when no token and no email header", async () => {
      const env = fakeEnv();
      const req = makeRequest();

      const user = await verifyAccessJwt(req, env);
      expect(user).toBeNull();
    });

    it("should return null for malformed JWT (not 3 parts)", async () => {
      const env = fakeEnv();
      const req = makeRequest({ "Cf-Access-Jwt-Assertion": "not.a.valid.jwt.token" });

      const user = await verifyAccessJwt(req, env);
      expect(user).toBeNull();
    });

    it("should return null for JWT with non-JSON payload", async () => {
      const env = fakeEnv();
      const req = makeRequest({ "Cf-Access-Jwt-Assertion": "aaa.bbb.ccc" });

      const user = await verifyAccessJwt(req, env);
      expect(user).toBeNull();
    });

    it("should return null for JWT payload without email field", async () => {
      const env = fakeEnv();
      const token = makeJwt({ sub: "12345" });
      const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });

      const user = await verifyAccessJwt(req, env);
      expect(user).toBeNull();
    });
  });

  // ---- Production mode: ACCESS_AUD configured ----

  describe("when ACCESS_AUD is configured (production mode)", () => {
    it("should reject request without JWT token", async () => {
      const env = fakeEnv({
        ACCESS_AUD: "test-aud-tag",
        ACCESS_JWKS_URL: "https://one.dong.cloudflareaccess.com/cdn-cgi/access/certs",
      });
      const req = makeRequest();

      const user = await verifyAccessJwt(req, env);
      expect(user).toBeNull();
    });

    it("should reject request with invalid JWT when ACCESS_AUD is set", async () => {
      const env = fakeEnv({
        ACCESS_AUD: "test-aud-tag",
        ACCESS_JWKS_URL: "https://one.dong.cloudflareaccess.com/cdn-cgi/access/certs",
      });
      const token = makeJwt({ email: "fake@example.com" });
      const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });

      const user = await verifyAccessJwt(req, env);
      expect(user).toBeNull();
    });
  });
});
