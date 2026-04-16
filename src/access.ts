// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Env } from "./types";

export type AccessUser = {
  email: string;
};

// Cache the JWKS instance per JWKS URL to avoid re-fetching on every request.
let cachedJwksUrl: string | null = null;
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (cachedJwks && cachedJwksUrl === jwksUrl) return cachedJwks;
  cachedJwksUrl = jwksUrl;
  cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
  return cachedJwks;
}

/**
 * Extract the access token from the request, checking the Cf-Access-Jwt-Assertion
 * header first, then falling back to the CF_Authorization cookie.
 */
function extractToken(request: Request): string | null {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header;
  const cookies = request.headers.get("Cookie") ?? "";
  const match = cookies.match(/CF_Authorization=([^\s;]+)/);
  return match ? match[1] : null;
}

/**
 * Parse the payload of an unverified JWT without validating the signature.
 * Returns the raw payload object or null if malformed.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Extract a stable identity string from a request.
 *
 * In dev/test mode (aud not set), reads from an unverified JWT or the
 * Cf-Access-Authenticated-User-Email header. In production mode, reads from
 * the verified JWT payload.
 *
 * Tries claims in order: email -> phone -> sub. Falls back to "anonymous" so
 * the return value is always a non-empty string safe to use as a DB key.
 *
 * Pass the AUD for the Access application protecting the current route:
 * - Admin routes: env.ACCESS_AUD
 * - MCP routes:   env.MCP_ACCESS_AUD
 */
export async function extractIdentity(request: Request, env: Env, aud = env.ACCESS_AUD): Promise<string> {
  function fromPayload(payload: Record<string, unknown>): string | null {
    for (const claim of ["email", "phone", "sub"] as const) {
      const val = payload[claim];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return null;
  }

  const token = extractToken(request);

  if (!aud) {
    // Dev/test mode: no cryptographic validation.
    if (token) {
      const payload = parseJwtPayload(token);
      if (payload) {
        const id = fromPayload(payload);
        if (id) return id;
      }
    }
    const emailHeader = request.headers.get("Cf-Access-Authenticated-User-Email");
    if (emailHeader?.trim()) return emailHeader.trim();
    if (env.DEV_IDENTITY?.trim()) return env.DEV_IDENTITY.trim();
    return "anonymous";
  }

  // Production mode: validate JWT before trusting claims.
  if (!token) return "anonymous";
  try {
    const jwks = getJwks(env.ACCESS_JWKS_URL);
    const { payload } = await jwtVerify(token, jwks, {
      audience: aud,
      algorithms: ["RS256", "ES256"],
    });
    const id = fromPayload(payload as Record<string, unknown>);
    return id ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

/**
 * Check whether the request carries a valid Cloudflare Access session.
 * Looks for explicit auth signals (JWT header, CF_Authorization cookie)
 * and verifies the JWT if present. Does not fall back to DEV_IDENTITY.
 */
export async function isSignedIn(request: Request, env: Env): Promise<boolean> {
  const hasJwt = request.headers.has("Cf-Access-Jwt-Assertion");
  const cookies = request.headers.get("Cookie") ?? "";
  const hasCookie = cookies.includes("CF_Authorization=");
  if (!hasJwt && !hasCookie) return false;
  const user = await verifyAccessJwt(request, env);
  return user !== null;
}

/**
 * Verify a Cloudflare Access JWT and extract the user email.
 *
 * Pass the AUD for the Access application protecting the current route.
 * Defaults to env.ACCESS_AUD (admin application).
 *
 * Behavior depends on whether the aud is configured:
 * - Not configured (dev/test): extracts email from unverified JWT or
 *   the Cf-Access-Authenticated-User-Email header. Returns null if
 *   neither is present.
 * - Configured (production): validates the JWT signature and audience
 *   using the JWKS endpoint. Returns null on any validation failure.
 */
export async function verifyAccessJwt(
  request: Request,
  env: Env,
  aud = env.ACCESS_AUD,
): Promise<AccessUser | null> {
  const token = extractToken(request);

  // Dev/test mode: no audience configured, skip cryptographic validation.
  if (!aud) {
    if (token) {
      const payload = parseJwtPayload(token);
      const email = payload?.email;
      return typeof email === "string" && email ? { email } : null;
    }
    const emailHeader = request.headers.get("Cf-Access-Authenticated-User-Email");
    if (emailHeader) return { email: emailHeader };
    if (env.DEV_IDENTITY) return { email: env.DEV_IDENTITY };
    return null;
  }

  // Production mode: validate JWT.
  if (!token) return null;

  try {
    const jwks = getJwks(env.ACCESS_JWKS_URL);
    const { payload } = await jwtVerify(token, jwks, {
      audience: aud,
      algorithms: ["RS256", "ES256"],
    });
    const email = payload.email as string | undefined;
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}
