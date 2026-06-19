// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { StatBar } from "../../../components/stat-bar";

describe("StatBar", () => {
  it("computes percent width from count and max", () => {
    const out = String(StatBar({ name: "US", count: 5, max: 10, color: "orange", lang: "en" }));
    expect(out).toContain("width:50%");
    expect(out).toContain("US");
  });
});
