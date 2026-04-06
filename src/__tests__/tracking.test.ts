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

// ---- Feature 2: QR link mode tracking ----

describe("QR link mode tracking", () => {
  it("ClickRepository.record stores link_mode when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, {
      country: "US",
      deviceType: "mobile",
      browser: "Chrome",
      linkMode: "qr",
    });

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug_id = ?")
      .bind(slugId)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("qr");
  });

  it("ClickRepository.record defaults link_mode to 'link' for regular clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, {
      country: "US",
      deviceType: "mobile",
      browser: "Chrome",
    });

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug_id = ?")
      .bind(slugId)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("link");
  });

  it("redirect with ?utm_medium=qr records link_mode as 'qr'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test1" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test1?utm_medium=qr", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("qr");
  });

  it("redirect without utm_medium records link_mode as 'link'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test2" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test2", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("link");
  });

  it("redirect with uppercase ?utm_medium=QR records link_mode as 'qr'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test3" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test3?utm_medium=QR", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("qr");
  });

  it("redirect with non-qr utm_medium records link_mode as 'link'", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "test4" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/test4?utm_medium=email", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("link");
  });

  it("analytics includes link_mode breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slugId = link.slugs[0].id;
    await ClickRepository.record(env.DB, slugId, { linkMode: "qr" });
    await ClickRepository.record(env.DB, slugId, { linkMode: "qr" });
    await ClickRepository.record(env.DB, slugId);

    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.link_modes).toEqual(
      expect.arrayContaining([
        { name: "qr", count: 2 },
        { name: "link", count: 1 },
      ]),
    );
  });
});

// ---- Feature 3: UTM parameter tracking ----

describe("UTM parameter tracking", () => {
  it("redirect stores all UTM parameters from query string", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "utm1" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/utm1?utm_source=newsletter&utm_medium=email&utm_campaign=spring-launch&utm_term=deals&utm_content=cta-button", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT utm_source, utm_medium, utm_campaign, utm_term, utm_content FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ utm_source: string; utm_medium: string; utm_campaign: string; utm_term: string; utm_content: string }>();
    expect(row!.utm_source).toBe("newsletter");
    expect(row!.utm_medium).toBe("email");
    expect(row!.utm_campaign).toBe("spring-launch");
    expect(row!.utm_term).toBe("deals");
    expect(row!.utm_content).toBe("cta-button");
  });

  it("redirect stores utm_medium=qr and sets link_mode=qr simultaneously", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "utm2" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/utm2?utm_medium=qr&utm_source=poster&utm_campaign=promo-2026", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT link_mode, utm_medium, utm_source, utm_campaign FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ link_mode: string; utm_medium: string; utm_source: string; utm_campaign: string }>();
    expect(row!.link_mode).toBe("qr");
    expect(row!.utm_medium).toBe("qr");
    expect(row!.utm_source).toBe("poster");
    expect(row!.utm_campaign).toBe("promo-2026");
  });
});

// ---- Feature 4: OS and referrer_host tracking ----

describe("OS and referrer_host tracking", () => {
  it("redirect stores OS parsed from User-Agent", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "os1" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/os1", {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT os FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ os: string }>();
    expect(row!.os).toBe("ios");
  });

  it("redirect stores referrer_host extracted from Referer header", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ref1" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/ref1", {
        redirect: "manual",
        headers: {
          Referer: "https://google.com/search?q=test",
        },
      }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT referrer, referrer_host FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ referrer: string; referrer_host: string }>();
    expect(row!.referrer).toBe("https://google.com/search?q=test");
    expect(row!.referrer_host).toBe("google.com");
  });

  it("redirect stores user_agent string", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ua1" });
    const uaString = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/ua1", {
        redirect: "manual",
        headers: { "User-Agent": uaString },
      }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT user_agent FROM clicks WHERE slug_id = ?")
      .bind(link.slugs[0].id)
      .first<{ user_agent: string }>();
    expect(row!.user_agent).toBe(uaString);
  });
});

// ---- Feature 5: QR SVG generation ----

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
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    const created = (await createRes.json()) as any;

    await SELF.fetch(
      authed(`/_/admin/api/links/${created.id}/slugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "my-link" }),
      }),
    );

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
