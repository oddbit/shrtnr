// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "../../api/hono-env";
import {
  answersJson,
  logUnhandledError,
  negotiatedErrorFormat,
  onUnhandledError,
  unhandledErrorResponse,
} from "../../unhandled";

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
  it("answers JSON with the error shape the SDKs parse, without the error text", async () => {
    const res = unhandledErrorResponse("json");
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });

  it("answers text as plain text", async () => {
    const res = unhandledErrorResponse("text");
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toBe("Internal server error");
  });
});

describe("negotiatedErrorFormat", () => {
  it("picks JSON only when the client says it parses JSON", () => {
    expect(negotiatedErrorFormat(req("/anything", { Accept: "application/json" }))).toBe("json");
    expect(negotiatedErrorFormat(req("/anything", { Accept: "text/html" }))).toBe("text");
    expect(negotiatedErrorFormat(req("/anything"))).toBe("text");
  });
});

describe("onUnhandledError on a Hono app", () => {
  // Mirrors src/index.tsx: the JSON groups are declared beside their mounts
  // with answersJson; pages carry no declaration.
  function build() {
    const app = new Hono<HonoEnv>();
    app.use("/api/*", answersJson);
    app.get("/api/boom", () => {
      throw new TypeError("boom");
    });
    app.get("/api/teapot", () => {
      throw new HTTPException(418, { message: "short and stout" });
    });
    app.get("/page/boom", () => {
      throw new TypeError("boom");
    });
    app.onError(onUnhandledError);
    return app;
  }

  it("answers a declared JSON route with JSON whatever Accept it sent, and logs once", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await build().request("/api/boom", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({ path: "/api/boom", error: "boom" });
  });

  it("answers an undeclared route by the Accept header", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page = await build().request("/page/boom", { headers: { Accept: "text/html" } });
    expect(page.headers.get("Content-Type")).toContain("text/plain");
    const client = await build().request("/page/boom", { headers: { Accept: "application/json" } });
    expect(client.headers.get("Content-Type")).toContain("application/json");
  });

  it("lets an HTTPException answer for itself", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await build().request("/api/teapot");
    expect(res.status).toBe(418);
    expect(await res.text()).toBe("short and stout");
    expect(spy).not.toHaveBeenCalled();
  });
});
