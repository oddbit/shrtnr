// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { countryName } from "../country";

describe("countryName", () => {
  it("should resolve US to a full country name in English", () => {
    const result = countryName("US", "en");
    expect(result).toBe("United States");
  });

  it("should resolve ID to a full country name in English", () => {
    const result = countryName("ID", "en");
    expect(result).toBe("Indonesia");
  });

  it("should resolve SE to a localized name in Swedish", () => {
    const result = countryName("SE", "sv");
    expect(result).toBe("Sverige");
  });

  it("should resolve US to a localized name in Indonesian", () => {
    const result = countryName("US", "id");
    expect(result).toBe("Amerika Serikat");
  });

  it("should return something for unknown codes without throwing", () => {
    const result = countryName("ZZ", "en");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should fall back to the raw code for empty string", () => {
    const result = countryName("", "en");
    expect(result).toBe("");
  });
});
