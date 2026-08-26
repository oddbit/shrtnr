// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShrtnrClient } from "../src/index";
import { ShrtnrError } from "../src/index";

const BASE = "https://shrtnr.test";
const API_KEY = "sk_abc";

let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  const bodyStr =
    contentType.startsWith("application/json") ? JSON.stringify(body) : String(body);
  fetchSpy.mockResolvedValueOnce(
    new Response(bodyStr, {
      status,
      headers: { "Content-Type": contentType },
    }),
  );
}

function client(): ShrtnrClient {
  return new ShrtnrClient({ baseUrl: BASE, apiKey: API_KEY, fetch: fetchSpy });
}

// Yields headers and a first chunk, then errors while the body is still
// streaming: the failure mode a rejected fetch() promise cannot reproduce.
function erroringBody(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("["));
      controller.error(new TypeError("connection reset"));
    },
  });
}

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

beforeEach(() => {
  fetchSpy = vi.fn();
});

// ============================================================
// 1. Auth headers
// ============================================================

describe("Auth headers", () => {
  it("sends Authorization: Bearer on every request", async () => {
    mockFetch(200, []);
    await client().links.list();
    const { init } = lastCall();
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
  });

  it("auth header appears on bundle requests too", async () => {
    mockFetch(200, []);
    await client().bundles.list();
    const { init } = lastCall();
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${API_KEY}`);
  });

  it("auth header appears on slug requests too", async () => {
    mockFetch(200, { linkId: 1, slug: "test", isCustom: 1, isPrimary: 1, clickCount: 0, createdAt: 0, disabledAt: null });
    await client().slugs.lookup("test");
    const { init } = lastCall();
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${API_KEY}`);
  });
});

// ============================================================
// 2. Error handling
// ============================================================

