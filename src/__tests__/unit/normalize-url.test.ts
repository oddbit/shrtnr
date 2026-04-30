import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../../normalize-url";

describe("normalizeUrl", () => {
  it("strips a trailing slash", () => {
    expect(normalizeUrl("https://www.npmjs.com/package/@oddbit/shrtnr/")).toBe(
      "https://www.npmjs.com/package/@oddbit/shrtnr",
    );
  });

  it("strips a trailing hash without an anchor", () => {
    expect(normalizeUrl("https://www.npmjs.com/package/@oddbit/shrtnr#")).toBe(
      "https://www.npmjs.com/package/@oddbit/shrtnr",
    );
  });

  it("strips a trailing question mark without parameters", () => {
    expect(normalizeUrl("https://www.npmjs.com/package/@oddbit/shrtnr?")).toBe(
      "https://www.npmjs.com/package/@oddbit/shrtnr",
    );
  });

  it("strips multiple trailing non-purpose characters", () => {
    expect(normalizeUrl("https://example.com/path/?#")).toBe(
      "https://example.com/path",
    );
  });

  it("preserves a URL with a sub-path after trailing slash", () => {
    expect(normalizeUrl("https://www.npmjs.com/package/@oddbit/shrtnr/sub-path")).toBe(
      "https://www.npmjs.com/package/@oddbit/shrtnr/sub-path",
    );
  });

  it("preserves a URL with a page anchor", () => {
    expect(normalizeUrl("https://www.npmjs.com/package/@oddbit/shrtnr#some-page-anchor")).toBe(
      "https://www.npmjs.com/package/@oddbit/shrtnr#some-page-anchor",
    );
  });

  it("preserves a URL with query parameters", () => {
    expect(normalizeUrl("https://www.npmjs.com/package/@oddbit/shrtnr?some-parameter=value")).toBe(
      "https://www.npmjs.com/package/@oddbit/shrtnr?some-parameter=value",
    );
  });

  it("preserves a clean URL without trailing characters", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("strips trailing slash from root domain", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("preserves query parameters with a trailing hash", () => {
    expect(normalizeUrl("https://example.com?foo=bar#")).toBe(
      "https://example.com?foo=bar",
    );
  });

  it("preserves anchor with a trailing question mark before it", () => {
    expect(normalizeUrl("https://example.com#section")).toBe(
      "https://example.com#section",
    );
  });
});
