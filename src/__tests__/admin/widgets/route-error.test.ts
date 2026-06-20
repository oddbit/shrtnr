// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { widgetErrorFragment } from "../../../admin/widgets/route";

// The stub t echoes the key, so the output should carry the raw t-keys.
const echo = ((k: string) => k) as any;

describe("widgetErrorFragment", () => {
  it("builds a swap-friendly error card that targets the widget slot", () => {
    const html = widgetErrorFragment("dashboard.kpis", "range=30d", echo);

    // The error-card wrapper htmx swaps the failure into.
    expect(html).toContain("widget-error");
    // The echoed t-keys prove the copy routes through t().
    expect(html).toContain("widget.error");
    expect(html).toContain("widget.retry");
    // Retry re-fires the exact failed request (same id + query).
    expect(html).toContain('hx-get="/_/admin/w/dashboard.kpis?range=30d"');
    // The slot marker resolves for every widget shape, kpi-strip included.
    expect(html).toContain('hx-target="closest .widget-slot"');
  });

  it("omits the query string when there is none", () => {
    const html = widgetErrorFragment("dashboard.kpis", "", echo);
    expect(html).toContain('hx-get="/_/admin/w/dashboard.kpis"');
    expect(html).not.toContain("?");
  });

  it("escapes the query so a crafted value cannot break out of the hx-get attribute", () => {
    const html = widgetErrorFragment(
      "dashboard.kpis",
      'range=30d"><script>alert(1)</script>',
      echo,
    );
    // The breakout sequence must never appear verbatim in the markup.
    expect(html).not.toContain('"><script>');
    expect(html).not.toContain("<script>");
    // The dangerous characters are entity-escaped instead.
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;script&gt;");
  });
});
