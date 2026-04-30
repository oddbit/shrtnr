// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { getConfig, setConfig, clearConfig, onConfigChange } from "../src/storage";
import { setStorageItem } from "./setup";

describe("storage.getConfig", () => {
  it("returns null when storage is empty", async () => {
    expect(await getConfig()).toBeNull();
  });

  it("returns null when only baseUrl is present", async () => {
    setStorageItem("config", { baseUrl: "https://x.com" });
    expect(await getConfig()).toBeNull();
  });

  it("returns null when only apiKey is present", async () => {
    setStorageItem("config", { apiKey: "sk_x" });
    expect(await getConfig()).toBeNull();
  });

  it("returns the typed object when both fields present", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_x" });
    expect(await getConfig()).toEqual({ baseUrl: "https://x.com", apiKey: "sk_x" });
  });

  it("returns null when stored shape is wrong (defensive)", async () => {
    setStorageItem("config", "not-an-object");
    expect(await getConfig()).toBeNull();
  });
});

describe("storage.setConfig", () => {
  it("persists and getConfig returns the saved values", async () => {
    await setConfig({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    expect(await getConfig()).toEqual({ baseUrl: "https://x.com", apiKey: "sk_abc" });
  });

  it("normalizes baseUrl with path to its origin", async () => {
    await setConfig({ baseUrl: "https://x.com/admin", apiKey: "sk_abc" });
    expect(await getConfig()).toEqual({ baseUrl: "https://x.com", apiKey: "sk_abc" });
  });

  it("strips trailing slash from baseUrl", async () => {
    await setConfig({ baseUrl: "https://x.com/", apiKey: "sk_abc" });
    expect((await getConfig())?.baseUrl).toBe("https://x.com");
  });

  it("trims surrounding whitespace from apiKey", async () => {
    await setConfig({ baseUrl: "https://x.com", apiKey: "  sk_abc  " });
    expect((await getConfig())?.apiKey).toBe("sk_abc");
  });

  it("rejects unparseable baseUrl", async () => {
    await expect(setConfig({ baseUrl: "not a url", apiKey: "sk_abc" })).rejects.toThrow(
      /baseUrl/i,
    );
  });

  it("rejects baseUrl with non-http(s) protocol", async () => {
    await expect(setConfig({ baseUrl: "ftp://x.com", apiKey: "sk_abc" })).rejects.toThrow(
      /protocol/i,
    );
  });

  it("rejects empty apiKey", async () => {
    await expect(setConfig({ baseUrl: "https://x.com", apiKey: "" })).rejects.toThrow(
      /apiKey/i,
    );
  });

  it("rejects whitespace-only apiKey", async () => {
    await expect(setConfig({ baseUrl: "https://x.com", apiKey: "   " })).rejects.toThrow(
      /apiKey/i,
    );
  });
});

describe("storage.clearConfig", () => {
  it("removes the stored config", async () => {
    await setConfig({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    await clearConfig();
    expect(await getConfig()).toBeNull();
  });

  it("is idempotent on empty storage", async () => {
    await expect(clearConfig()).resolves.toBeUndefined();
  });
});

describe("storage.onConfigChange", () => {
  it("fires when config is set", async () => {
    let observed: unknown = "untouched";
    onConfigChange((c) => {
      observed = c;
    });
    await setConfig({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    expect(observed).toEqual({ baseUrl: "https://x.com", apiKey: "sk_abc" });
  });

  it("fires with null when config is cleared", async () => {
    await setConfig({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    let observed: unknown = "untouched";
    onConfigChange((c) => {
      observed = c;
    });
    await clearConfig();
    expect(observed).toBeNull();
  });

  it("unsubscribe stops further notifications", async () => {
    let count = 0;
    const unsub = onConfigChange(() => {
      count++;
    });
    await setConfig({ baseUrl: "https://x.com", apiKey: "sk_abc" });
    unsub();
    await setConfig({ baseUrl: "https://y.com", apiKey: "sk_def" });
    expect(count).toBe(1);
  });
});