describe("Error handling", () => {
  it("throws ShrtnrError on 404", async () => {
    mockFetch(404, { error: "Link not found" });
    await expect(client().links.get(999)).rejects.toBeInstanceOf(ShrtnrError);
  });

  it("populates status and serverMessage from error body", async () => {
    mockFetch(409, { error: "Slug already exists" });
    try {
      await client().slugs.add(1, "taken");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(409);
      expect((e as ShrtnrError).serverMessage).toBe("Slug already exists");
    }
  });

  it("formats the error message with HTTP status", async () => {
    mockFetch(400, { error: "bad request" });
    try {
      await client().links.get(1);
      expect.unreachable();
    } catch (e) {
      expect((e as ShrtnrError).message).toBe("shrtnr API error (HTTP 400): bad request");
    }
  });

  it("throws ShrtnrError on 401 unauthorized", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(client().links.list()).rejects.toBeInstanceOf(ShrtnrError);
  });

  it("wraps network errors in ShrtnrError with status 0", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    try {
      await client().links.list();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(0);
    }
  });

  it("wraps a non-JSON 2xx body in ShrtnrError instead of throwing a raw SyntaxError", async () => {
    mockFetch(200, "<html>Bad Gateway</html>", "text/html");
    try {
      await client().links.list();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(200);
    }
  });

  it("binds fetch to globalThis instead of capturing an unbound method reference", async () => {
    // Browsers brand-check fetch's receiver (must be Window). Extracting
    // `globalThis.fetch` as a bare reference and calling it as `this.fetchFn(...)`
    // changes the implicit receiver to the HttpClient instance, which real
    // browsers reject with "Illegal invocation". Binding to globalThis fixes it.
    const realFetch = globalThis.fetch;
    function brandCheckedFetch(this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(
        new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }
    globalThis.fetch = brandCheckedFetch as typeof fetch;
    try {
      const unconfiguredClient = new ShrtnrClient({ baseUrl: BASE, apiKey: API_KEY });
      await expect(unconfiguredClient.links.list()).resolves.toEqual([]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("binds a caller-supplied fetch option to globalThis too, not just the default", async () => {
    // The same brand-check bug can hit a caller-provided `fetch` (e.g.
    // `fetch: window.fetch`, exactly what the README's custom-fetch example
    // shows): only the resolveGlobalFetch() fallback branch was ever bound
    // to globalThis, so a bare receiver-sensitive function passed via the
    // `fetch` config option was invoked as `this.fetchFn(...)` and failed
    // the same brand check a real browser's Window.fetch performs.
    function brandCheckedFetch(this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(
        new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }
    const customClient = new ShrtnrClient({
      baseUrl: BASE,
      apiKey: API_KEY,
      fetch: brandCheckedFetch as typeof fetch,
    });
    await expect(customClient.links.list()).resolves.toEqual([]);
  });

  it("throws ShrtnrError naming the fetch option when the environment has no global fetch", () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = undefined as unknown as typeof fetch;
    try {
      new ShrtnrClient({ baseUrl: BASE, apiKey: API_KEY });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(0);
      expect((e as ShrtnrError).serverMessage).toMatch(/fetch/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("throws ShrtnrError when the global fetch is not callable", () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = {} as unknown as typeof fetch;
    try {
      expect(() => new ShrtnrClient({ baseUrl: BASE, apiKey: API_KEY })).toThrow(ShrtnrError);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("uses an injected fetch even when the environment has no global fetch", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = undefined as unknown as typeof fetch;
    try {
      mockFetch(200, []);
      await expect(client().links.list()).resolves.toEqual([]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("throws ShrtnrError on an empty body served with a non-204 2xx", async () => {
    // A proxy that strips the body off a 200 leaves nothing for a resource
    // method to build a model from. Python raises here and Dart 2.1.2 does
    // too; TypeScript reaches the same outcome through its JSON-parse guard.
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 200 }));
    try {
      await client().links.get(1);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
    }
  });

  it("reports status 0 when the connection drops mid-body on a JSON response", async () => {
    // fetch resolves once headers land; the body streams afterward. Reading
    // it through res.json() reported the response status, so a connection
    // reset partway through a 200 surfaced as ShrtnrError(200) and read as a
    // server-side problem. The body read now carries status 0 like every
    // other transport failure, matching Dart and Python.
    fetchSpy.mockResolvedValueOnce(new Response(erroringBody(), { status: 200 }));
    try {
      await client().links.list();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(0);
    }
  });

  it("reports status 0 when the connection drops mid-body on an error response", async () => {
    // The error branch read the body via res.json() directly, so a
    // connection reset while streaming a 500's error body was swallowed by
    // the catch and reported as ShrtnrError(500, "HTTP 500") instead of the
    // status-0 transport failure every other read path reports.
    fetchSpy.mockResolvedValueOnce(new Response(erroringBody(), { status: 500 }));
    try {
      await client().links.list();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(0);
    }
  });

  it("wraps a mid-body stream failure on a text response in ShrtnrError", async () => {
    // requestText handed back res.text() unwrapped, so a reset partway
    // through a QR download escaped as a raw TypeError past the documented
    // "network failures throw ShrtnrError with status 0" contract.
    fetchSpy.mockResolvedValueOnce(
      new Response(erroringBody(), {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    try {
      await client().links.qr(5);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(0);
    }
  });

  it("reports status 0 when the connection drops mid-body on a non-2xx text response", async () => {
    // requestText's error branch had the same res.json()-without-readBody
    // gap as request(): a reset while streaming a non-2xx QR error body
    // reported the stale HTTP status instead of status 0.
    fetchSpy.mockResolvedValueOnce(
      new Response(erroringBody(), {
        status: 500,
        headers: { "Content-Type": "image/svg+xml" },
      }),
    );
    try {
      await client().links.qr(5);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShrtnrError);
      expect((e as ShrtnrError).status).toBe(0);
    }
  });
});

// ============================================================
// 3. Case transformation
// ============================================================

describe("Case transformation", () => {
  it("converts snake_case JSON keys to camelCase model fields", async () => {
    const wireLink = {
      id: 42,
      url: "https://example.com",
      label: "test",
      created_at: 1000,
      expires_at: null,
      created_via: null,
      created_by: "user@example.com",
      total_clicks: 5,
      delta_pct: 0.1,
      slugs: [
        {
          link_id: 42,
          slug: "abc",
          is_custom: 0,
          is_primary: 1,
          click_count: 5,
          created_at: 1000,
          disabled_at: null,
        },
      ],
    };
    mockFetch(200, wireLink);
    const link = await client().links.get(42);
    expect(link.createdAt).toBe(1000);
    expect(link.totalClicks).toBe(5);
    expect(link.deltaPct).toBe(0.1);
    expect(link.slugs[0].linkId).toBe(42);
    expect(link.slugs[0].isCustom).toBe(0);
    expect(link.slugs[0].isPrimary).toBe(1);
    expect(link.slugs[0].clickCount).toBe(5);
    expect(link.slugs[0].disabledAt).toBeNull();
  });

  it("converts camelCase request body keys to snake_case on the wire", async () => {
    mockFetch(201, { id: 1, url: "https://example.com", label: null, created_at: 1000, expires_at: null, created_via: null, created_by: "u", total_clicks: 0, slugs: [] });
    await client().links.create({ url: "https://example.com", slugLength: 6, expiresAt: 2000 });
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["slug_length"]).toBe(6);
    expect(body["expires_at"]).toBe(2000);
    expect(body["slugLength"]).toBeUndefined();
    expect(body["expiresAt"]).toBeUndefined();
  });

  it("converts camelCase bundle create body to snake_case", async () => {
    mockFetch(201, { id: 1, name: "B", description: null, icon: null, accent: "orange", archived_at: null, created_via: null, created_by: "u", created_at: 1000, updated_at: 1000 });
    await client().bundles.create({ name: "B", accent: "blue" });
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["name"]).toBe("B");
    expect(body["accent"]).toBe("blue");
  });

  it("converts addLink linkId to link_id on the wire", async () => {
    mockFetch(200, { added: true });
    await client().bundles.addLink(5, 99);
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["link_id"]).toBe(99);
    expect(body["linkId"]).toBeUndefined();
  });

  it("does not flatten a non-plain-object value (e.g. Date) into {}", async () => {
    mockFetch(201, { id: 1, url: "https://example.com", label: null, created_at: 1000, expires_at: null, created_via: null, created_by: "u", total_clicks: 0, slugs: [] });
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    // expiresAt is typed as number (a unix timestamp); this cast simulates a
    // plain-JS caller passing a Date, which used to be silently flattened to {}.
    await client().links.create({ url: "https://example.com", expiresAt: expiresAt as unknown as number });
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["expires_at"]).toBe(expiresAt.toISOString());
  });
});

// ============================================================
// 4. LinksResource
// ============================================================

const stubLink = {
  id: 1, url: "https://example.com", label: null,
  created_at: 1000, expires_at: null, created_via: null,
  created_by: "u", total_clicks: 0, slugs: [],
};

describe("links.get", () => {
  it("GETs /api/links/:id", async () => {
    mockFetch(200, stubLink);
    await client().links.get(3);
    expect(lastCall().url).toBe(`${BASE}/_/api/links/3`);
    expect(lastCall().init.method).toBe("GET");
  });

  it("appends range query param when provided", async () => {
    mockFetch(200, stubLink);
    await client().links.get(3, { range: "7d" });
    expect(lastCall().url).toBe(`${BASE}/_/api/links/3?range=7d`);
  });

  it("omits range when not provided", async () => {
    mockFetch(200, stubLink);
    await client().links.get(3);
    expect(lastCall().url).toBe(`${BASE}/_/api/links/3`);
  });
});

describe("links.list", () => {
  it("GETs /api/links", async () => {
    mockFetch(200, []);
    await client().links.list();
    expect(lastCall().url).toBe(`${BASE}/_/api/links`);
    expect(lastCall().init.method).toBe("GET");
  });

  it("appends owner when provided", async () => {
    mockFetch(200, []);
    await client().links.list({ owner: "user@example.com" });
    expect(lastCall().url).toBe(`${BASE}/_/api/links?owner=user%40example.com`);
  });

  it("appends range when provided", async () => {
    mockFetch(200, []);
    await client().links.list({ range: "30d" });
    expect(lastCall().url).toBe(`${BASE}/_/api/links?range=30d`);
  });
});

describe("links.create", () => {
  it("POSTs /api/links", async () => {
    mockFetch(201, stubLink);
    await client().links.create({ url: "https://example.com", label: "L" });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["url"]).toBe("https://example.com");
    expect(body["label"]).toBe("L");
  });
});

describe("links.update", () => {
  it("PUTs /api/links/:id", async () => {
    mockFetch(200, stubLink);
    await client().links.update(1, { url: "https://new.com" });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1`);
    expect(init.method).toBe("PUT");
  });

  it("sends label: null to clear the label", async () => {
    mockFetch(200, stubLink);
    await client().links.update(1, { label: null });
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty("label");
    expect(body["label"]).toBeNull();
  });

  it("sends expires_at: null to clear expiry", async () => {
    mockFetch(200, stubLink);
    await client().links.update(1, { expiresAt: null });
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty("expires_at");
    expect(body["expires_at"]).toBeNull();
  });
});

describe("links.disable", () => {
  it("POSTs /api/links/:id/disable", async () => {
    mockFetch(200, stubLink);
    await client().links.disable(1);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1/disable`);
    expect(init.method).toBe("POST");
  });
});

describe("links.enable", () => {
  it("POSTs /api/links/:id/enable", async () => {
    mockFetch(200, stubLink);
    await client().links.enable(1);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1/enable`);
    expect(init.method).toBe("POST");
  });
});

describe("links.delete", () => {
  it("DELETEs /api/links/:id and returns {deleted: boolean}", async () => {
    mockFetch(200, { deleted: true });
    const result = await client().links.delete(1);
    expect(result.deleted).toBe(true);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1`);
    expect(init.method).toBe("DELETE");
  });
});

describe("links.analytics", () => {
  const stubStats = {
    total_clicks: 42,
    countries: [], referrers: [], referrer_hosts: [],
    devices: [], os: [], browsers: [],
    link_modes: [], channels: [], clicks_over_time: [], slug_clicks: [],
    num_countries: 3, num_referrers: 2, num_referrer_hosts: 1,
    num_os: 4, num_browsers: 2,
  };

  it("GETs /api/links/:id/analytics", async () => {
    mockFetch(200, stubStats);
    await client().links.analytics(5);
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/analytics`);
  });

  it("appends range when provided", async () => {
    mockFetch(200, stubStats);
    await client().links.analytics(5, { range: "7d" });
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/analytics?range=7d`);
  });

  it("maps num_countries to numCountries", async () => {
    mockFetch(200, stubStats);
    const stats = await client().links.analytics(5);
    expect(stats.numCountries).toBe(3);
    expect(stats.numReferrerHosts).toBe(1);
    expect(stats.numBrowsers).toBe(2);
    expect(stats.numOs).toBe(4);
  });
});

describe("links.breakdown", () => {
  const stubPage = { items: [{ name: "US", count: 5 }], total: 42 };

  it("GETs /api/links/:id/breakdown with only dimension", async () => {
    mockFetch(200, stubPage);
    await client().links.breakdown(5, { dimension: "countries" });
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/breakdown?dimension=countries`);
  });

  it("appends range, offset, and limit when provided", async () => {
    mockFetch(200, stubPage);
    await client().links.breakdown(5, { dimension: "countries", range: "7d", offset: 10, limit: 10 });
    expect(lastCall().url).toBe(
      `${BASE}/_/api/links/5/breakdown?dimension=countries&range=7d&offset=10&limit=10`,
    );
  });

  it("parses items and total from the response", async () => {
    mockFetch(200, stubPage);
    const page = await client().links.breakdown(5, { dimension: "countries" });
    expect(page.total).toBe(42);
    expect(page.items[0].name).toBe("US");
    expect(page.items[0].count).toBe(5);
  });
});

describe("links.timeline", () => {
  const stubTimeline = {
    range: "7d",
    buckets: [{ label: "Mon", count: 5 }],
    summary: { last_24h: 1, last_7d: 5, last_30d: 10, last_90d: 30, last_1y: 100 },
  };

  it("GETs /api/links/:id/timeline", async () => {
    mockFetch(200, stubTimeline);
    await client().links.timeline(5);
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/timeline`);
  });

  it("appends range when provided", async () => {
    mockFetch(200, stubTimeline);
    await client().links.timeline(5, { range: "30d" });
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/timeline?range=30d`);
  });

  it("maps summary keys to camelCase", async () => {
    mockFetch(200, stubTimeline);
    const td = await client().links.timeline(5);
    expect(td.summary.last24h).toBe(1);
    expect(td.summary.last7d).toBe(5);
    expect(td.summary.last30d).toBe(10);
    expect(td.summary.last90d).toBe(30);
    expect(td.summary.last1y).toBe(100);
  });
});

describe("links.qr", () => {
  it("GETs /api/links/:id/qr and returns SVG string", async () => {
    mockFetch(200, "<svg/>", "image/svg+xml");
    const svg = await client().links.qr(5);
    expect(svg).toMatch(/<svg/);
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/qr`);
  });

  it("appends slug and size when provided, converting number to string", async () => {
    mockFetch(200, "<svg/>", "image/svg+xml");
    await client().links.qr(5, { slug: "promo", size: 256 });
    expect(lastCall().url).toBe(`${BASE}/_/api/links/5/qr?slug=promo&size=256`);
  });
});

describe("links.bundles", () => {
  it("GETs /api/links/:id/bundles", async () => {
    mockFetch(200, []);
    await client().links.bundles(7);
    expect(lastCall().url).toBe(`${BASE}/_/api/links/7/bundles`);
  });
});

// ============================================================
// 5. SlugsResource
// ============================================================

const stubSlug = {
  link_id: 1, slug: "abc", is_custom: 1, is_primary: 0,
  click_count: 0, created_at: 1000, disabled_at: null,
};

describe("slugs.lookup", () => {
  it("GETs /api/slugs/:slug", async () => {
    mockFetch(200, stubLink);
    await client().slugs.lookup("find-me");
    expect(lastCall().url).toBe(`${BASE}/_/api/slugs/find-me`);
  });

  it("URL-encodes slugs with reserved characters", async () => {
    mockFetch(200, stubLink);
    await client().slugs.lookup("foo/bar");
    expect(lastCall().url).toBe(`${BASE}/_/api/slugs/foo%2Fbar`);
  });
});

describe("slugs.add", () => {
  it("POSTs /api/links/:id/slugs with slug body", async () => {
    mockFetch(201, stubSlug);
    await client().slugs.add(1, "custom");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1/slugs`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ slug: "custom" });
  });
});

describe("slugs.disable", () => {
  it("POSTs /api/links/:id/slugs/:slug/disable", async () => {
    mockFetch(200, stubSlug);
    await client().slugs.disable(1, "abc");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1/slugs/abc/disable`);
    expect(init.method).toBe("POST");
  });
});

