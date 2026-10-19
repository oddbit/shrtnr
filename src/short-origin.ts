// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Env } from "./types";

/**
 * The origin short URLs are built from.
 *
 * The copy button, the QR modal and the QR endpoint used to derive it from
 * the request, so the URL a user copied followed whichever host they had
 * opened the admin on. A deployment that answers on several domains (a
 * workers.dev URL, a custom domain, a second brand's domain) then hands out
 * whichever one the operator happened to be using. SHORT_ORIGIN pins it.
 *
 * Unset is the default and keeps the request origin, so a deployment that
 * never sets it behaves exactly as before. A value that is not a bare http(s)
 * origin is ignored in favor of the request origin: a typo must not mint
 * links that point nowhere.
 */

/**
 * Reduce a configured value to an origin, or null when it is not one.
 *
 * A bare host is how a domain is normally written and a URL needs a scheme,
 * so https is supplied when none is given. http stays available for a
 * deployment reached over plain http on a local network.
 *
 * A path is refused rather than trimmed: short links live at the root (the
 * catch-all route is /:slug), so a path prefix would name an address nothing
 * serves. Credentials, a query string and a fragment have no meaning here.
 */
export function normalizeShortOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;

  // origin is the normalization: it lowercases the host and drops a default port.
  return parsed.origin;
}

/**
 * Every value already resolved in this isolate, keyed by the raw string.
 *
 * An isolate's environment never changes, so one parse per value is enough for
 * every page render and QR request that follows. A null records a value that is
 * not a bare origin: caching the failure too is what keeps a repeated typo to
 * one warning and keeps `new URL` off the request path.
 */
const resolved = new Map<string, string | null>();

/** Whether a non-string binding has been reported, so it warns once per isolate. */
let warnedNonString = false;

/**
 * The origin SHORT_ORIGIN pins, or null when it is unset, blank or unusable.
 *
 * Anything that is not a string counts as unset. `wrangler`'s `vars` and the
 * dashboard accept JSON values, and a cosmetic setting must not answer every
 * admin page and both QR routes with a TypeError: the caller falls back to the
 * origin it already has, which for a request is the request's own.
 */
export function configuredShortOrigin(env: Env): string | null {
  const value: unknown = env.SHORT_ORIGIN;

  if (typeof value !== "string") {
    if (value !== undefined && value !== null && !warnedNonString) {
      warnedNonString = true;
      console.warn(`SHORT_ORIGIN must be a string and is ignored: ${JSON.stringify(value)}`);
    }
    return null;
  }

  const raw = value.trim();
  if (!raw) return null;

  const cached = resolved.get(raw);
  if (cached !== undefined) return cached;

  const normalized = normalizeShortOrigin(raw);
  if (!normalized) {
    console.warn(`SHORT_ORIGIN is not a bare http(s) origin and is ignored: ${JSON.stringify(raw)}`);
  }
  resolved.set(raw, normalized);
  return normalized;
}

/**
 * The origin to build short URLs from for this request. Pass the request URL:
 * its origin is both the fallback and the answer when the variable is unset.
 */
export function resolveShortOrigin(env: Env, requestUrl: string | URL): string {
  return configuredShortOrigin(env) ?? new URL(requestUrl).origin;
}
