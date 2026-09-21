// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Pins the JWKS resolver's two properties (src/access.ts): the key set is
// downloaded once per isolate and URL, and the resolver that reads it is
// created per request. A shared RemoteJWKSet would share its in-flight
// fetch promise, and a request that awaits I/O started by another request
// fails in Workers with "Cannot perform I/O on behalf of a different
// request". A module-level resolver passes every other test in this suite;
// only the call counts here tell the two designs apart.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as jose from "jose";
import { extractIdentity, verifyAccessJwt } from "../../access";
import type { Env } from "../../types";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return { ...actual, createRemoteJWKSet: vi.fn(actual.createRemoteJWKSet) };
});

const AUD = "test-aud-tag";

let privateKey: CryptoKey;
let keySet: { keys: jose.JWK[] };

beforeAll(async () => {
  const pair = await jose.generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  keySet = { keys: [{ ...(await jose.exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function env(jwksUrl: string): Env {
  return {
    DB: {} as D1Database,
    SLUG_KV: {} as KVNamespace,
    ACCESS_AUD: AUD,
    MCP_ACCESS_AUD: "",
    ACCESS_JWKS_URL: jwksUrl,
    MCP_OBJECT: {} as Env["MCP_OBJECT"],
  };
}

async function signedRequest(email: string): Promise<Request> {
  const token = await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return new Request("https://shrtnr.test/_/admin/dashboard", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
}

/** Stubs global fetch to answer the JWKS URL, counting the downloads. */
function stubJwksFetch(): { calls: () => number } {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/cdn-cgi/access/certs")) throw new Error(`unexpected fetch ${url}`);
    return Response.json(keySet);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls: () => fetchMock.mock.calls.length };
}

describe("JWKS resolution", () => {
  it("downloads the key set once per isolate and URL, then verifies every later request against it", async () => {
    const jwks = stubJwksFetch();
    const e = env("https://once.test/cdn-cgi/access/certs");

    expect(await verifyAccessJwt(await signedRequest("a@example.com"), e)).toEqual({ email: "a@example.com" });
    expect(jwks.calls()).toBe(1);
    expect(await verifyAccessJwt(await signedRequest("b@example.com"), e)).toEqual({ email: "b@example.com" });
    expect(jwks.calls()).toBe(1);
  });

  it("shares the downloaded key set between verifyAccessJwt and extractIdentity", async () => {
    const jwks = stubJwksFetch();
    const e = env("https://shared.test/cdn-cgi/access/certs");

    expect(await verifyAccessJwt(await signedRequest("a@example.com"), e)).toEqual({ email: "a@example.com" });
    expect(await extractIdentity(await signedRequest("b@example.com"), e)).toBe("b@example.com");
    expect(jwks.calls()).toBe(1);
  });

  it("creates a new resolver for every request, all over one cache object per URL", async () => {
    stubJwksFetch();
    const e = env("https://per-request.test/cdn-cgi/access/certs");
    const created = vi.mocked(jose.createRemoteJWKSet);
    const before = created.mock.calls.length;

    await verifyAccessJwt(await signedRequest("a@example.com"), e);
    await verifyAccessJwt(await signedRequest("b@example.com"), e);

    const calls = created.mock.calls.slice(before);
    expect(calls).toHaveLength(2);
    const [firstOpts, secondOpts] = calls.map((c) => c[1] as Record<symbol, unknown>);
    expect(firstOpts[jose.jwksCache]).toBeDefined();
    expect(firstOpts[jose.jwksCache]).toBe(secondOpts[jose.jwksCache]);
    const [firstResolver, secondResolver] = created.mock.results.slice(before).map((r) => r.value);
    expect(firstResolver).not.toBe(secondResolver);
  });

  it("keeps separate caches for separate URLs", async () => {
    const jwks = stubJwksFetch();
    await verifyAccessJwt(await signedRequest("a@example.com"), env("https://one.test/cdn-cgi/access/certs"));
    await verifyAccessJwt(await signedRequest("a@example.com"), env("https://two.test/cdn-cgi/access/certs"));
    expect(jwks.calls()).toBe(2);
  });
});