describe("slugs.enable", () => {
  it("POSTs /api/links/:id/slugs/:slug/enable", async () => {
    mockFetch(200, stubSlug);
    await client().slugs.enable(1, "abc");
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1/slugs/abc/enable`);
    expect(init.method).toBe("POST");
  });
});

describe("slugs.remove", () => {
  it("DELETEs /api/links/:id/slugs/:slug and returns {removed: boolean}", async () => {
    mockFetch(200, { removed: true });
    const result = await client().slugs.remove(1, "abc");
    expect(result.removed).toBe(true);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/links/1/slugs/abc`);
    expect(init.method).toBe("DELETE");
  });
});

// ============================================================
// 6. BundlesResource
// ============================================================

const stubBundle = {
  id: 42, name: "Test Bundle", description: null, icon: null,
  accent: "orange", archived_at: null, created_via: null,
  created_by: "user@example.com", created_at: 1000, updated_at: 1000,
};

const stubBundleWithSummary = {
  ...stubBundle,
  link_count: 3, total_clicks: 100, sparkline: [1, 2, 3],
  top_links: [{ slug: "abc", click_count: 50 }],
};

describe("bundles.get", () => {
  it("GETs /api/bundles/:id", async () => {
    mockFetch(200, stubBundleWithSummary);
    await client().bundles.get(42);
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles/42`);
  });

  it("appends range when provided", async () => {
    mockFetch(200, stubBundleWithSummary);
    await client().bundles.get(42, { range: "90d" });
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles/42?range=90d`);
  });

  it("maps snake_case fields to camelCase", async () => {
    mockFetch(200, stubBundleWithSummary);
    const b = await client().bundles.get(42);
    expect(b.linkCount).toBe(3);
    expect(b.totalClicks).toBe(100);
    expect(b.archivedAt).toBeNull();
    expect(b.topLinks[0].clickCount).toBe(50);
  });
});

