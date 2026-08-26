// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  D1_MAX_BOUND_PARAMS,
  LINKS_DEFAULT_PER_PAGE,
  LINKS_MAX_PER_PAGE,
  LINKS_PER_PAGE_OPTIONS,
} from "../../constants";

describe("links per-page bounds", () => {
  it("caps at the largest option the selector offers", () => {
    // A cap below the largest option would serve a clamped row count while the
    // selector renders no <option selected>, so the browser shows the first
    // option next to a differently sized table.
    expect(LINKS_MAX_PER_PAGE).toBe(Math.max(...LINKS_PER_PAGE_OPTIONS));
  });

  it("keeps every option inside D1's per-statement parameter cap", () => {
    // page() binds one parameter per served row to fetch that row's slugs, so
    // an option above the cap would fail the slug query outright.
    expect(LINKS_MAX_PER_PAGE).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
  });

  it("defaults to one of the offered options", () => {
    expect(LINKS_PER_PAGE_OPTIONS).toContain(LINKS_DEFAULT_PER_PAGE);
  });
});
