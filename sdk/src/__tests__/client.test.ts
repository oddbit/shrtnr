// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShrtnrClient } from "../public-client";
import { ShrtnrError } from "../errors";

const BASE = "https://shrtnr.test";
let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetch(status: number, body: unknown) {
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

// ---- Auth headers ----

describe("Auth headers", () => {
  it("should send Bearer header for API key auth", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    mockFetch(200, []);
    await client.listLinks();
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer sk_abc");
  });
});

// ---- Error handling ----

describe("Error handling", () => {
  it("should throw ShrtnrError on non-2xx response", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    mockFetch(404, { error: "Link not found" });
    await expect(client.getLink(999)).rejects.toThrow(ShrtnrError);
  });

  it("should include status and message from error response", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    mockFetch(409, { error: "Slug already exists" });
    try {
      await client.addCustomSlug(1, "taken");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(409);
      expect((e as ShrtnrError).message).toBe("Slug already exists");
    }
  });

  it("should throw ShrtnrError on 401 unauthorized", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "bad" } });
    mockFetch(401, { error: "Unauthorized" });
    await expect(client.listLinks()).rejects.toThrow(ShrtnrError);
  });
});

// ---- Health ----

describe("health", () => {
  it("should return health status", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    mockFetch(200, { status: "ok", version: "0.2.0", timestamp: 1000 });
    const result = await client.health();
    expect(result.status).toBe("ok");
    expect(result.version).toBe("0.2.0");
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/health");
  });
});

// ---- Links (scoped) ----

describe("createLink", () => {
  it("should POST to /_/api/links with body", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    const link = { id: 1, url: "https://example.com", slugs: [], total_clicks: 0 };
    mockFetch(201, link);
    const result = await client.createLink({ url: "https://example.com", label: "Test" });
    expect(result.id).toBe(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ url: "https://example.com", label: "Test" });
  });
});

describe("listLinks", () => {
  it("should GET /_/api/links", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    mockFetch(200, []);
    const result = await client.listLinks();
    expect(result).toEqual([]);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links");
    expect(init.method).toBe("GET");
  });
});

describe("getLinkAnalytics", () => {
  it("should GET /_/api/links/:id/analytics", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } });
    const stats = { total_clicks: 42, countries: [], referrers: [], devices: [], browsers: [], clicks_over_time: [] };
    mockFetch(200, stats);
    const result = await client.getLinkAnalytics(5);
    expect(result.total_clicks).toBe(42);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links/5/analytics");
  });
});

// ---- Admin-only methods ----

describe("getLink", () => {
  it("should GET /_/api/links/:id", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_test" } });
    const link = { id: 3, url: "https://example.com", slugs: [], total_clicks: 0 };
    mockFetch(200, link);
    const result = await client.getLink(3);
    expect(result.id).toBe(3);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links/3");
  });
});

describe("updateLink", () => {
  it("should PUT /_/api/links/:id", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_test" } });
    const link = { id: 1, url: "https://new.com", slugs: [], total_clicks: 0 };
    mockFetch(200, link);
    await client.updateLink(1, { url: "https://new.com" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links/1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ url: "https://new.com" });
  });
});

describe("disableLink", () => {
  it("should POST /_/api/links/:id/disable", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_test" } });
    mockFetch(200, { id: 1 });
    await client.disableLink(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links/1/disable");
    expect(init.method).toBe("POST");
  });
});

describe("addCustomSlug", () => {
  it("should POST /_/api/links/:id/slugs", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_test" } });
    mockFetch(201, { id: 10, slug: "custom", is_custom: 1 });
    const result = await client.addCustomSlug(1, "custom");
    expect(result.slug).toBe("custom");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links/1/slugs");
    expect(JSON.parse(init.body)).toEqual({ slug: "custom" });
  });
});

describe("getLinkBySlug", () => {
  it("should GET /_/api/slugs/:slug", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_test" } });
    const link = { id: 7, url: "https://example.com", slugs: [{ slug: "find-me" }], total_clicks: 0 };
    mockFetch(200, link);
    const result = await client.getLinkBySlug("find-me");
    expect(result.id).toBe(7);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/slugs/find-me");
    expect(init.method).toBe("GET");
  });

  it("should encode slug in URL", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_test" } });
    mockFetch(200, {});
    await client.getLinkBySlug("foo/bar");
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/slugs/foo%2Fbar");
  });
});

// ---- Base URL handling ----

describe("Base URL normalization", () => {
  it("should strip trailing slash from baseUrl", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE + "/", auth: { apiKey: "sk_abc" } });
    mockFetch(200, []);
    await client.listLinks();
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(BASE + "/_/api/links");
  });
});
