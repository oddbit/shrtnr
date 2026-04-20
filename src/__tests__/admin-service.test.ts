import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import {
  createNewApiKey,
  getAppSettings,
  updateAppSettings,
} from "../services/admin-management";

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

  it("returns null default_range when not set", async () => {
    const settings = await getAppSettings(env as any, TEST_IDENTITY);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.default_range).toBeNull();
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
});
