import { describe, expect, it } from "vitest";
import {
  ACCESS_METHOD_OPTIONS,
  fillMissingOptions,
} from "../../analytics-fill";

describe("fillMissingOptions", () => {
  it("adds missing options as zero-count entries", () => {
    const out = fillMissingOptions([], ACCESS_METHOD_OPTIONS);
    expect(out).toEqual([
      { name: "link", count: 0 },
      { name: "qr", count: 0 },
    ]);
  });

  it("keeps existing entries unchanged and appends only missing ones", () => {
    const out = fillMissingOptions(
      [{ name: "link", count: 111 }],
      ACCESS_METHOD_OPTIONS,
    );
    expect(out).toEqual([
      { name: "link", count: 111 },
      { name: "qr", count: 0 },
    ]);
  });

  it("returns items unchanged when every always-on option is present", () => {
    const items = [
      { name: "link", count: 80 },
      { name: "qr", count: 20 },
    ];
    const out = fillMissingOptions(items, ACCESS_METHOD_OPTIONS);
    expect(out).toEqual(items);
  });

  it("preserves the incoming order", () => {
    const out = fillMissingOptions(
      [{ name: "qr", count: 3 }],
      ACCESS_METHOD_OPTIONS,
    );
    expect(out.map((o) => o.name)).toEqual(["qr", "link"]);
  });
});
