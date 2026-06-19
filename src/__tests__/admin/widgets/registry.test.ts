// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { getWidget, widgetsForPage } from "../../../admin/widgets/registry";

const DASHBOARD_IDS = [
  "dashboard.kpis",
  "dashboard.timeline",
  "dashboard.top-countries",
  "dashboard.top-links",
  "dashboard.top-domains",
  "dashboard.recent-links",
];

describe("widget registry", () => {
  it("returns undefined for an unknown id", () => {
    expect(getWidget("nope.nope")).toBeUndefined();
  });

  it("returns the registered widget for a known id", () => {
    const widget = getWidget("dashboard.kpis");
    expect(widget?.id).toBe("dashboard.kpis");
  });

  it("groups all six dashboard widgets by page prefix", () => {
    const ids = widgetsForPage("dashboard").map((w) => w.id);
    expect(new Set(ids)).toEqual(new Set(DASHBOARD_IDS));
    expect(ids).toHaveLength(DASHBOARD_IDS.length);
    expect(ids.every((id) => id.startsWith("dashboard."))).toBe(true);
  });

  it("returns no widgets for a page with no matches", () => {
    expect(widgetsForPage("nope")).toEqual([]);
  });
});