describe("bundles.list", () => {
  it("GETs /api/bundles", async () => {
    mockFetch(200, []);
    await client().bundles.list();
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles`);
  });

  it("appends archived when provided", async () => {
    mockFetch(200, []);
    await client().bundles.list({ archived: "all" });
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles?archived=all`);
  });

  it("appends range when provided", async () => {
    mockFetch(200, []);
    await client().bundles.list({ range: "1y" });
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles?range=1y`);
  });
});

describe("bundles.create", () => {
  it("POSTs /api/bundles", async () => {
    mockFetch(201, stubBundle);
    await client().bundles.create({ name: "New Bundle" });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "New Bundle" });
  });
});

describe("bundles.update", () => {
  it("PUTs /api/bundles/:id", async () => {
    mockFetch(200, stubBundle);
    await client().bundles.update(42, { description: "Updated" });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles/42`);
    expect(init.method).toBe("PUT");
  });

  it("sends description: null to clear the description", async () => {
    mockFetch(200, stubBundle);
    await client().bundles.update(42, { description: null });
    const { init } = lastCall();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty("description");
    expect(body["description"]).toBeNull();
  });
});

describe("bundles.delete", () => {
  it("DELETEs /api/bundles/:id and returns {deleted: boolean}", async () => {
    mockFetch(200, { deleted: true });
    const result = await client().bundles.delete(42);
    expect(result.deleted).toBe(true);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles/42`);
    expect(init.method).toBe("DELETE");
  });
});

describe("bundles.archive", () => {
  it("POSTs /api/bundles/:id/archive", async () => {
    mockFetch(200, { ...stubBundle, archived_at: 9999 });
    await client().bundles.archive(42);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles/42/archive`);
    expect(init.method).toBe("POST");
  });
});

