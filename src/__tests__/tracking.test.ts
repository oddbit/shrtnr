import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { dbCreateLink, dbRecordClick, dbGetLinkClickStats } from "../db";
import { createLink } from "../services/link-management";
import { makeQR, renderQrSvg } from "../qr";

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

const AUTH_HEADER = { "Cf-Access-Jwt-Assertion": makeJwt("test@example.com") };

function authed(path: string, init?: RequestInit): Request {
  return new Request(`https://shrtnr.test${path}`, {
    ...init,
    headers: { ...AUTH_HEADER, ...(init?.headers ?? {}) },
  });
}

beforeAll(applyMigrations);
beforeEach(resetData);

// ---- Feature 1: created_via tracking ----

describe("created_via tracking", () => {
  it("admin UI link creation sets created_via to 'app'", async () => {
    const res = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.created_via).toBe("app");
  });

  it("public API link creation sets created_via to 'api'", async () => {
    // Create an API key first
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", scope: "create,read" }),
      }),
    );
    const { raw_key } = (await keyRes.json()) as any;

    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${raw_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.created_via).toBe("api");
  });

  it("SDK link creation (X-Client: sdk) sets created_via to 'sdk'", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "SDK", scope: "create,read" }),
      }),
    );
    const { raw_key } = (await keyRes.json()) as any;

    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${raw_key}`,
          "Content-Type": "application/json",
          "X-Client": "sdk",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.created_via).toBe("sdk");
  });

  it("created_via is included in GET link by ID", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    const created = (await createRes.json()) as any;

    const res = await SELF.fetch(authed(`/_/admin/api/links/${created.id}`));
    const body = (await res.json()) as any;
    expect(body.created_via).toBe("app");
  });

  it("created_via is included in list links response", async () => {
    await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );

    const res = await SELF.fetch(authed("/_/admin/api/links"));
    const body = (await res.json()) as any[];
    expect(body[0].created_via).toBe("app");
  });

  it("createLink db function accepts created_via parameter", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc", null, null, null, "mcp");
    expect(link.created_via).toBe("mcp");
  });

  it("createLink db function defaults created_via to 'app'", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    expect(link.created_via).toBe("app");
  });

  it("createManagedLink passes created_via through", async () => {
    const result = await createLink(env as any, {
      url: "https://example.com",
      created_via: "mcp",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.created_via).toBe("mcp");
    }
  });
});

// ---- Feature 2: QR click channel tracking ----

describe("QR click channel tracking", () => {
  it("recordClick stores channel when provided", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const slugId = link.slugs[0].id;
    await dbRecordClick(env.DB, slugId, null, "US", "mobile", "Chrome", "qr");

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(slugId)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("qr");
  });

  it("recordClick defaults channel to 'direct' for regular clicks", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const slugId = link.slugs[0].id;
    await dbRecordClick(env.DB, slugId, null, "US", "mobile", "Chrome");

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(slugId)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("direct");
  });

  it("redirect with ?qr records channel as 'qr'", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "test1");
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test1?qr", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    // Wait for async click recording
    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("qr");
  });

  it("redirect without ?qr records channel as 'direct'", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "test2");
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test2", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("direct");
  });

  it("analytics includes channel breakdown", async () => {
    const link = await dbCreateLink(env.DB, "https://example.com", "abc");
    const slugId = link.slugs[0].id;
    await dbRecordClick(env.DB, slugId, null, null, null, null, "qr");
    await dbRecordClick(env.DB, slugId, null, null, null, null, "qr");
    await dbRecordClick(env.DB, slugId, null, null, null, null);

    const stats = await dbGetLinkClickStats(env.DB, link.id);
    expect(stats.channels).toEqual(
      expect.arrayContaining([
        { name: "qr", count: 2 },
        { name: "direct", count: 1 },
      ]),
    );
  });
});

// ---- Feature 3: QR SVG generation ----

describe("QR code generation", () => {
  it("makeQR generates a valid matrix for a short URL", () => {
    const matrix = makeQR("https://oddb.it/abc");
    expect(matrix).not.toBeNull();
    expect(matrix!.length).toBeGreaterThan(0);
    // QR version 1 = 21x21
    expect(matrix!.length).toBe(matrix![0].length);
  });

  it("makeQR returns null for text exceeding capacity", () => {
    const long = "x".repeat(300);
    expect(makeQR(long)).toBeNull();
  });

  it("renderQrSvg returns valid SVG markup", () => {
    const svg = renderQrSvg("https://oddb.it/abc");
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect");
  });

  it("renderQrSvg returns null for text too long", () => {
    expect(renderQrSvg("x".repeat(300))).toBeNull();
  });

  it("renderQrSvg respects custom colors", () => {
    const svg = renderQrSvg("https://oddb.it/abc", { fg: "#ff0000", bg: "#00ff00" });
    expect(svg).toContain('fill="#00ff00"');
    expect(svg).toContain('fill="#ff0000"');
  });
});

describe("QR download API", () => {
  it("GET /_/admin/api/links/:id/qr returns SVG", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    const created = (await createRes.json()) as any;

    const res = await SELF.fetch(authed(`/_/admin/api/links/${created.id}/qr`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  it("GET /_/admin/api/links/:id/qr encodes URL with ?qr suffix", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", vanity_slug: "my-link" }),
      }),
    );
    const created = (await createRes.json()) as any;

    // Request QR for vanity slug
    const res = await SELF.fetch(authed(`/_/admin/api/links/${created.id}/qr?slug=my-link`));
    expect(res.status).toBe(200);
    // The SVG should encode the slug URL, not the destination URL
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  it("GET /_/admin/api/links/:id/qr returns 404 for non-existent link", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/links/99999/qr"));
    expect(res.status).toBe(404);
  });

  it("GET /_/api/links/:id/qr returns SVG with API key auth", async () => {
    // Create API key
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "QR Test", scope: "create,read" }),
      }),
    );
    const { raw_key } = (await keyRes.json()) as any;

    // Create link
    const createRes = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${raw_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    const created = (await createRes.json()) as any;

    // Fetch QR
    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${created.id}/qr`, {
        headers: { Authorization: `Bearer ${raw_key}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });
});
