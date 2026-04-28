// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { SettingRepository } from "../db";
import { resolveMcpRange } from "../services/admin-management";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("resolveMcpRange", () => {
  it("returns the explicit request when one is provided", async () => {
    await SettingRepository.set(env.DB, "alice@oddbit.id", "default_range", "7d");
    const range = await resolveMcpRange(env as never, "alice@oddbit.id", "30d");
    expect(range).toBe("30d");
  });

  it("falls back to the user's default_range when no request is given", async () => {
    await SettingRepository.set(env.DB, "alice@oddbit.id", "default_range", "90d");
    const range = await resolveMcpRange(env as never, "alice@oddbit.id");
    expect(range).toBe("90d");
  });

  it("falls back to 30d when no default_range is set", async () => {
    const range = await resolveMcpRange(env as never, "alice@oddbit.id");
    expect(range).toBe("30d");
  });

  it("ignores stale or invalid settings", async () => {
    await SettingRepository.set(env.DB, "alice@oddbit.id", "default_range", "garbage");
    const range = await resolveMcpRange(env as never, "alice@oddbit.id");
    expect(range).toBe("30d");
  });
});