describe("bundles.unarchive", () => {
  it("POSTs /api/bundles/:id/unarchive", async () => {
    mockFetch(200, stubBundle);
    await client().bundles.unarchive(42);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles/42/unarchive`);
    expect(init.method).toBe("POST");
  });
});

describe("bundles.analytics", () => {
  const stubStats = {
    total_clicks: 10,
    countries: [], referrers: [], referrer_hosts: [],
    devices: [], os: [], browsers: [],
    link_modes: [], channels: [], clicks_over_time: [], slug_clicks: [],
    num_countries: 1, num_referrers: 0, num_referrer_hosts: 0,
    num_os: 2, num_browsers: 1,
  };

  it("GETs /api/bundles/:id/analytics", async () => {
    mockFetch(200, stubStats);
    await client().bundles.analytics(42);
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles/42/analytics`);
  });

  it("appends range when provided", async () => {
    mockFetch(200, stubStats);
    await client().bundles.analytics(42, { range: "all" });
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles/42/analytics?range=all`);
  });
});

describe("bundles.breakdown", () => {
  const stubPage = { items: [{ name: "US", count: 5 }], total: 42 };

  it("GETs /api/bundles/:id/breakdown with only dimension", async () => {
    mockFetch(200, stubPage);
    await client().bundles.breakdown(5, { dimension: "countries" });
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles/5/breakdown?dimension=countries`);
  });

  it("appends range, offset, and limit when provided", async () => {
    mockFetch(200, stubPage);
    await client().bundles.breakdown(5, { dimension: "countries", range: "7d", offset: 10, limit: 10 });
    expect(lastCall().url).toBe(
      `${BASE}/_/api/bundles/5/breakdown?dimension=countries&range=7d&offset=10&limit=10`,
    );
  });

  it("parses items and total from the response", async () => {
    mockFetch(200, stubPage);
    const page = await client().bundles.breakdown(5, { dimension: "countries" });
    expect(page.total).toBe(42);
    expect(page.items[0].name).toBe("US");
    expect(page.items[0].count).toBe(5);
  });
});

