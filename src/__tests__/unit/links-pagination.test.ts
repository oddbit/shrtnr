// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { paginationItems } from "../../pages/links";

describe("links pagination window", () => {
  it("falls through to the near-end window at the 8-page boundary", () => {
    // 8 is the smallest total the compact window applies to, and the one total
    // where the centered branch is unreachable: page 5 is both > 4 and >= 8 - 3.
    expect(paginationItems(5, 8)).toEqual([1, "ellipsis", 4, 5, 6, 7, 8]);
    expect(paginationItems(4, 8)).toEqual([1, 2, 3, 4, 5, "ellipsis", 8]);
  });

  it("clamps a total below one page to a single-page window", () => {
    expect(paginationItems(1, 0)).toEqual([1]);
  });

  it("clamps a current page outside the total into range", () => {
    expect(paginationItems(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationItems(400, 188)).toEqual([
      1,
      "ellipsis",
      184,
      185,
      186,
      187,
      188,
    ]);
  });

  it("shows every page when the result fits in the compact window", () => {
    expect(paginationItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first pages and last page visible near the start", () => {
    expect(paginationItems(1, 188)).toEqual([1, 2, 3, 4, 5, "ellipsis", 188]);
  });

  it("centers the current page between stable first and last links", () => {
    expect(paginationItems(94, 188)).toEqual([
      1,
      "ellipsis",
      93,
      94,
      95,
      "ellipsis",
      188,
    ]);
  });

  it("keeps the first page and last pages visible near the end", () => {
    expect(paginationItems(188, 188)).toEqual([
      1,
      "ellipsis",
      184,
      185,
      186,
      187,
      188,
    ]);
  });
});
