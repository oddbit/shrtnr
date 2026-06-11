import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import {
  createNewApiKey,
  getAppSettings,
  updateAppSettings,
} from "../../services/admin-management";

const TEST_IDENTITY = "test@example.com";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("admin-management service", () => {
  it("rejects invalid API key scope", async () => {
    const result = await createNewApiKey(env as any, TEST_IDENTITY, {
      title: "Bad",
      scope: "admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Scope must be one of/);
    }
  });

  it("rejects slug default length below minimum", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { slug_default_length: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects slug default length above maximum", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { slug_default_length: 200 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("updates settings and returns persisted value", async () => {
    const updated = await updateAppSettings(env as any, TEST_IDENTITY, { slug_default_length: 5 });
    expect(updated.ok).toBe(true);

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.slug_default_length).toBe(5);
    }
  });

  it("returns hardcoded default when setting is missing", async () => {
    await env.DB.exec("DELETE FROM settings WHERE key = 'slug_default_length'");

    const settings = await getAppSettings({ DB: env.DB } as any, TEST_IDENTITY);

    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.slug_default_length).toBe(3);
    }
  });

  it("returns 30d default_range when not set", async () => {
    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.default_range).toBe("30d");
    }
  });

  it("returns 30d default_range when stored value is empty", async () => {
    await env.DB.prepare(
      "INSERT INTO settings (identity, key, value) VALUES (?, 'default_range', '')",
    ).bind(TEST_IDENTITY).run();
    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.default_range).toBe("30d");
    }
  });

  it("returns 30d default_range when stored value is invalid", async () => {
    await env.DB.prepare(
      "INSERT INTO settings (identity, key, value) VALUES (?, 'default_range', 'garbage')",
    ).bind(TEST_IDENTITY).run();
    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.default_range).toBe("30d");
    }
  });

  it("persists a valid default_range", async () => {
    const updated = await updateAppSettings(env as any, TEST_IDENTITY, { default_range: "7d" });
    expect(updated.ok).toBe(true);

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.default_range).toBe("7d");
    }
  });

  it("rejects an invalid default_range", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { default_range: "42x" as any });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("accepts every valid range value", async () => {
    for (const r of ["24h", "7d", "30d", "90d", "1y", "all"] as const) {
      const updated = await updateAppSettings(env as any, TEST_IDENTITY, { default_range: r });
      expect(updated.ok).toBe(true);
      const settings = await getAppSettings(env as any, TEST_IDENTITY);
      if (settings.ok) expect(settings.data.default_range).toBe(r);
    }
  });

  it("returns filter_bots=true and filter_self_referrers=true by default", async () => {
    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.filter_bots).toBe(true);
      expect(settings.data.filter_self_referrers).toBe(true);
    }
  });

  it("persists filter_bots when toggled off", async () => {
    const updated = await updateAppSettings(env as any, TEST_IDENTITY, { filter_bots: false });
    expect(updated.ok).toBe(true);

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) expect(settings.data.filter_bots).toBe(false);
  });

  it("persists filter_self_referrers when toggled off", async () => {
    const updated = await updateAppSettings(env as any, TEST_IDENTITY, { filter_self_referrers: false });
    expect(updated.ok).toBe(true);

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) expect(settings.data.filter_self_referrers).toBe(false);
  });

  it("round-trips filter_bots back to true after toggling off and on", async () => {
    await updateAppSettings(env as any, TEST_IDENTITY, { filter_bots: false });
    await updateAppSettings(env as any, TEST_IDENTITY, { filter_bots: true });

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    if (settings.ok) expect(settings.data.filter_bots).toBe(true);
  });

  it("scopes filter settings by identity", async () => {
    await updateAppSettings(env as any, "user-a@example.com", { filter_bots: false });
    await updateAppSettings(env as any, "user-b@example.com", { filter_bots: true });

    const a = await getAppSettings(env as any, "user-a@example.com");
    const b = await getAppSettings(env as any, "user-b@example.com");
    if (a.ok) expect(a.data.filter_bots).toBe(false);
    if (b.ok) expect(b.data.filter_bots).toBe(true);
  });

  it("rejects non-boolean filter_bots", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { filter_bots: "nope" as any });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("falls back to the default slug length when the stored setting is not a number", async () => {
    await env.DB.prepare(
      "INSERT INTO settings (identity, key, value) VALUES (?, 'slug_default_length', 'garbage')",
    ).bind(TEST_IDENTITY).run();

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.slug_default_length).toBe(3);
    }
  });

  it("falls back to the default slug length when the stored setting is out of bounds", async () => {
    await env.DB.prepare(
      "INSERT INTO settings (identity, key, value) VALUES (?, 'slug_default_length', '9999')",
    ).bind(TEST_IDENTITY).run();

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.slug_default_length).toBe(3);
    }
  });
});

describe("settings theme and language validation", () => {
  it("accepts every known theme", async () => {
    for (const theme of ["oddbit", "dark", "light"]) {
      const result = await updateAppSettings(env as any, TEST_IDENTITY, { theme });
      expect(result.ok).toBe(true);
      const settings = await getAppSettings(env as any, TEST_IDENTITY);
      if (settings.ok) expect(settings.data.theme).toBe(theme);
    }
  });

  it("rejects an unknown theme", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { theme: "neon" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a non-string theme", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { theme: 42 as any });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("accepts every supported language", async () => {
    for (const lang of ["en", "id", "sv"]) {
      const result = await updateAppSettings(env as any, TEST_IDENTITY, { lang });
      expect(result.ok).toBe(true);
      const settings = await getAppSettings(env as any, TEST_IDENTITY);
      if (settings.ok) expect(settings.data.lang).toBe(lang);
    }
  });

  it("rejects an unsupported language", async () => {
    const result = await updateAppSettings(env as any, TEST_IDENTITY, { lang: "xx" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("clamps a legacy stored theme outside the allowed set to null on read", async () => {
    // Rows written before write-side validation existed (or edited directly
    // in D1) must not leak unknown values to settings consumers.
    await env.DB.prepare(
      "INSERT INTO settings (identity, key, value) VALUES (?, 'theme', 'neon')",
    ).bind(TEST_IDENTITY).run();

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) expect(settings.data.theme).toBeNull();
  });

  it("clamps a legacy stored language outside the allowed set to null on read", async () => {
    await env.DB.prepare(
      "INSERT INTO settings (identity, key, value) VALUES (?, 'lang', 'xx')",
    ).bind(TEST_IDENTITY).run();

    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) expect(settings.data.lang).toBeNull();
  });
});

describe("API key title validation", () => {
  it("rejects a title longer than 120 characters", async () => {
    const result = await createNewApiKey(env as any, TEST_IDENTITY, {
      title: "x".repeat(121),
      scope: "create",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("accepts a title of exactly 120 characters", async () => {
    const result = await createNewApiKey(env as any, TEST_IDENTITY, {
      title: "x".repeat(120),
      scope: "create",
    });
    expect(result.ok).toBe(true);
  });
});
