// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { pageWindow, paginationItems } from "../../pages/links";

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

describe("links page window", () => {
  it("clamps a total below one page to page 1 and a non-negative row range", () => {
    // An htmx partial computing Math.ceil(0 / perPage) hands over totalPages: 0.
    // Without the clamp currentPage lands on 0 and start on -perPage, which
    // renders "-24 - 0 of 0" and links to page=0.
    expect(pageWindow(1, 25, 0)).toEqual({ currentPage: 1, pageCount: 1, perPage: 25, start: 0 });
  });

  it("clamps a page past the end onto the last page", () => {
    expect(pageWindow(9, 25, 3)).toEqual({ currentPage: 3, pageCount: 3, perPage: 25, start: 50 });
  });

  it("clamps a page below the first onto page 1", () => {
    expect(pageWindow(0, 25, 3)).toEqual({ currentPage: 1, pageCount: 3, perPage: 25, start: 0 });
    expect(pageWindow(-4, 25, 3)).toEqual({ currentPage: 1, pageCount: 3, perPage: 25, start: 0 });
  });

  it("floors a non-positive per-page to one row rather than a zero-width window", () => {
    expect(pageWindow(2, 0, 5)).toEqual({ currentPage: 2, pageCount: 5, perPage: 1, start: 1 });
  });

  it("leaves an oversized per-page alone, since the service owns the upper bound", () => {
    expect(pageWindow(1, 1000, 1).perPage).toBe(1000);
  });

  it("survives unparseable inputs", () => {
    expect(pageWindow(NaN, NaN, NaN)).toEqual({ currentPage: 1, pageCount: 1, perPage: 1, start: 0 });
  });
});