describe("bundles.links", () => {
  it("GETs /api/bundles/:id/links", async () => {
    mockFetch(200, []);
    await client().bundles.links(42);
    expect(lastCall().url).toBe(`${BASE}/_/api/bundles/42/links`);
  });
});

describe("bundles.addLink", () => {
  it("POSTs /api/bundles/:id/links with link_id and returns {added: boolean}", async () => {
    mockFetch(200, { added: true });
    const result = await client().bundles.addLink(42, 7);
    expect(result.added).toBe(true);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles/42/links`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ link_id: 7 });
  });
});

describe("bundles.removeLink", () => {
  it("DELETEs /api/bundles/:id/links/:linkId and returns {removed: boolean}", async () => {
    mockFetch(200, { removed: true });
    const result = await client().bundles.removeLink(42, 7);
    expect(result.removed).toBe(true);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE}/_/api/bundles/42/links/7`);
    expect(init.method).toBe("DELETE");
  });
});

// ============================================================
// 7. Base URL normalization
// ============================================================

describe("Base URL normalization", () => {
  it("strips trailing slashes from baseUrl", async () => {
    const c = new ShrtnrClient({ baseUrl: BASE + "/", apiKey: API_KEY, fetch: fetchSpy });
    mockFetch(200, []);
    await c.links.list();
    expect(lastCall().url).toBe(`${BASE}/_/api/links`);
  });

  it("strips multiple trailing slashes", async () => {
    const c = new ShrtnrClient({ baseUrl: BASE + "///", apiKey: API_KEY, fetch: fetchSpy });
    mockFetch(200, []);
    await c.links.list();
    expect(lastCall().url).toBe(`${BASE}/_/api/links`);
  });
});

// ============================================================
// 8. Package surface
// ============================================================

describe("Package surface", () => {
  it("does not expose administrative methods on client", () => {
    const c = client() as unknown as Record<string, unknown>;
    expect(c.createLink).toBeUndefined();
    expect(c.getLink).toBeUndefined();
    expect(c.listLinks).toBeUndefined();
    expect(c.health).toBeUndefined();
    expect(typeof c.links).toBe("object");
    expect(typeof c.slugs).toBe("object");
    expect(typeof c.bundles).toBe("object");
  });

  it("does not publish an internal admin entrypoint in package.json", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const packageJsonPath = resolve(new URL("../package.json", import.meta.url).pathname);
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      exports?: Record<string, unknown>;
    };
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports?.["./internal"]).toBeUndefined();
  });
});
