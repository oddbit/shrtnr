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
 * Extract email from an unverified JWT payload (dev/test mode only).
 * Returns null if the token is malformed or missing an email claim.
 */
function extractUnverifiedEmail(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.email === "string" && payload.email) return payload.email;
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify a Cloudflare Access JWT and extract the user email.
 *
 * Behavior depends on whether ACCESS_AUD is configured:
 * - Not configured (dev/test): extracts email from unverified JWT or
 *   the Cf-Access-Authenticated-User-Email header. Returns null if
 *   neither is present.
 * - Configured (production): validates the JWT signature and audience
 *   using the JWKS endpoint. Returns null on any validation failure.
 */
export async function verifyAccessJwt(
  request: Request,
  env: Env,
): Promise<AccessUser | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  const aud = env.ACCESS_AUD;

  // Dev/test mode: no audience configured, skip cryptographic validation.
  if (!aud) {
    if (token) {
      const email = extractUnverifiedEmail(token);
      return email ? { email } : null;
    }
    const emailHeader = request.headers.get("Cf-Access-Authenticated-User-Email");
    return emailHeader ? { email: emailHeader } : null;
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
