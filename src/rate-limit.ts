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

/**
 * The key is the caller's IP, which the caller chooses when it rotates
 * addresses, so the map needs a ceiling of its own.
 *
 * Past SWEEP_THRESHOLD windows, expired ones are swept, at most once per
 * period: inside one period nothing new has expired, and a scan on every
 * request would cost a flood more than it frees. Past MAX_WINDOWS the oldest
 * window makes room for each new one. A caller evicted that way starts a
 * fresh count, which only a caller already rotating addresses can provoke.
 */
const SWEEP_THRESHOLD = 1024;
const MAX_WINDOWS = 8192;

let nextSweepAt = 0;

function sweepExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, periodSeconds: number, now = Date.now()): RateLimitDecision {
  let window = windows.get(key);
  if (!window || window.resetAt <= now) {
    // Deleted before it is set again, so the map's insertion order stays the
    // order of window age and the eviction below takes the oldest.
    windows.delete(key);
    if (windows.size >= SWEEP_THRESHOLD && now >= nextSweepAt) {
      sweepExpired(now);
      nextSweepAt = now + periodSeconds * 1000;
    }
    while (windows.size >= MAX_WINDOWS) {
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
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

/** Test hook: how many windows the map holds. */
export function rateLimitWindowCount(): number {
  return windows.size;
}

/** Test hook: forget every window. */
export function resetRateLimits(): void {
  windows.clear();
  nextSweepAt = 0;
}
