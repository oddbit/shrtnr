import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyAccessJwt, extractIdentity, isSignedIn, type AccessUser } from "../access";
import type { Env } from "../types";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ACCESS_AUD: "",
    MCP_ACCESS_AUD: "",
    ACCESS_JWKS_URL: "",
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

    describe("when DEV_IDENTITY is set", () => {
      it("should return dev identity when no token and no email header", async () => {
        const env = fakeEnv({ DEV_IDENTITY: "dev@local" });
        const req = makeRequest();

        const user = await verifyAccessJwt(req, env);
        expect(user).toEqual({ email: "dev@local" });
      });

      it("should prefer real JWT email over DEV_IDENTITY", async () => {
        const env = fakeEnv({ DEV_IDENTITY: "dev@local" });
        const token = makeJwt({ email: "real@example.com" });
        const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });

        const user = await verifyAccessJwt(req, env);
        expect(user).toEqual({ email: "real@example.com" });
      });

      it("should prefer Cf-Access-Authenticated-User-Email header over DEV_IDENTITY", async () => {
        const env = fakeEnv({ DEV_IDENTITY: "dev@local" });
        const req = makeRequest({ "Cf-Access-Authenticated-User-Email": "header@example.com" });

        const user = await verifyAccessJwt(req, env);
        expect(user).toEqual({ email: "header@example.com" });
      });
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

describe("verifyAccessJwt – CF_Authorization cookie fallback", () => {
  describe("when ACCESS_AUD is not configured (dev mode)", () => {
    it("should return email from CF_Authorization cookie when no JWT header", async () => {
      const env = fakeEnv();
      const token = makeJwt({ email: "cookie@example.com" });
      const req = makeRequest({ Cookie: `CF_Authorization=${token}` });

      const user = await verifyAccessJwt(req, env);
      expect(user).toEqual({ email: "cookie@example.com" });
    });

    it("should prefer JWT header over CF_Authorization cookie", async () => {
      const env = fakeEnv();
      const headerToken = makeJwt({ email: "header@example.com" });
      const cookieToken = makeJwt({ email: "cookie@example.com" });
      const req = makeRequest({
        "Cf-Access-Jwt-Assertion": headerToken,
        Cookie: `CF_Authorization=${cookieToken}`,
      });

      const user = await verifyAccessJwt(req, env);
      expect(user).toEqual({ email: "header@example.com" });
    });
  });
});

describe("isSignedIn – CF_Authorization cookie", () => {
  it("should return true when CF_Authorization cookie holds a valid JWT (dev mode)", async () => {
    const env = fakeEnv();
    const token = makeJwt({ email: "cookie@example.com" });
    const req = makeRequest({ Cookie: `CF_Authorization=${token}` });

    expect(await isSignedIn(req, env)).toBe(true);
  });

  it("should return false when CF_Authorization cookie holds a malformed JWT", async () => {
    const env = fakeEnv();
    const req = makeRequest({ Cookie: "CF_Authorization=garbage" });

    expect(await isSignedIn(req, env)).toBe(false);
  });
});

describe("extractIdentity", () => {
  const env = fakeEnv();

  it("should return email from JWT", async () => {
    const token = makeJwt({ email: "user@example.com" });
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });
    expect(await extractIdentity(req, env)).toBe("user@example.com");
  });

  it("should return phone when email is absent", async () => {
    const token = makeJwt({ phone: "+15550001234" });
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });
    expect(await extractIdentity(req, env)).toBe("+15550001234");
  });

  it("should return sub when email and phone are absent", async () => {
    const token = makeJwt({ sub: "sub-12345" });
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });
    expect(await extractIdentity(req, env)).toBe("sub-12345");
  });

  it("should fall back to Cf-Access-Authenticated-User-Email header", async () => {
    const req = makeRequest({ "Cf-Access-Authenticated-User-Email": "header@example.com" });
    expect(await extractIdentity(req, env)).toBe("header@example.com");
  });

  it("should return 'anonymous' when no token and no header", async () => {
    const req = makeRequest();
    expect(await extractIdentity(req, env)).toBe("anonymous");
  });

  it("should return DEV_IDENTITY when set and no token or header present", async () => {
    const devEnv = fakeEnv({ DEV_IDENTITY: "dev@local" });
    const req = makeRequest();
    expect(await extractIdentity(req, devEnv)).toBe("dev@local");
  });

  it("should prefer real JWT email over DEV_IDENTITY", async () => {
    const devEnv = fakeEnv({ DEV_IDENTITY: "dev@local" });
    const token = makeJwt({ email: "real@example.com" });
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });
    expect(await extractIdentity(req, devEnv)).toBe("real@example.com");
  });

  it("should return 'anonymous' for malformed JWT", async () => {
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": "bad.jwt" });
    expect(await extractIdentity(req, env)).toBe("anonymous");
  });

  it("should return 'anonymous' for JWT payload with no identity claims", async () => {
    const token = makeJwt({ iat: 1234567890 });
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });
    expect(await extractIdentity(req, env)).toBe("anonymous");
  });

  it("should prefer email over phone and sub", async () => {
    const token = makeJwt({ email: "email@example.com", phone: "+1555", sub: "sub-1" });
    const req = makeRequest({ "Cf-Access-Jwt-Assertion": token });
    expect(await extractIdentity(req, env)).toBe("email@example.com");
  });
});
