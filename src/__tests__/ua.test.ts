import { describe, it, expect } from "vitest";
import { parseDeviceType, parseBrowser, parseOS } from "../ua";

describe("parseDeviceType", () => {
  it("should detect Mobile Safari as mobile", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("mobile");
  });

  it("should detect Android phone as mobile", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("mobile");
  });

  it("should detect Chrome desktop as desktop", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("desktop");
  });

  it("should detect iPad as tablet", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1"
      )
    ).toBe("tablet");
  });

  it("should detect Android tablet as tablet", () => {
    expect(
      parseDeviceType(
        "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("tablet");
  });

  it("should default to desktop for empty UA", () => {
    expect(parseDeviceType("")).toBe("desktop");
  });
});

describe("parseBrowser", () => {
  it("should detect Chrome", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("Chrome");
  });

  it("should detect Safari", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("Safari");
  });

  it("should detect Firefox", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0"
      )
    ).toBe("Firefox");
  });

  it("should detect Edge (not Chrome)", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
      )
    ).toBe("Edge");
  });

  it("should detect Opera", () => {
    expect(
      parseBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0"
      )
    ).toBe("Opera");
  });

  it("should return Other for empty UA", () => {
    expect(parseBrowser("")).toBe("Other");
  });

  it("should return Other for unknown UA", () => {
    expect(parseBrowser("curl/7.68.0")).toBe("Other");
  });
});

describe("parseOS", () => {
  it("should detect iOS from iPhone UA", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("ios");
  });

  it("should detect iOS from iPad UA", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1"
      )
    ).toBe("ios");
  });

  it("should detect Android", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("android");
  });

  it("should detect Windows", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("windows");
  });

  it("should detect macOS", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("macos");
  });

  it("should detect Linux (not Android)", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("linux");
  });

  it("should detect ChromeOS", () => {
    expect(
      parseOS(
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe("chromeos");
  });

  it("should return other for empty UA", () => {
    expect(parseOS("")).toBe("other");
  });

  it("should return other for unknown UA", () => {
    expect(parseOS("curl/7.68.0")).toBe("other");
  });
});
