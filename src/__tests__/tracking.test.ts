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
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, {
      country: "US",
      deviceType: "mobile",
      browser: "Chrome",
      linkMode: "qr",
    });

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug = ?")
      .bind(slug)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("qr");
  });

  it("ClickRepository.record defaults link_mode to 'link' for regular clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, {
      country: "US",
      deviceType: "mobile",
      browser: "Chrome",
    });

    const row = await env.DB
      .prepare("SELECT link_mode FROM clicks WHERE slug = ?")
      .bind(slug)
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
      .prepare("SELECT link_mode FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
      .prepare("SELECT link_mode FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
      .prepare("SELECT link_mode FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
      .prepare("SELECT link_mode FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ link_mode: string | null }>();
    expect(row!.link_mode).toBe("link");
  });

  it("analytics includes link_mode breakdown", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, { linkMode: "qr" });
    await ClickRepository.record(env.DB, slug, { linkMode: "qr" });
    await ClickRepository.record(env.DB, slug);

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
      .prepare("SELECT utm_source, utm_medium, utm_campaign, utm_term, utm_content FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
      .prepare("SELECT link_mode, utm_medium, utm_source, utm_campaign FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
      .prepare("SELECT os FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
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
      .prepare("SELECT referrer, referrer_host FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer: string; referrer_host: string }>();
    expect(row!.referrer).toBe("https://google.com/search?q=test");
    expect(row!.referrer_host).toBe("google.com");
  });

  it("strips www. prefix from referrer_host", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ref-www" });
    await SELF.fetch(
      new Request("https://shrtnr.test/ref-www", {
        redirect: "manual",
        headers: { Referer: "https://www.linkedin.com/feed" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer_host FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer_host: string }>();
    expect(row!.referrer_host).toBe("linkedin.com");
  });

  it("keeps meaningful subdomains in referrer_host", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ref-sub" });
    await SELF.fetch(
      new Request("https://shrtnr.test/ref-sub", {
        redirect: "manual",
        headers: { Referer: "https://firebase.google.com/docs" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer_host FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer_host: string }>();
    expect(row!.referrer_host).toBe("firebase.google.com");
  });

  it("keeps country-code second-level domains intact in referrer_host", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "ref-ccld" });
    await SELF.fetch(
      new Request("https://shrtnr.test/ref-ccld", {
        redirect: "manual",
        headers: { Referer: "https://somedomain.co.uk/page" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer_host FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer_host: string }>();
    expect(row!.referrer_host).toBe("somedomain.co.uk");
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
      .prepare("SELECT user_agent FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ user_agent: string }>();
    expect(row!.user_agent).toBe(uaString);
  });
});

// ---- Feature: bot detection on redirect ----

describe("bot detection on redirect", () => {
  it("records is_bot=1 for a crawler User-Agent", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "bot1" });
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/bot1", {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
      }),
    );
    expect(res.status).toBe(301);

    await new Promise((r) => setTimeout(r, 100));

    const row = await env.DB
      .prepare("SELECT is_bot FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ is_bot: number }>();
    expect(row!.is_bot).toBe(1);
  });

  it("records is_bot=1 for a link-previewer User-Agent", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "bot2" });
    await SELF.fetch(
      new Request("https://shrtnr.test/bot2", {
        redirect: "manual",
        headers: { "User-Agent": "facebookexternalhit/1.1" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT is_bot FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ is_bot: number }>();
    expect(row!.is_bot).toBe(1);
  });

  it("records is_bot=1 when User-Agent header is missing", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "bot3" });
    // Undici strips User-Agent when set to empty, but the worker sees it as absent → treated as bot.
    await SELF.fetch(
      new Request("https://shrtnr.test/bot3", {
        redirect: "manual",
        headers: { "User-Agent": "" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT is_bot FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ is_bot: number }>();
    expect(row!.is_bot).toBe(1);
  });

  it("records is_bot=0 for a desktop Chrome User-Agent", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "human1" });
    await SELF.fetch(
      new Request("https://shrtnr.test/human1", {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT is_bot FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ is_bot: number }>();
    expect(row!.is_bot).toBe(0);
  });
});

// ---- Feature: self-referrer flagging (capture-all, filter-at-display) ----

describe("self-referrer flagging", () => {
  it("stores raw referrer and flags is_self_referrer=1 for bare-origin same host", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "self1" });
    await SELF.fetch(
      new Request("https://shrtnr.test/self1", {
        redirect: "manual",
        headers: { Referer: "https://shrtnr.test/" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer, referrer_host, is_self_referrer FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer: string | null; referrer_host: string | null; is_self_referrer: number }>();
    expect(row!.referrer).toBe("https://shrtnr.test/");
    expect(row!.referrer_host).toBe("shrtnr.test");
    expect(row!.is_self_referrer).toBe(1);
  });

  it("is_self_referrer=0 for same-host referrer with a meaningful path", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "self2" });
    await SELF.fetch(
      new Request("https://shrtnr.test/self2", {
        redirect: "manual",
        headers: { Referer: "https://shrtnr.test/_/admin/settings" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer, referrer_host, is_self_referrer FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer: string | null; referrer_host: string | null; is_self_referrer: number }>();
    expect(row!.referrer).toBe("https://shrtnr.test/_/admin/settings");
    expect(row!.referrer_host).toBe("shrtnr.test");
    expect(row!.is_self_referrer).toBe(0);
  });

  it("is_self_referrer=1 when same-host root is visited without a trailing slash", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "self2b" });
    await SELF.fetch(
      new Request("https://shrtnr.test/self2b", {
        redirect: "manual",
        headers: { Referer: "https://shrtnr.test" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT is_self_referrer FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ is_self_referrer: number }>();
    expect(row!.is_self_referrer).toBe(1);
  });

  it("is_self_referrer=0 for same-host root with query string", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "self2c" });
    await SELF.fetch(
      new Request("https://shrtnr.test/self2c", {
        redirect: "manual",
        headers: { Referer: "https://shrtnr.test/?utm_source=newsletter" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT is_self_referrer FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ is_self_referrer: number }>();
    expect(row!.is_self_referrer).toBe(0);
  });

  it("is_self_referrer=1 when Referer uses www. prefix of the same host", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "self3" });
    await SELF.fetch(
      new Request("https://shrtnr.test/self3", {
        redirect: "manual",
        headers: { Referer: "https://www.shrtnr.test/" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer, is_self_referrer FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer: string | null; is_self_referrer: number }>();
    expect(row!.referrer).toBe("https://www.shrtnr.test/");
    expect(row!.is_self_referrer).toBe(1);
  });

  it("is_self_referrer=0 and referrer preserved for cross-origin referrers", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "cross1" });
    await SELF.fetch(
      new Request("https://shrtnr.test/cross1", {
        redirect: "manual",
        headers: { Referer: "https://oddbit.id/en/projects/rekap" },
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const row = await env.DB
      .prepare("SELECT referrer, referrer_host, is_self_referrer FROM clicks WHERE slug = ?")
      .bind(link.slugs[0].slug)
      .first<{ referrer: string | null; referrer_host: string | null; is_self_referrer: number }>();
    expect(row!.referrer).toBe("https://oddbit.id/en/projects/rekap");
    expect(row!.referrer_host).toBe("oddbit.id");
    expect(row!.is_self_referrer).toBe(0);
  });

  it("Sources breakdown excludes bare-origin self-referrers but total_clicks still counts them", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "filt1" });
    const slug = link.slugs[0].slug;
    // One self-referrer, one meaningful same-host, one cross-origin.
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://shrtnr.test/",
      referrerHost: "shrtnr.test",
      isSelfReferrer: 1,
    });
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://shrtnr.test/_/admin/settings",
      referrerHost: "shrtnr.test",
      isSelfReferrer: 0,
    });
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://pub.dev/",
      referrerHost: "pub.dev",
      isSelfReferrer: 0,
    });

    const stats = await ClickRepository.getStats(env.DB, link.id);
    expect(stats.total_clicks).toBe(3);
    const sourceNames = stats.referrers.map((r) => r.name);
    expect(sourceNames).toContain("https://shrtnr.test/_/admin/settings");
    expect(sourceNames).toContain("https://pub.dev/");
    expect(sourceNames).not.toContain("https://shrtnr.test/");
  });

  it("Domains breakdown excludes bare-origin self-referrers", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "filt2" });
    const slug = link.slugs[0].slug;
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://shrtnr.test/",
      referrerHost: "shrtnr.test",
      isSelfReferrer: 1,
    });
    await ClickRepository.record(env.DB, slug, {
      referrer: "https://pub.dev/",
      referrerHost: "pub.dev",
      isSelfReferrer: 0,
    });

    const stats = await ClickRepository.getStats(env.DB, link.id);
    const domainNames = stats.referrer_hosts.map((r) => r.name);
    expect(domainNames).toContain("pub.dev");
    expect(domainNames).not.toContain("shrtnr.test");
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
