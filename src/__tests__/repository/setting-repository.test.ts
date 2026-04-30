import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { SettingRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("SettingRepository.get", () => {
  it("returns the value for an existing setting", async () => {
    const val = await SettingRepository.get(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("3");
  });

  it("returns null for a non-existent setting", async () => {
    const val = await SettingRepository.get(env.DB, "anonymous", "nonexistent_key");
    expect(val).toBeNull();
  });

  it("returns null for an unknown identity", async () => {
    const val = await SettingRepository.get(env.DB, "unknown@example.com", "slug_default_length");
    expect(val).toBeNull();
  });
});

describe("SettingRepository.set", () => {
  it("persists a new setting", async () => {
    await SettingRepository.set(env.DB, "anonymous", "slug_default_length", "5");
    const val = await SettingRepository.get(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("5");
  });

  it("overwrites an existing setting", async () => {
    await SettingRepository.set(env.DB, "anonymous", "slug_default_length", "5");
    await SettingRepository.set(env.DB, "anonymous", "slug_default_length", "8");
    const val = await SettingRepository.get(env.DB, "anonymous", "slug_default_length");
    expect(val).toBe("8");
  });

  it("scopes settings by identity", async () => {
    await SettingRepository.set(env.DB, "user-a@example.com", "theme", "dark");
    await SettingRepository.set(env.DB, "user-b@example.com", "theme", "light");
    expect(await SettingRepository.get(env.DB, "user-a@example.com", "theme")).toBe("dark");
    expect(await SettingRepository.get(env.DB, "user-b@example.com", "theme")).toBe("light");
  });
});
