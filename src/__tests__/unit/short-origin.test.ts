// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// SHORT_ORIGIN pins the origin every short URL is built from, so a
// deployment that answers on several domains hands out the one the operator
// chose instead of whichever host the admin was opened on. Unset keeps the
// request origin, which is what every deployment did before the variable
// existed. A value that is not a bare http(s) origin is ignored rather than
// trusted: a typo would otherwise mint links that point nowhere.
import { describe, it, expect, vi } from "vitest";
import { normalizeShortOrigin, resolveShortOrigin } from "../../short-origin";
import type { Env } from "../../types";

const REQUEST = "https://worker.account.workers.dev/_/admin/links";
const REQUEST_ORIGIN = "https://worker.account.workers.dev";

function envWith(value?: string): Env {
  return { SHORT_ORIGIN: value } as Env;
}

describe("normalizeShortOrigin", () => {
  it("accepts a full origin", () => {
    expect(normalizeShortOrigin("https://c.example")).toBe("https://c.example");
  });

  it("accepts a bare host and supplies https", () => {
    expect(normalizeShortOrigin("c.example")).toBe("https://c.example");
  });

  it("keeps an explicit http origin, for a local deployment", () => {
    expect(normalizeShortOrigin("http://localhost:8787")).toBe("http://localhost:8787");
  });

  it("lowercases the host and drops a trailing slash", () => {
    expect(normalizeShortOrigin("HTTPS://C.Example/")).toBe("https://c.example");
  });

  it("drops a default port", () => {
    expect(normalizeShortOrigin("https://c.example:443")).toBe("https://c.example");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeShortOrigin("  https://c.example  ")).toBe("https://c.example");
  });

  it("rejects a value carrying a path", () => {
    // Short links live at the root: the catch-all route is /:slug, so a path
    // prefix would name an address nothing serves.
    expect(normalizeShortOrigin("https://c.example/s")).toBeNull();
  });

  it("rejects a query string or fragment", () => {
    expect(normalizeShortOrigin("https://c.example?x=1")).toBeNull();
    expect(normalizeShortOrigin("https://c.example#x")).toBeNull();
  });

  it("rejects credentials", () => {
    expect(normalizeShortOrigin("https://user:pw@c.example")).toBeNull();
  });

  it("rejects a non-http scheme", () => {
    expect(normalizeShortOrigin("ftp://c.example")).toBeNull();
  });

  it("rejects an empty or whitespace-only value", () => {
    expect(normalizeShortOrigin("")).toBeNull();
    expect(normalizeShortOrigin("   ")).toBeNull();
  });

  it("rejects a value that is not a URL at all", () => {
    expect(normalizeShortOrigin("not a url")).toBeNull();
  });
});

describe("resolveShortOrigin", () => {
  it("falls back to the request origin when unset", () => {
    expect(resolveShortOrigin(envWith(undefined), REQUEST)).toBe(REQUEST_ORIGIN);
  });

  it("falls back to the request origin when blank", () => {
    expect(resolveShortOrigin(envWith("   "), REQUEST)).toBe(REQUEST_ORIGIN);
  });

  it("pins the configured origin", () => {
    expect(resolveShortOrigin(envWith("https://c.example"), REQUEST)).toBe("https://c.example");
  });

  it("normalizes a bare host", () => {
    expect(resolveShortOrigin(envWith("c.example"), REQUEST)).toBe("https://c.example");
  });

  it("takes a URL object as well as a string", () => {
    expect(resolveShortOrigin(envWith(undefined), new URL(REQUEST))).toBe(REQUEST_ORIGIN);
  });

  it("ignores a value that is not a bare origin and keeps the request origin", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(resolveShortOrigin(envWith("https://misconfigured.example/s"), REQUEST)).toBe(REQUEST_ORIGIN);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("warns once per misconfigured value, not once per request", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const env = envWith("https://repeated.example/path");
      resolveShortOrigin(env, REQUEST);
      resolveShortOrigin(env, REQUEST);
      resolveShortOrigin(env, REQUEST);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
