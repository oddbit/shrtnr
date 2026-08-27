// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { DEV_IDENTITY_COOKIE } from "./access";
import { escHtml } from "./escape";
import type { Env } from "./types";

/**
 * Fake sign-in for local development and browser tests.
 *
 * Production never reaches this code path: Cloudflare Access fronts the admin
 * pages and the worker verifies its JWT. Locally there is no Access, and the
 * admin pages still need an identity because every write is owner-gated and
 * every settings row is keyed by it. DEV_IDENTITY in .dev.vars gives the whole
 * server one identity; these routes give each browser its own, so a second
 * browser (or a second Playwright context) can act as a second owner.
 *
 * Both routes answer 404 whenever ACCESS_AUD is set, so a deployment carrying
 * the code exposes nothing.
 */

/** Anything a cookie can carry without a parser tripping on it, capped at a DNS-length email. */
const IDENTITY_MAX_LENGTH = 254;
const IDENTITY_PATTERN = /^[^\s;\x00-\x1f\x7f]+$/;

function isDevMode(env: Env): boolean {
  return !env.ACCESS_AUD;
}

/** Same-origin path only. Anything that could leave the origin falls back to the dashboard. */
function safeReturnPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  return "/_/admin/dashboard";
}

function cookieHeader(value: string | null): string {
  // No Secure flag: local dev serves plain http on localhost, where a Secure
  // cookie would never be sent back.
  return value === null
    ? `${DEV_IDENTITY_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    : `${DEV_IDENTITY_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
}

function loginForm(): Response {
  // Dev tooling, not an admin page: no layout, no i18n, no client script.
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>shrtnr dev login</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222}
label{display:block;margin-bottom:.5rem}input{width:100%;padding:.5rem;font:inherit;margin-bottom:1rem}
button{padding:.5rem 1rem;font:inherit}code{background:#eee;padding:0 .25rem}</style></head>
<body><h1>Dev login</h1>
<p>Pick the identity this browser acts as. Links you create belong to it, and owner-gated actions check against it. Production is protected by Cloudflare Access and never serves this page.</p>
<form method="get" action="/_/dev/login">
<label for="as">Identity (email or any id)</label>
<input id="as" name="as" type="text" placeholder="you@example.com" required autofocus>
<button type="submit">Sign in</button>
</form>
<p>Sign out again at <code>/_/dev/logout</code>.</p></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function handleDevLogin(request: Request, env: Env): Response {
  if (!isDevMode(env)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const as = url.searchParams.get("as");
  if (as === null) return loginForm();
  const identity = as.trim();
  if (!identity || identity.length > IDENTITY_MAX_LENGTH || !IDENTITY_PATTERN.test(identity)) {
    return new Response(
      `Invalid identity ${JSON.stringify(escHtml(as))}: no whitespace, no semicolons, at most ${IDENTITY_MAX_LENGTH} characters.`,
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  return new Response(null, {
    status: 302,
    headers: { Location: safeReturnPath(url.searchParams.get("to")), "Set-Cookie": cookieHeader(identity) },
  });
}

export function handleDevLogout(_request: Request, env: Env): Response {
  if (!isDevMode(env)) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": cookieHeader(null) } });
}
