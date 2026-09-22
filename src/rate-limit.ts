// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Fixed-window request counter held in isolate memory.
 *
 * Meant for low-value endpoints such as /_/setup, where the aim is to blunt
 * a scripted hammering, not to meter a customer. Each isolate counts on its
 * own, so the effective ceiling across the edge is higher than the number
 * given here, and a new isolate starts from zero. That is accepted: the
 * endpoint it guards is idempotent and read-mostly, and a binding-backed
 * limiter would be one more resource for a one-click deploy to provision.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the window resets; what a 429 puts in Retry-After. */
  retryAfter: number;
}

export function checkRateLimit(key: string, limit: number, periodSeconds: number, now = Date.now()): RateLimitDecision {
  let window = windows.get(key);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + periodSeconds * 1000 };
    windows.set(key, window);
  }
  window.count++;
  const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
  return { allowed: window.count <= limit, retryAfter };
}

/** Client key for a request: the connecting IP as Cloudflare reports it. */
export function clientKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";
}

export function rateLimitedResponse(retryAfter: number): Response {
  return Response.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  );
}

/** Test hook: forget every window. */
export function resetRateLimits(): void {
  windows.clear();
}
