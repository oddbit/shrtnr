// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// One deployment can sit behind two Access applications: the one-click
// application Cloudflare creates for the workers.dev URL, and a self-hosted
// application on the custom domain. Each signs its JWTs with its own AUD tag,
// so ACCESS_AUD takes a comma-separated list and accepts a token for any tag
// on it, and none other.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as jose from "jose";
import { extractIdentity, verifyAccessJwt } from "../../access";
import type { Env } from "../../types";

const JWKS_URL = "https://multi-aud.test/cdn-cgi/access/certs";

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

function env(accessAud: string): Env {
  return {
    DB: {} as D1Database,
    SLUG_KV: {} as KVNamespace,
    ACCESS_AUD: accessAud,
    MCP_ACCESS_AUD: "",
    ACCESS_JWKS_URL: JWKS_URL,
    MCP_OBJECT: {} as Env["MCP_OBJECT"],
  };
}

async function requestFor(aud: string, email: string): Promise<Request> {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(keySet)));
  const token = await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return new Request("https://shrtnr.test/_/admin/dashboard", { headers: { "Cf-Access-Jwt-Assertion": token } });
}

describe("ACCESS_AUD with several tags", () => {
  const e = env("workers-dev-aud, custom-domain-aud");

  it("accepts a token issued for either application", async () => {
    expect(await verifyAccessJwt(await requestFor("workers-dev-aud", "a@example.com"), e)).toEqual({ email: "a@example.com" });
    expect(await verifyAccessJwt(await requestFor("custom-domain-aud", "b@example.com"), e)).toEqual({ email: "b@example.com" });
    expect(await extractIdentity(await requestFor("custom-domain-aud", "b@example.com"), e)).toBe("b@example.com");
  });

  it("rejects a token issued for an application not on the list", async () => {
    expect(await verifyAccessJwt(await requestFor("other-aud", "c@example.com"), e)).toBeNull();
    expect(await extractIdentity(await requestFor("other-aud", "c@example.com"), e)).toBe("anonymous");
  });
});
