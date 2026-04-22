// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Canonical SDK unit test layout — MUST stay structurally identical to
// sdk/python/tests/test_client.py and sdk/dart/test/client_test.dart:
// same describe/group blocks, same order, same test count, same names.
// When adding a new public method, add a matching test here AND in the
// other two SDKs. See CLAUDE.md "SDK parity".

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShrtnrClient } from "../public-client";
import { ShrtnrError } from "../errors";

const BASE = "https://shrtnr.test";
const API_KEY = "sk_abc";
let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  fetchSpy.mockResolvedValueOnce(
    new Response(contentType.startsWith("application/json") ? JSON.stringify(body) : String(body), {
      status,
      headers: { "Content-Type": contentType },
    }),
  );
}

function client(): ShrtnrClient {
  return new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: API_KEY } });
}

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

// ---- 1. Auth headers ----

describe("Auth headers", () => {
  it("sends Bearer + X-Client: sdk on every request", async () => {
    mockFetch(200, []);
    await client().listLinks();
    const { init } = lastCall();
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
    expect(headers["X-Client"]).toBe("sdk");
  });
});

// ---- 2. Error handling ----

describe("Error handling", () => {
  it("throws ShrtnrError on non-2xx response", async () => {
    mockFetch(404, { error: "Link not found" });
    await expect(client().getLink(999)).rejects.toBeInstanceOf(ShrtnrError);
  });

  it("includes status and message from error body", async () => {
    mockFetch(409, { error: "Slug already exists" });
    try {
      await client().addCustomSlug(1, "taken");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(409);
      expect((e as ShrtnrError).message).toBe("Slug already exists");
    }
  });

  it("throws ShrtnrError on 401 unauthorized", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(client().listLinks()).rejects.toBeInstanceOf(ShrtnrError);
  });
});

// ---- 3. health ----

describe("health", () => {
  it("GETs /_/health", async () => {
    mockFetch(200, { status: "ok", version: "0.1.0", timestamp: 1000 });
    const result = await client().health();
    expect(result.status).toBe("ok");
    expect(lastCall().url).toBe(BASE + "/_/health");
  });
});

// ---- 4. createLink ----

describe("createLink", () => {
  it("POSTs /_/api/links with body", async () => {
    mockFetch(201, { id: 1, url: "https://example.com", slugs: [], total_clicks: 0 });
    await client().createLink({ url: "https://example.com", label: "L" });
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com", label: "L" });
  });
});

// ---- 5. listLinks ----

describe("listLinks", () => {
  it("GETs /_/api/links", async () => {
    mockFetch(200, []);
    await client().listLinks();
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links");
    expect(init.method).toBe("GET");
  });
});

// ---- 6. getLink ----

describe("getLink", () => {
  it("GETs /_/api/links/:id", async () => {
    mockFetch(200, { id: 3, url: "https://example.com", slugs: [], total_clicks: 0 });
    await client().getLink(3);
    expect(lastCall().url).toBe(BASE + "/_/api/links/3");
  });
});

// ---- 7. updateLink ----

describe("updateLink", () => {
  it("PUTs /_/api/links/:id with patch body", async () => {
    mockFetch(200, { id: 1, url: "https://new.com", slugs: [], total_clicks: 0 });
    await client().updateLink(1, { url: "https://new.com" });
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://new.com" });
  });
});

// ---- 8. disableLink ----

describe("disableLink", () => {
  it("POSTs /_/api/links/:id/disable", async () => {
    mockFetch(200, { id: 1 });
    await client().disableLink(1);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1/disable");
    expect(init.method).toBe("POST");
  });
});

// ---- 9. enableLink ----

describe("enableLink", () => {
  it("POSTs /_/api/links/:id/enable", async () => {
    mockFetch(200, { id: 1 });
    await client().enableLink(1);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1/enable");
    expect(init.method).toBe("POST");
  });
});

// ---- 10. deleteLink ----

describe("deleteLink", () => {
  it("DELETEs /_/api/links/:id", async () => {
    mockFetch(200, { deleted: true });
    await client().deleteLink(1);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1");
    expect(init.method).toBe("DELETE");
  });
});

// ---- 11. listLinksByOwner ----

