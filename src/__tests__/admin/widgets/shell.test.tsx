// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { Widget } from "../../../admin/widgets/shell";

describe("Widget placeholder", () => {
  it("emits hx-get with the range and a chart-shape skeleton", () => {
    const out = String(Widget({ id: "dashboard.timeline", range: "30d" }));
    expect(out).toContain('hx-get="/_/admin/w/dashboard.timeline?range=30d"');
    expect(out).toContain("range:changed from:body");
    expect(out).toContain("widget-skeleton");
    expect(out).toContain("skel-chart"); // timeline is a chart shape
    expect(out).toContain("bento-card"); // non-kpi shapes use the bento-card container
  });

  it("uses the kpi-strip container and adds the poll trigger for the kpi shape", () => {
    const out = String(
      Widget({ id: "dashboard.kpis", range: "30d", poll: true }),
    );
    expect(out).toContain("kpi-strip");
    expect(out).toContain("skel-kpi");
    expect(out).not.toContain("bento-card"); // kpi strip is a flex row, not a bento-card
    expect(out).toContain("every 30s");
  });
});
