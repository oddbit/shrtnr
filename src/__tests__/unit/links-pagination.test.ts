// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { paginationItems } from "../../pages/links";

describe("links pagination window", () => {
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
