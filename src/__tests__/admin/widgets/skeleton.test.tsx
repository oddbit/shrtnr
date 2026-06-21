// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { Skeleton } from "../../../admin/widgets/skeleton";

function html(node: unknown): string {
  return String(node);
}

describe("Skeleton", () => {
  it("renders a shimmer block for the chart shape", () => {
    const out = html(Skeleton({ shape: "chart" }));
    expect(out).toContain("widget-skeleton");
    expect(out).toContain("shimmer");
  });

  it("renders multiple rows for the list shape", () => {
    const out = html(Skeleton({ shape: "list" }));
    expect((out.match(/skel-row/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
