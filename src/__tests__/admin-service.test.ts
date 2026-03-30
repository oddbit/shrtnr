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

  it("rejects unsupported preference theme", async () => {
    const result = await updateUserPreferences(env as any, "user@example.com", { theme: "neon" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/Invalid theme/);
    }
  });
});
