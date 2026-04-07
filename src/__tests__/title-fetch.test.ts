import { describe, expect, it } from "vitest";
import { extractTitle } from "../title-fetch";

describe("extractTitle", () => {
  it("extracts a plain title", () => {
    expect(extractTitle("<html><head><title>Hello World</title></head></html>")).toBe("Hello World");
  });

  it("extracts title with attributes on the tag", () => {
    expect(extractTitle('<title lang="en">My Page</title>')).toBe("My Page");
  });

  it("returns null when no title tag exists", () => {
    expect(extractTitle("<html><head></head><body></body></html>")).toBeNull();
  });

  it("returns null for empty title", () => {
    expect(extractTitle("<title></title>")).toBeNull();
  });

  it("returns null for whitespace-only title", () => {
    expect(extractTitle("<title>   </title>")).toBeNull();
  });

  it("collapses whitespace and trims", () => {
    expect(extractTitle("<title>  Hello \n  World  </title>")).toBe("Hello World");
  });

  it("decodes HTML entities", () => {
    expect(extractTitle("<title>Tom &amp; Jerry &#39;s</title>")).toBe("Tom & Jerry 's");
  });

  it("handles multiline title", () => {
    const html = `<title>
      My Great
      Blog Post
    </title>`;
    expect(extractTitle(html)).toBe("My Great Blog Post");
  });

  it("extracts title case-insensitively", () => {
    expect(extractTitle("<TITLE>Upper Case</TITLE>")).toBe("Upper Case");
  });
});
