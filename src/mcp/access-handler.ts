// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Cloudflare Access OAuth handler for MCP authentication.
// Adapted from Cloudflare's remote-mcp-cf-access demo.

import { Buffer } from "node:buffer";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { Env } from "../types";
import type { Props } from "./oauth-types";
import {
  addApprovedClient,
  createOAuthState,
  fetchUpstreamAuthToken,
  generateCSRFProtection,
  getUpstreamAuthorizeUrl,
  isClientApproved,
  OAuthError,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils";

type EnvWithOAuth = Env & { OAUTH_PROVIDER: OAuthHelpers };

export async function handleAccessRequest(
  request: Request,
  env: EnvWithOAuth,
  _ctx: ExecutionContext,
): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);

  // ---- GET /_/auth/authorize: show approval dialog or skip if already approved ----

  if (request.method === "GET" && pathname === "/_/auth/authorize") {
    const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    const { clientId } = oauthReqInfo;
    if (!clientId) {
      return new Response("Invalid request", { status: 400 });
    }

    if (await isClientApproved(request, clientId, env.COOKIE_ENCRYPTION_KEY)) {
      const { stateToken } = await createOAuthState(oauthReqInfo, env.OAUTH_KV);
      return redirectToAccess(request, env, stateToken);
    }

    const { token: csrfToken, setCookie } = generateCSRFProtection();

    return renderApprovalDialog(request, {
      client: await env.OAUTH_PROVIDER.lookupClient(clientId),
      csrfToken,
      server: {
        name: "shrtnr",
        description: "URL shortener with click analytics, admin dashboard, and AI integration.",
      },
      setCookie,
      state: { oauthReqInfo },
    });
  }

  // ---- POST /_/auth/authorize: validate CSRF, redirect to CF Access ----

  if (request.method === "POST" && pathname === "/_/auth/authorize") {
    try {
      const formData = await request.formData();
      validateCSRFToken(formData, request);

      const encodedState = formData.get("state");
      if (!encodedState || typeof encodedState !== "string") {
        return new Response("Missing state in form data", { status: 400 });
      }

      let state: { oauthReqInfo?: AuthRequest };
      try {
        state = JSON.parse(atob(encodedState));
      } catch {
        return new Response("Invalid state data", { status: 400 });
      }

      if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
        return new Response("Invalid request", { status: 400 });
      }

      const approvedClientCookie = await addApprovedClient(
        request,
        state.oauthReqInfo.clientId,
        env.COOKIE_ENCRYPTION_KEY,
      );

      const { stateToken } = await createOAuthState(state.oauthReqInfo, env.OAUTH_KV);

      return redirectToAccess(request, env, stateToken, {
        "Set-Cookie": approvedClientCookie,
      });
    } catch (error: unknown) {
      if (error instanceof OAuthError) return error.toResponse();
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(`Internal server error: ${message}`, { status: 500 });
    }
  }

  // ---- GET /_/auth/callback: exchange code for token, verify JWT, complete auth ----

  if (request.method === "GET" && pathname === "/_/auth/callback") {
    let oauthReqInfo: AuthRequest;

    try {
      const result = await validateOAuthState(request, env.OAUTH_KV);
      oauthReqInfo = result.oauthReqInfo;
    } catch (error: unknown) {
      if (error instanceof OAuthError) return error.toResponse();
      return new Response("Internal server error", { status: 500 });
    }

    if (!oauthReqInfo.clientId) {
      return new Response("Invalid OAuth request data", { status: 400 });
    }

    const [accessToken, idToken, errResponse] = await fetchUpstreamAuthToken({
      client_id: env.ACCESS_CLIENT_ID,
      client_secret: env.ACCESS_CLIENT_SECRET,
      code: searchParams.get("code") ?? undefined,
      redirect_uri: new URL("/_/auth/callback", request.url).href,
      upstream_url: env.ACCESS_TOKEN_URL,
    });
    if (errResponse) return errResponse;

    const idTokenClaims = await verifyToken(env, idToken);
    const user = {
      email: idTokenClaims.email as string,
      name: (idTokenClaims.name as string) || (idTokenClaims.email as string),
      sub: idTokenClaims.sub as string,
    };

    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      metadata: { label: user.name },
      props: {
        accessToken,
        email: user.email,
        login: user.sub,
        name: user.name,
      } as Props,
      request: oauthReqInfo,
      scope: oauthReqInfo.scope,
      userId: user.sub,
    });

    return Response.redirect(redirectTo, 302);
  }

  return new Response("Not Found", { status: 404 });
}

// ---- Internal helpers ----

function redirectToAccess(
  request: Request,
  env: Env,
  stateToken: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(null, {
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        client_id: env.ACCESS_CLIENT_ID,
        redirect_uri: new URL("/_/auth/callback", request.url).href,
        scope: "openid email profile",
        state: stateToken,
        upstream_url: env.ACCESS_AUTHORIZATION_URL,
      }),
    },
    status: 302,
  });
}

async function fetchAccessPublicKey(env: Env, kid: string): Promise<CryptoKey> {
  if (!env.ACCESS_JWKS_URL) throw new Error("ACCESS_JWKS_URL not configured");

  const resp = await fetch(env.ACCESS_JWKS_URL);
  const keys = (await resp.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const jwk = keys.keys.find((key) => key.kid === kid);
  if (!jwk) throw new Error(`No matching key found for kid: ${kid}`);

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );
}

function parseJWT(token: string): {
  data: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
} {
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) throw new Error("Token must have 3 parts");

  return {
    data: `${tokenParts[0]}.${tokenParts[1]}`,
    header: JSON.parse(Buffer.from(tokenParts[0], "base64url").toString()),
    payload: JSON.parse(Buffer.from(tokenParts[1], "base64url").toString()),
    signature: tokenParts[2],
  };
}

async function verifyToken(env: Env, token: string): Promise<Record<string, unknown>> {
  const jwt = parseJWT(token);
  const key = await fetchAccessPublicKey(env, jwt.header.kid as string);

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    Buffer.from(jwt.signature, "base64url"),
    Buffer.from(jwt.data),
  );

  if (!verified) throw new Error("Failed to verify token");

  const claims = jwt.payload;
  const now = Math.floor(Date.now() / 1000);
  if ((claims.exp as number) < now) throw new Error("Expired token");

  return claims;
}