describe("listLinksByOwner", () => {
  it("GETs /_/api/links?owner=... with URL-encoded owner", async () => {
    mockFetch(200, []);
    await client().listLinksByOwner("user@example.com");
    expect(lastCall().url).toBe(BASE + "/_/api/links?owner=user%40example.com");
  });
});

// ---- 12. addCustomSlug ----

describe("addCustomSlug", () => {
  it("POSTs /_/api/links/:id/slugs", async () => {
    mockFetch(201, { slug: "custom", is_custom: 1 });
    await client().addCustomSlug(1, "custom");
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1/slugs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ slug: "custom" });
  });
});

// ---- 13. disableSlug ----

describe("disableSlug", () => {
  it("POSTs /_/api/links/:id/slugs/:slug/disable", async () => {
    mockFetch(200, { slug: "abc" });
    await client().disableSlug(1, "abc");
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1/slugs/abc/disable");
    expect(init.method).toBe("POST");
  });
});

// ---- 14. enableSlug ----

describe("enableSlug", () => {
  it("POSTs /_/api/links/:id/slugs/:slug/enable", async () => {
    mockFetch(200, { slug: "abc" });
    await client().enableSlug(1, "abc");
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1/slugs/abc/enable");
    expect(init.method).toBe("POST");
  });
});

// ---- 15. removeSlug ----

describe("removeSlug", () => {
  it("DELETEs /_/api/links/:id/slugs/:slug", async () => {
    mockFetch(200, { removed: true });
    await client().removeSlug(1, "abc");
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/links/1/slugs/abc");
    expect(init.method).toBe("DELETE");
  });
});

// ---- 16. getLinkBySlug ----

describe("getLinkBySlug", () => {
  it("GETs /_/api/slugs/:slug", async () => {
    mockFetch(200, { id: 7, url: "https://example.com", slugs: [], total_clicks: 0 });
    await client().getLinkBySlug("find-me");
    expect(lastCall().url).toBe(BASE + "/_/api/slugs/find-me");
  });

  it("URL-encodes slugs with reserved characters", async () => {
    mockFetch(200, { id: 7, slugs: [], total_clicks: 0 });
    await client().getLinkBySlug("foo/bar");
    expect(lastCall().url).toBe(BASE + "/_/api/slugs/foo%2Fbar");
  });
});

// ---- 17. getLinkAnalytics ----

describe("getLinkAnalytics", () => {
  it("GETs /_/api/links/:id/analytics", async () => {
    mockFetch(200, {
      total_clicks: 42,
      countries: [],
      referrers: [],
      referrer_hosts: [],
      devices: [],
      os: [],
      browsers: [],
      link_modes: [],
      channels: [],
      clicks_over_time: [],
      slug_clicks: [],
    });
    const result = await client().getLinkAnalytics(5);
    expect(result.total_clicks).toBe(42);
    expect(lastCall().url).toBe(BASE + "/_/api/links/5/analytics");
  });
});

// ---- 18. getLinkQR ----

describe("getLinkQR", () => {
  it("GETs /_/api/links/:id/qr and returns the SVG body", async () => {
    mockFetch(200, "<svg/>", "image/svg+xml");
    const svg = await client().getLinkQR(5);
    expect(svg).toMatch(/<svg/);
    expect(lastCall().url).toBe(BASE + "/_/api/links/5/qr");
  });

  it("URL-encodes the optional slug query param", async () => {
    mockFetch(200, "<svg/>", "image/svg+xml");
    await client().getLinkQR(5, "foo/bar");
    expect(lastCall().url).toBe(BASE + "/_/api/links/5/qr?slug=foo%2Fbar");
  });
});

// ---- 19. createBundle ----

describe("createBundle", () => {
  it("POSTs /_/api/bundles with body", async () => {
    mockFetch(201, { id: 1, name: "B", accent: "orange" });
    await client().createBundle({ name: "B", accent: "blue" });
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "B", accent: "blue" });
  });
});

// ---- 20. listBundles ----

describe("listBundles", () => {
  it("GETs /_/api/bundles by default", async () => {
    mockFetch(200, []);
    await client().listBundles();
    expect(lastCall().url).toBe(BASE + "/_/api/bundles");
  });

  it("adds ?archived=all when archived: true", async () => {
    mockFetch(200, []);
    await client().listBundles({ archived: true });
    expect(lastCall().url).toBe(BASE + "/_/api/bundles?archived=all");
  });
});

