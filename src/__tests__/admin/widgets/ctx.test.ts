// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { Hono } from "hono";
import { applyMigrations, resetData } from "../../setup";
import { buildWidgetCtx } from "../../../admin/widgets/ctx";
import { updateAppSettings } from "../../../services/admin-management";
import type { HonoEnv } from "../../../api/hono-env";

const TEST_IDENTITY = "ctx@example.com";

beforeAll(applyMigrations);
beforeEach(resetData);

// buildWidgetCtx reads c.var.identity, c.env and c.req. The smallest real seam
// is a Hono app whose middleware sets identity exactly like the admin
// middleware in src/index.tsx, then a probe route that returns the assembled
// context as JSON.
function makeApp(cookieHeader?: string) {
  const app = new Hono<HonoEnv>();
  app.use("*", async (c, next) => {
    c.set("identity", TEST_IDENTITY);
    await next();
  });
  app.get("/probe", async (c) => {
    const ctx = await buildWidgetCtx(c);
    return c.json({
      identity: ctx.identity,
      lang: ctx.lang,
      filters: ctx.filters,
      // Exercise the translate fn so a broken t() surfaces here.
      greetingKey: typeof ctx.t === "function" ? ctx.t("nonexistent.key" as never) : null,
    });
  });
  return (path: string) =>
    app.request(path, cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined, env as never);
}

describe("buildWidgetCtx", () => {
  it("carries the request identity", async () => {
    const res = await makeApp()("/probe");
    const body = (await res.json()) as { identity: string };
    expect(body.identity).toBe(TEST_IDENTITY);
  });

  it("reads settings only once per request (no redundant filters lookup)", async () => {
    let settingsReads = 0;
    const countingDb = new Proxy(env.DB, {
      get(target, prop, receiver) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (/from settings/i.test(sql)) settingsReads++;
            return (target as unknown as D1Database).prepare(sql);
          };
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const app = new Hono<HonoEnv>();
    app.use("*", async (c, next) => {
      c.set("identity", TEST_IDENTITY);
      await next();
    });
    app.get("/probe", async (c) => {
      await buildWidgetCtx(c);
      return c.json({ ok: true });
    });
    await app.request("/probe", undefined, { ...env, DB: countingDb } as never);
    // getAppSettings issues 6 settings reads. A redundant resolveClickFilters
    // call would double that to 12; building filters from one fetch keeps it 6.
    expect(settingsReads).toBe(6);
  });

  it("falls back to the default language when no setting or cookie is present", async () => {
    const res = await makeApp()("/probe");
    const body = (await res.json()) as { lang: string };
    expect(body.lang).toBe("en");
  });

  it("uses the stored lang setting when present", async () => {
    await updateAppSettings(env as never, TEST_IDENTITY, { lang: "sv" });
    const res = await makeApp()("/probe");
    const body = (await res.json()) as { lang: string };
    expect(body.lang).toBe("sv");
  });

  it("honors the lang cookie when no setting is stored", async () => {
    const res = await makeApp("lang=id")("/probe");
    const body = (await res.json()) as { lang: string };
    expect(body.lang).toBe("id");
  });

  it("prefers the stored setting over the cookie", async () => {
    await updateAppSettings(env as never, TEST_IDENTITY, { lang: "sv" });
    const res = await makeApp("lang=id")("/probe");
    const body = (await res.json()) as { lang: string };
    expect(body.lang).toBe("sv");
  });

  it("clamps an unsupported cookie language to the default", async () => {
    const res = await makeApp("lang=zz")("/probe");
    const body = (await res.json()) as { lang: string };
    expect(body.lang).toBe("en");
  });

  it("resolves filters with both exclusions on by default", async () => {
    const res = await makeApp()("/probe");
    const body = (await res.json()) as { filters: { excludeBots: boolean; excludeSelfReferrers: boolean } };
    expect(body.filters).toEqual({ excludeBots: true, excludeSelfReferrers: true });
  });

  it("reflects a toggled-off bot filter in the resolved filters", async () => {
    await updateAppSettings(env as never, TEST_IDENTITY, { filter_bots: false });
    const res = await makeApp()("/probe");
    const body = (await res.json()) as { filters: { excludeBots: boolean; excludeSelfReferrers: boolean } };
    expect(body.filters).toEqual({ excludeBots: false, excludeSelfReferrers: true });
  });

  it("returns a translate function that echoes unknown keys", async () => {
    const res = await makeApp()("/probe");
    const body = (await res.json()) as { greetingKey: string };
    expect(body.greetingKey).toBe("nonexistent.key");
  });
});
