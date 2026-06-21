// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { adminStyles } from "../../styles";

describe("skel-kpi reserved height", () => {
  // The loaded KPI card is .bento-card.kpi: .kpi min-height 104px + bento-card
  // padding 1.25rem x2 (~40px) = ~144px. The skeleton must reserve the same so
  // the KPI row does not shift down when the real strip swaps in.
  it("reserves the loaded KPI strip height, not the old 96px", () => {
    expect(adminStyles).toContain(".skel-kpi { min-height: 144px; }");
    expect(adminStyles).not.toContain(".skel-kpi { min-height: 96px; }");
  });
});
