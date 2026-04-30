// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { okWithRange, RANGE_LABELS, rangeNote } from "../../mcp/server";

function parseBody(result: ReturnType<typeof okWithRange>): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  const text = result.content[0]?.text;
  expect(typeof text).toBe("string");
  return JSON.parse(text!) as Record<string, unknown>;
}

describe("okWithRange", () => {
  it("front-loads range_used, range_label, and range_note for scoped ranges", () => {
    const body = parseBody(okWithRange("7d", { total_clicks: 42 }));
    const keys = Object.keys(body);
    expect(keys[0]).toBe("range_used");
    expect(keys[1]).toBe("range_label");
    expect(keys[2]).toBe("range_note");
    expect(body.range_used).toBe("7d");
    expect(body.range_label).toBe(RANGE_LABELS["7d"]);
    expect(body.total_clicks).toBe(42);
  });

  it("explains the scope in plain English for time-bounded ranges", () => {
    expect(rangeNote("30d")).toMatch(/last 30 days/);
    expect(rangeNote("30d")).toMatch(/NOT included/);
  });

  it("explains the all-time case differently", () => {
    expect(rangeNote("all")).toMatch(/all clicks/);
    expect(rangeNote("all")).not.toMatch(/NOT included/);
  });

  it("preserves nested data fields on object payloads", () => {
    const body = parseBody(okWithRange("90d", { results: [{ name: "US", count: 5 }], extra: true }));
    expect(body.range_used).toBe("90d");
    expect(body.results).toEqual([{ name: "US", count: 5 }]);
    expect(body.extra).toBe(true);
  });

  it("wraps non-object payloads under a `data` key", () => {
    const body = parseBody(okWithRange("24h", [1, 2, 3]));
    expect(body.range_used).toBe("24h");
    expect(body.data).toEqual([1, 2, 3]);
  });

  it("uses 'all time' label when range is all", () => {
    const body = parseBody(okWithRange("all", { total_clicks: 100 }));
    expect(body.range_label).toBe("all time");
  });

  it("provides a label for every TimelineRange value", () => {
    const ranges = ["24h", "7d", "30d", "90d", "1y", "all"] as const;
    for (const r of ranges) {
      expect(RANGE_LABELS[r]).toBeTruthy();
    }
  });
});
