import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import {
  createApiKeyForUser,
  getAppSettings,
  updateAppSettings,
  updateUserPreferences,
} from "../services/admin-management";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("admin-management service", () => {
  it("rejects invalid API key scope", async () => {
    const result = await createApiKeyForUser(env as any, "user@example.com", {
      title: "Bad",
      scope: "admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Scope must be one of/);
    }
  });

  it("rejects invalid slug default length", async () => {
    const result = await updateAppSettings(env as any, { slug_default_length: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("updates settings and returns persisted value", async () => {
    const updated = await updateAppSettings(env as any, { slug_default_length: 5 });
    expect(updated.ok).toBe(true);

    const settings = await getAppSettings(env as any);
    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.slug_default_length).toBe(5);
    }
  });

  it("returns hardcoded default when setting is missing", async () => {
    await env.DB.exec("DELETE FROM settings WHERE key = 'slug_default_length'");

    const settings = await getAppSettings({ DB: env.DB } as any);

    expect(settings.ok).toBe(true);
    if (settings.ok) {
      expect(settings.data.slug_default_length).toBe(3);
    }
  });

  it("rejects unsupported preference theme", async () => {
    const result = await updateUserPreferences(env as any, "user@example.com", { theme: "neon" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Invalid theme/);
    }
  });

  it("rejects unsupported language preference", async () => {
    const result = await updateUserPreferences(env as any, "user@example.com", { language: "fr" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Invalid language/);
    }
  });

  it("accepts and persists a supported language", async () => {
    const result = await updateUserPreferences(env as any, "user@example.com", { language: "id" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.language).toBe("id");
    }
  });

  it("accepts Swedish language", async () => {
    const result = await updateUserPreferences(env as any, "user@example.com", { language: "sv" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.language).toBe("sv");
    }
  });

  it("saves language and theme independently", async () => {
    await updateUserPreferences(env as any, "user@example.com", { theme: "dark" });
    const result = await updateUserPreferences(env as any, "user@example.com", { language: "sv" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.theme).toBe("dark");
      expect(result.data.language).toBe("sv");
    }
  });
});
