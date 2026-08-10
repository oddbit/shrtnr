import { describe, expect, it, vi, afterEach } from "vitest";
import { extractTitle, fetchPageTitle } from "../../title-fetch";

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

describe("fetchPageTitle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drains the response body when content-type is not HTML", async () => {
    // Left open (not closed) after the first chunk, like a real streamed
    // response: cancel() only invokes the underlying source's cancel
    // algorithm while the stream is still readable, not once it has closed.
    let cancelCalled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("%PDF-1.4 binary data"));
      },
      cancel() {
        cancelCalled = true;
      },
    });
    const res = new Response(stream, { headers: { "content-type": "application/pdf" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));

    const result = await fetchPageTitle("https://example.com/file.pdf");

    expect(result).toBeNull();
    expect(cancelCalled).toBe(true);
  });
});