// ---- 21. getBundle ----

describe("getBundle", () => {
  it("GETs /_/api/bundles/:id", async () => {
    mockFetch(200, { id: 42, name: "X", accent: "orange" });
    await client().getBundle(42);
    expect(lastCall().url).toBe(BASE + "/_/api/bundles/42");
  });
});

// ---- 22. updateBundle ----

describe("updateBundle", () => {
  it("PUTs /_/api/bundles/:id with patch body", async () => {
    mockFetch(200, { id: 42, name: "X", description: "edited", accent: "orange" });
    await client().updateBundle(42, { description: "edited" });
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles/42");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ description: "edited" });
  });
});

// ---- 23. deleteBundle ----

describe("deleteBundle", () => {
  it("DELETEs /_/api/bundles/:id", async () => {
    mockFetch(200, { deleted: true });
    await client().deleteBundle(42);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles/42");
    expect(init.method).toBe("DELETE");
  });
});

// ---- 24. archiveBundle ----

describe("archiveBundle", () => {
  it("POSTs /_/api/bundles/:id/archive", async () => {
    mockFetch(200, { id: 42, archived_at: 1 });
    await client().archiveBundle(42);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles/42/archive");
    expect(init.method).toBe("POST");
  });
});

// ---- 25. unarchiveBundle ----

describe("unarchiveBundle", () => {
  it("POSTs /_/api/bundles/:id/unarchive", async () => {
    mockFetch(200, { id: 42 });
    await client().unarchiveBundle(42);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles/42/unarchive");
    expect(init.method).toBe("POST");
  });
});

// ---- 26. getBundleAnalytics ----

describe("getBundleAnalytics", () => {
  it("GETs /_/api/bundles/:id/analytics with ?range=", async () => {
    mockFetch(200, {
      bundle: { id: 42, name: "X", accent: "orange" },
      link_count: 0,
      total_clicks: 0,
      clicked_links: 0,
      countries_reached: 0,
      timeline: { range: "7d", buckets: [], summary: {} },
      countries: [],
      devices: [],
      os: [],
      browsers: [],
      referrers: [],
      referrer_hosts: [],
      link_modes: [],
      per_link: [],
    });
    await client().getBundleAnalytics(42, "7d");
    expect(lastCall().url).toBe(BASE + "/_/api/bundles/42/analytics?range=7d");
  });
});

// ---- 27. listBundleLinks ----

describe("listBundleLinks", () => {
  it("GETs /_/api/bundles/:id/links", async () => {
    mockFetch(200, []);
    await client().listBundleLinks(42);
    expect(lastCall().url).toBe(BASE + "/_/api/bundles/42/links");
  });
});

// ---- 28. addLinkToBundle ----

describe("addLinkToBundle", () => {
  it("POSTs /_/api/bundles/:id/links with link_id", async () => {
    mockFetch(200, { added: true });
    await client().addLinkToBundle(42, 7);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles/42/links");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ link_id: 7 });
  });
});

// ---- 29. removeLinkFromBundle ----

describe("removeLinkFromBundle", () => {
  it("DELETEs /_/api/bundles/:id/links/:linkId", async () => {
    mockFetch(200, { removed: true });
    await client().removeLinkFromBundle(42, 7);
    const { url, init } = lastCall();
    expect(url).toBe(BASE + "/_/api/bundles/42/links/7");
    expect(init.method).toBe("DELETE");
  });
});

// ---- 30. listBundlesForLink ----

describe("listBundlesForLink", () => {
  it("GETs /_/api/links/:id/bundles", async () => {
    mockFetch(200, []);
    await client().listBundlesForLink(7);
    expect(lastCall().url).toBe(BASE + "/_/api/links/7/bundles");
  });
});

// ---- 31. Base URL normalization ----

describe("Base URL normalization", () => {
  it("strips trailing slashes from baseUrl", async () => {
    const c = new ShrtnrClient({ baseUrl: BASE + "/", auth: { apiKey: API_KEY } });
    mockFetch(200, []);
    await c.listLinks();
    expect(lastCall().url).toBe(BASE + "/_/api/links");
  });
});
