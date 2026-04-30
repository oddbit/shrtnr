import { describe, expect, it } from "vitest";
import { fmtNumber } from "../../i18n/format";

describe("fmtNumber", () => {
  it("uses comma thousands separators for en", () => {
    expect(fmtNumber(1234567, "en")).toBe("1,234,567");
  });

  it("uses dot thousands separators for id", () => {
    expect(fmtNumber(1234567, "id")).toBe("1.234.567");
  });

  it("groups thousands for sv", () => {
    // Swedish uses a space-like character as separator. Asserting it's not
    // comma (en) or dot (id) is enough to catch the regression where the
    // runtime default en-US leaks through.
    const out = fmtNumber(1234567, "sv");
    expect(out).not.toContain(",");
    expect(out).not.toContain(".");
    expect(out).toMatch(/1.234.567/); // any single separator character
  });

  it("formats zero and negative values", () => {
    expect(fmtNumber(0, "en")).toBe("0");
    expect(fmtNumber(-12345, "en")).toBe("-12,345");
  });

  it("leaves small numbers unseparated", () => {
    expect(fmtNumber(42, "en")).toBe("42");
    expect(fmtNumber(999, "id")).toBe("999");
  });
});
