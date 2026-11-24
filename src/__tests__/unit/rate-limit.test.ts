// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitWindowCount, resetRateLimits } from "../../rate-limit";

beforeEach(resetRateLimits);

describe("checkRateLimit", () => {
  it("allows up to the limit inside one window and refuses the next", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(checkRateLimit("ip", 3, 60, now).allowed).toBe(true);
    const refused = checkRateLimit("ip", 3, 60, now + 1000);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfter).toBe(59);
  });

  it("starts a fresh window once the period has passed", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) checkRateLimit("ip", 3, 60, now);
    expect(checkRateLimit("ip", 3, 60, now + 60_000).allowed).toBe(true);
  });

  it("counts each key on its own", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) checkRateLimit("a", 3, 60, now);
    expect(checkRateLimit("b", 3, 60, now).allowed).toBe(true);
  });

  // The key is the caller's IP. A caller that rotates addresses adds one
  // window per request, and nothing ever removed them, so the map grew for as
  // long as the isolate lived.
  it("does not keep expired windows forever", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5000; i++) checkRateLimit(`ip-${i}`, 3, 60, start);
    // Every window above has expired by now.
    const later = start + 61_000;
    for (let i = 0; i < 10; i++) checkRateLimit(`late-${i}`, 3, 60, later);
    expect(rateLimitWindowCount()).toBeLessThanOrEqual(10);
  });

  it("keeps a live window through a sweep, so the sweep cannot reset a limit", () => {
    const start = 1_000_000;
    for (let i = 0; i < 2000; i++) checkRateLimit(`old-${i}`, 3, 60, start);
    const later = start + 61_000;
    for (let i = 0; i < 4; i++) checkRateLimit("hammer", 3, 60, later);
    // A new key triggers the sweep; the hammering key stays refused.
    checkRateLimit("newcomer", 3, 60, later + 1);
    expect(checkRateLimit("hammer", 3, 60, later + 2).allowed).toBe(false);
  });

  // Inside one period nothing has expired, so a sweep frees nothing. A caller
  // that rotates through more addresses than the map should hold still has to
  // meet a ceiling.
  it("holds a bounded number of windows through a flood inside one period", () => {
    const now = 1_000_000;
    for (let i = 0; i < 50_000; i++) checkRateLimit(`flood-${i}`, 3, 60, now + (i % 1000));
    expect(rateLimitWindowCount()).toBeLessThanOrEqual(8192);
  });

  it("drops the oldest windows first, so a recently refused caller stays refused", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20_000; i++) checkRateLimit(`before-${i}`, 3, 60, now);
    for (let i = 0; i < 4; i++) checkRateLimit("hammer", 3, 60, now + 1);
    for (let i = 0; i < 2000; i++) checkRateLimit(`after-${i}`, 3, 60, now + 2);
    expect(checkRateLimit("hammer", 3, 60, now + 3).allowed).toBe(false);
  });

  it("counts a caller whose window was renewed as recent", () => {
    const start = 1_000_000;
    checkRateLimit("regular", 3, 60, start);
    // The first window has expired; the caller comes back and hits the limit.
    const later = start + 61_000;
    for (let i = 0; i < 4; i++) checkRateLimit("regular", 3, 60, later);
    for (let i = 0; i < 8000; i++) checkRateLimit(`crowd-${i}`, 3, 60, later + 1);
    expect(checkRateLimit("regular", 3, 60, later + 2).allowed).toBe(false);
  });
});
