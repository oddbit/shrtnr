// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { emptyStateCopy } from "../../pages/links";
import { createTranslateFn } from "../../i18n";

const t = createTranslateFn("en");

describe("links empty state copy", () => {
  it("names both the query and the filter when each is narrowing", () => {
    expect(emptyStateCopy(t, "no-search-matches", "zzz", "disabled")).toBe(
      'No links match "zzz" in Disabled.',
    );
    expect(emptyStateCopy(t, "no-search-matches", "zzz", "active")).toBe(
      'No links match "zzz" in Active.',
    );
  });

  it("names only the query when the all filter hides nothing", () => {
    expect(emptyStateCopy(t, "no-search-matches", "zzz", "all")).toBe('No links match "zzz".');
  });

  it("blames the filter when no search is active", () => {
    expect(emptyStateCopy(t, "no-matches", "", "disabled")).toBe(
      "No links match the current filter.",
    );
  });

  it("trims the query before naming it", () => {
    expect(emptyStateCopy(t, "no-search-matches", "  zzz  ", "all")).toBe('No links match "zzz".');
  });

  it("falls back to the filter copy if a search reason arrives with no query", () => {
    // The service only emits no-search-matches for a query that survives a
    // trim, so this pairing should be unreachable. Naming an empty query back
    // to the user is worse than the generic line, so guard it anyway.
    expect(emptyStateCopy(t, "no-search-matches", "   ", "all")).toBe(
      "No links match the current filter.",
    );
  });

  it("clamps a long query so the empty state stays one readable line", () => {
    const copy = emptyStateCopy(t, "no-search-matches", "z".repeat(500), "all");
    expect(copy.length).toBeLessThan(120);
    expect(copy).toContain("…");
  });

  it("keeps the all-disabled claim for an expired catalog", () => {
    expect(emptyStateCopy(t, "all-disabled", "", "active")).toContain("All links are disabled");
  });

  it("falls back to the first-run copy for an empty catalog", () => {
    expect(emptyStateCopy(t, "no-links", "", "active")).toContain("No links yet");
    expect(emptyStateCopy(t, undefined, "", "active")).toContain("No links yet");
  });
});
