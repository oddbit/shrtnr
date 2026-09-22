// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setStorageItem } from "./setup";
import { isValidSlug } from "../src/api";
import { categorizeStatus } from "../src/errors";

let mockedClient: {
  links: { qr: ReturnType<typeof vi.fn> };
  slugs: { add: ReturnType<typeof vi.fn> };
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
      slugs = mockedClient.slugs;
      bundles = {};
    },
    ShrtnrError,
  };
});

beforeEach(() => {
  mockedClient = {
    links: { qr: vi.fn() },
    slugs: { add: vi.fn() },
  };
});

describe("errors.categorizeStatus", () => {
  it("maps 409 to conflict", () => {
    expect(categorizeStatus(409)).toBe("conflict");
  });
});

describe("api.isValidSlug", () => {
  it.each([
    ["my-link", true],
    ["a", true],
    ["ABC123", true],
    ["a-b-c", true],
    ["-leading", false],
    ["trailing-", false],
    ["under_score", false],
    ["has space", false],
    ["", false],
    ["   ", false],
    ["a".repeat(128), true],
    ["a".repeat(129), false],
  ])("isValidSlug(%s) -> %s", (input, expected) => {
    expect(isValidSlug(input)).toBe(expected);
  });
});

describe("api.addCustomSlug", () => {
  beforeEach(() => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
  });

  it("rejects an invalid slug before calling the SDK", async () => {
    const { addCustomSlug } = await import("../src/api");
    await expect(addCustomSlug(42, "-bad-")).rejects.toMatchObject({ category: "slug-invalid" });
    expect(mockedClient.slugs.add).not.toHaveBeenCalled();
  });

  it("lowercases and trims the slug, then returns the new short URL", async () => {
    mockedClient.slugs.add.mockResolvedValueOnce({ linkId: 42, slug: "my-link", isCustom: 1 });
    const { addCustomSlug } = await import("../src/api");
    const result = await addCustomSlug(42, "  My-Link ");
    expect(mockedClient.slugs.add).toHaveBeenCalledWith(42, "my-link");
    expect(result).toEqual({ id: 42, slug: "my-link", shortUrl: "https://x.com/my-link" });
  });

  it("maps a 409 from the server to the conflict category", async () => {
    const { ShrtnrError } = await import("@oddbit/shrtnr");
    mockedClient.slugs.add.mockRejectedValueOnce(new ShrtnrError(409, "Slug already exists"));
    const { addCustomSlug } = await import("../src/api");
    await expect(addCustomSlug(42, "taken")).rejects.toMatchObject({
      category: "conflict",
      status: 409,
      serverMessage: "Slug already exists",
    });
  });

  it("throws when no config is saved", async () => {
    const { clearConfig } = await import("../src/storage");
    await clearConfig();
    const { addCustomSlug } = await import("../src/api");
    await expect(addCustomSlug(42, "ok")).rejects.toThrow(/not configured/i);
  });
});

describe("api.getQrSvg with a slug", () => {
  it("passes the slug through so the QR encodes the custom short URL", async () => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    mockedClient.links.qr.mockResolvedValueOnce("<svg/>");
    const { getQrSvg } = await import("../src/api");
    await getQrSvg(42, "my-link");
    expect(mockedClient.links.qr).toHaveBeenCalledWith(42, expect.objectContaining({ slug: "my-link" }));
  });
});
