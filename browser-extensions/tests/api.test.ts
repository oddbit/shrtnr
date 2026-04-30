// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setStorageItem } from "./setup";
import { isShortenable, ShortenResult } from "../src/api";

let mockedClient: {
  links: {
    create: ReturnType<typeof vi.fn>;
    qr: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
};

vi.mock("@oddbit/shrtnr", async () => {
  class ShrtnrError extends Error {
    constructor(public status: number, public serverMessage: string) {
      super(`shrtnr API error (HTTP ${status}): ${serverMessage}`);
      this.name = "ShrtnrError";
    }
  }
  return {
    ShrtnrClient: class {
      links = mockedClient.links;
      slugs = {};
      bundles = {};
    },
    ShrtnrError,
  };
});

beforeEach(() => {
  mockedClient = {
    links: {
      create: vi.fn(),
      qr: vi.fn(),
      list: vi.fn(),
    },
  };
});

describe("api.isShortenable", () => {
  it.each([
    ["https://example.com/page", true],
    ["http://example.com/page", true],
    ["https://example.com", true],
    ["chrome://newtab/", false],
    ["chrome-extension://abc/popup.html", false],
    ["about:blank", false],
    ["about:newtab", false],
    ["moz-extension://abc/popup.html", false],
    ["edge://settings", false],
    ["view-source:https://example.com", false],
    ["file:///Users/foo/bar.html", false],
    ["data:text/plain,hello", false],
    ["javascript:alert(1)", false],
    ["", false],
    ["   ", false],
    ["not a url at all", false],
  ])("isShortenable(%s) -> %s", (input, expected) => {
    expect(isShortenable(input)).toBe(expected);
  });
});

describe("api.createClient", () => {
  it("returns null when no config is saved", async () => {
    const { createClient } = await import("../src/api");
    expect(await createClient()).toBeNull();
  });

  it("returns a client when config is present", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    const { createClient } = await import("../src/api");
    const client = await createClient();
    expect(client).not.toBeNull();
  });
});

describe("api.shortenUrl", () => {
  it("rejects internal pages synchronously without calling SDK", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    const { shortenUrl } = await import("../src/api");
    await expect(shortenUrl("chrome://newtab")).rejects.toMatchObject({
      category: "internal-page",
    });
    expect(mockedClient.links.create).not.toHaveBeenCalled();
  });

  it("rejects unparseable URLs", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    const { shortenUrl } = await import("../src/api");
    await expect(shortenUrl("not a url")).rejects.toMatchObject({
      category: "internal-page",
    });
  });

  it("calls SDK and returns ShortenResult on success", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    mockedClient.links.create.mockResolvedValueOnce({
      id: 42,
      url: "https://example.com/page",
      slugs: [{ slug: "abc" }],
    });
    const { shortenUrl } = await import("../src/api");
    const result: ShortenResult = await shortenUrl("https://example.com/page");
    expect(result).toEqual({
      id: 42,
      slug: "abc",
      shortUrl: "https://x.com/abc",
    });
    expect(mockedClient.links.create).toHaveBeenCalledWith({ url: "https://example.com/page" });
  });

  it("throws when no config is saved", async () => {
    const { shortenUrl } = await import("../src/api");
    await expect(shortenUrl("https://example.com/page")).rejects.toThrow(/not configured/i);
  });

  it("throws ExtensionError with correct category for each SDK error status", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    const { shortenUrl } = await import("../src/api");
    const { ShrtnrError } = await import("@oddbit/shrtnr");

    const cases: Array<[number, string]> = [
      [0, "network"],
      [401, "unauthorized"],
      [403, "forbidden"],
      [404, "not-found"],
      [429, "rate-limited"],
      [422, "validation"],
      [400, "validation"],
      [500, "server"],
      [503, "server"],
    ];

    for (const [status, expectedCategory] of cases) {
      mockedClient.links.create.mockRejectedValueOnce(new ShrtnrError(status, "msg"));
      await expect(shortenUrl("https://example.com")).rejects.toMatchObject({
        category: expectedCategory,
        status,
        serverMessage: "msg",
      });
    }
  });
});

describe("api.getQrSvg", () => {
  it("calls SDK qr() with the configured size", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    mockedClient.links.qr.mockResolvedValueOnce("<svg/>");
    const { getQrSvg } = await import("../src/api");
    const svg = await getQrSvg(42);
    expect(svg).toBe("<svg/>");
    expect(mockedClient.links.qr).toHaveBeenCalledWith(42, expect.objectContaining({ size: "256" }));
  });

  it("throws when no config is saved", async () => {
    const { getQrSvg } = await import("../src/api");
    await expect(getQrSvg(42)).rejects.toThrow(/not configured/i);
  });
});

describe("api.testConnection", () => {
  it("calls links.list and resolves on success", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    mockedClient.links.list.mockResolvedValueOnce([]);
    const { testConnection } = await import("../src/api");
    await expect(testConnection({ baseUrl: "https://x.com", apiKey: "sk_abc" })).resolves.toBeUndefined();
  });

  it("throws ExtensionError on auth failure", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    const { ShrtnrError } = await import("@oddbit/shrtnr");
    mockedClient.links.list.mockRejectedValueOnce(new ShrtnrError(401, "bad key"));
    const { testConnection } = await import("../src/api");
    await expect(
      testConnection({ baseUrl: "https://x.com", apiKey: "sk_abc" }),
    ).rejects.toMatchObject({ category: "unauthorized" });
  });
});
