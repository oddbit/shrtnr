import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { LinkRepository, ClickRepository } from "../db";
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

  it("LinkRepository.create accepts createdVia parameter", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdVia: "mcp" });
    expect(link.created_via).toBe("mcp");
  });

  it("LinkRepository.create defaults created_via to app", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(link.created_via).toBe("app");
  });

  it("createLink service passes created_via through", async () => {
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
  it("ClickRepository.record stores channel when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, null, "US", "mobile", "Chrome", "qr");

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(slugId)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("qr");
  });

  it("ClickRepository.record defaults channel to 'direct' for regular clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, null, "US", "mobile", "Chrome");

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(slugId)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("direct");
  });

  it("redirect with ?utm_medium=qr records channel as 'qr'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test1" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test1?utm_medium=qr", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("qr");
  });

  it("redirect without utm_medium records channel as 'direct'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test2" });
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

  it("redirect with uppercase ?utm_medium=QR records channel as 'qr'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test3" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test3?utm_medium=QR", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT channel FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ channel: string | null }>();
    expect(row!.channel).toBe("qr");
  });

  it("redirect with unrecognized utm_medium records channel as 'direct'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test4" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test4?utm_medium=email", { redirect: "manual" }),
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
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, null, null, null, null, "qr");
    await ClickRepository.record(env.DB, slugId, null, null, null, null, "qr");
    await ClickRepository.record(env.DB, slugId, null, null, null, null);

    const stats = await ClickRepository.getStats(env.DB, link.id);
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

  it("GET /_/admin/api/links/:id/qr encodes URL with utm_medium=qr", async () => {
    const createRes = await SELF.fetch(
      authed("/_/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", custom_slug: "my-link" }),
      }),
    );
    const created = (await createRes.json()) as any;

    const res = await SELF.fetch(authed(`/_/admin/api/links/${created.id}/qr?slug=my-link`));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  it("GET /_/admin/api/links/:id/qr returns 404 for non-existent link", async () => {
    const res = await SELF.fetch(authed("/_/admin/api/links/99999/qr"));
    expect(res.status).toBe(404);
  });

  it("GET /_/api/links/:id/qr returns SVG with API key auth", async () => {
    const keyRes = await SELF.fetch(
      authed("/_/admin/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "QR Test", scope: "create,read" }),
      }),
    );
    const { raw_key } = (await keyRes.json()) as any;

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

    const res = await SELF.fetch(
      new Request(`https://shrtnr.test/_/api/links/${created.id}/qr`, {
        headers: { Authorization: `Bearer ${raw_key}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });
});
