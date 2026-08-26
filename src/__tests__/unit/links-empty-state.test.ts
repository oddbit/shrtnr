// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { emptyStateCopy } from "../../pages/links";
import { createTranslateFn } from "../../i18n";

const t = createTranslateFn("en");

describe("links empty state copy", () => {
  it("names the query when a search emptied the window", () => {
    expect(emptyStateCopy(t, "no-matches", "zzz")).toBe('No links match "zzz".');
  });

  it("blames the filter only when no search is active", () => {
    expect(emptyStateCopy(t, "no-matches", "")).toBe("No links match the current filter.");
  });

  it("treats a whitespace-only query as no query", () => {
    // A query of spaces empties the window without being something the copy
    // can name back to the user.
    expect(emptyStateCopy(t, "no-matches", "   ")).toBe("No links match the current filter.");
  });

  it("trims the query before naming it", () => {
    expect(emptyStateCopy(t, "no-matches", "  zzz  ")).toBe('No links match "zzz".');
  });

  it("clamps a long query so the empty state stays one readable line", () => {
    const copy = emptyStateCopy(t, "no-matches", "z".repeat(500));
    expect(copy.length).toBeLessThan(120);
    expect(copy).toContain("…");
  });

  it("keeps the all-disabled claim for an expired catalog", () => {
    expect(emptyStateCopy(t, "all-disabled", "")).toContain("All links are disabled");
  });

  it("falls back to the first-run copy for an empty catalog", () => {
    expect(emptyStateCopy(t, "no-links", "")).toContain("No links yet");
    expect(emptyStateCopy(t, undefined, "")).toContain("No links yet");
  });
});
