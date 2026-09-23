// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { jwtVerify, createRemoteJWKSet, jwksCache, type JWKSCacheInput } from "jose";
import type { Env } from "./types";

export type AccessUser = {
  email: string;
};

/*
 * The fetched key set is shared across requests as plain data, keyed by
 * JWKS URL, so the certificates download once per isolate rather than on
 * every request. The resolver itself is created per request: a shared
 * RemoteJWKSet would also share its in-flight fetch promise, and a request
 * that awaits I/O started by another request fails in Workers with
 * "Cannot perform I/O on behalf of a different request". jose fills the
 * cache object in place after each fetch and reads it on the next call.
 */
const jwksCaches = new Map<string, JWKSCacheInput>();

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  let cache = jwksCaches.get(jwksUrl);
  if (!cache) {
    cache = {};
    jwksCaches.set(jwksUrl, cache);
  }
  return createRemoteJWKSet(new URL(jwksUrl), { [jwksCache]: cache });
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
 * Whether this Worker runs as a local development or test server, where no
 * Cloudflare Access sits in front of it and the identity comes from the
 * dev_identity cookie, DEV_IDENTITY or a hand-written header.
 *
 * Dev mode is opt-in: DEV_MODE=true lives in .dev.vars and the test pools,
 * which a deploy never uploads. A missing ACCESS_AUD alone is not dev mode.
 * It is a deployment that has not finished its Access setup, and the admin
 * and MCP surfaces refuse it (src/access-required.ts) instead of trusting an
 * identity any caller can write into a request. A configured ACCESS_AUD
 * always wins over DEV_MODE.
 *
 * Callers gate on this before reaching the unverified branch of
 * extractIdentity() and verifyAccessJwt(), which runs whenever the audience
 * they are given is empty.
 */
export function isDevMode(env: Env): boolean {
  return env.DEV_MODE === "true" && !env.ACCESS_AUD;
}

/**
 * Name of the cookie that carries a fake identity in dev mode. Set by
 * /_/dev/login, cleared by /_/dev/logout, read only in dev mode.
 */
export const DEV_IDENTITY_COOKIE = "dev_identity";

/**
 * The dev-mode identity a browser chose through /_/dev/login. DEV_IDENTITY is
 * one identity for the whole server; the cookie is one per browser session, so
 * two browsers (or two Playwright contexts) can act as two owners against the
 * same dev instance. Callers must check for dev mode first: this reads the
 * cookie without asking whether it may be trusted.
 */
function devIdentityFromCookie(request: Request): string | null {
  const cookies = request.headers.get("Cookie") ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${DEV_IDENTITY_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value || null;
  } catch {
    return null;
  }
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
 * With an empty aud, reads from an unverified JWT or the
 * Cf-Access-Authenticated-User-Email header, so callers reach that branch
 * only in dev mode (see isDevMode). With an aud, reads from the verified JWT
 * payload.
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
    const devCookie = devIdentityFromCookie(request);
    if (devCookie) return devCookie;
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
 * and verifies the JWT if present. Does not fall back to DEV_IDENTITY: that
 * would sign every visitor in and hide the landing page from local dev. The
 * dev_identity cookie does count as a session in dev mode, since the visitor
 * chose it through /_/dev/login the way a real visitor chooses to log in.
 */
export async function isSignedIn(request: Request, env: Env): Promise<boolean> {
  if (!env.ACCESS_AUD && devIdentityFromCookie(request)) return true;
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
 *   neither is present. Callers reach this only in dev mode (see isDevMode).
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
    const devCookie = devIdentityFromCookie(request);
    if (devCookie) return { email: devCookie };
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
