// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Privacy-respecting visitor fingerprinting.
//
// Model (same approach Plausible, Fathom, and Simple Analytics use):
//   daily_salt = HMAC-SHA256(server_secret, "YYYY-MM-DD")   (UTC date)
//   visitor_fp = SHA-256(ip + "|" + user_agent + "|" + daily_salt)
//
// The daily salt rotation means a given visitor produces a different
// fingerprint on each UTC day, so IDs cannot be correlated across days.
// No raw IP is ever stored.

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, "0");
  }
  return out;
}

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Computes the per-day salt. If `serverSecret` is missing, falls back to a
 * fixed per-day string so fingerprinting still works in development; real
 * deployments should set FP_SALT for unpredictability.
 */
export async function dailySaltFor(date: Date, serverSecret?: string | null): Promise<string> {
  const dateKey = utcDateKey(date);
  if (!serverSecret) {
    // Fallback: deterministic per-day, still rotates daily.
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`shrtnr-default:${dateKey}`));
    return toHex(digest);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serverSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dateKey));
  return toHex(sig);
}

/**
 * Returns a stable per-day fingerprint for the visitor. Returns null when
 * both IP and UA are missing (no signal to hash).
 */
export async function computeVisitorFingerprint(
  ip: string | null | undefined,
  userAgent: string | null | undefined,
  serverSecret: string | null | undefined,
  now: Date = new Date(),
): Promise<string | null> {
  const ipStr = (ip ?? "").trim();
  const uaStr = (userAgent ?? "").trim();
  if (ipStr.length === 0 && uaStr.length === 0) return null;

  const salt = await dailySaltFor(now, serverSecret ?? null);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${ipStr}|${uaStr}|${salt}`),
  );
  return toHex(digest);
}
