// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";
import { logUnhandledError, unhandledErrorResponse } from "../../unhandled";

const req = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://shrtnr.test${path}`, { method: "POST", headers });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logUnhandledError", () => {
  it("writes one JSON object with the request path, method and the error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnhandledError(new TypeError("boom"), req("/_/api/links"));
    expect(spy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      message: "unhandled error",
      method: "POST",
      path: "/_/api/links",
      error: "boom",
      name: "TypeError",
    });
    expect(entry.stack).toContain("boom");
  });

  it("copes with a thrown non-Error value", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logUnhandledError("plain string", req("/x"));
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry.error).toBe("plain string");
  });
});

describe("unhandledErrorResponse", () => {
  it("answers API routes with the JSON error shape the SDKs parse, without the error text", async () => {
    for (const path of ["/_/api/links/1", "/_/admin/api/settings", "/_/admin/w/dashboard.kpis"]) {
      const res = unhandledErrorResponse(req(path));
      expect(res.status, path).toBe(500);
      expect(res.headers.get("Content-Type"), path).toContain("application/json");
      expect(res.headers.get("Cache-Control"), path).toBe("no-store");
      expect(await res.json(), path).toEqual({ error: "Internal server error" });
    }
  });

  it("answers a JSON-accepting client on any route with JSON", async () => {
    const res = unhandledErrorResponse(req("/anything", { Accept: "application/json" }));
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("answers pages with plain text", async () => {
    const res = unhandledErrorResponse(req("/_/admin/dashboard", { Accept: "text/html" }));
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toBe("Internal server error");
  });
});
