import { describe, expect, it, vi, afterEach } from "vitest";
import { extractTitle, fetchPageTitle, isPublicHttpUrl } from "../../title-fetch";

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

function htmlResponse(title: string): Response {
  return new Response(`<html><head><title>${title}</title></head><body></body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe("fetchPageTitle SSRF guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a public https URL and returns its title", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse("Public Page"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/article")).toBe("Public Page");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/article");
  });

  const blocked: [string, string][] = [
    ["non-http scheme (ftp)", "ftp://example.com/"],
    ["non-http scheme (file)", "file:///etc/passwd"],
    ["non-http scheme (gopher)", "gopher://example.com/"],
    ["unparsable URL", "not a url"],
    ["localhost", "http://localhost/admin"],
    ["localhost subdomain", "http://db.localhost/"],
    [".internal hostname", "http://metadata.google.internal/computeMetadata/v1/"],
    [".local hostname", "http://printer.local/"],
    ["IPv4 loopback", "http://127.0.0.1:8787/"],
    ["IPv4 loopback, other address in /8", "http://127.1.2.3/"],
    ["IPv4 loopback as a decimal integer", "http://2130706433/"],
    ["IPv4 loopback as hex octets", "http://0x7f.0.0.1/"],
    ["unspecified 0.0.0.0", "http://0.0.0.0/"],
    ["RFC 1918 10/8", "http://10.0.0.5/"],
    ["RFC 1918 172.16/12", "http://172.31.255.254/"],
    ["RFC 1918 192.168/16", "http://192.168.1.1/"],
    ["link-local / cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["shared address space 100.64/10", "http://100.127.0.1/"],
    ["multicast", "http://224.0.0.1/"],
    ["broadcast", "http://255.255.255.255/"],
    ["IPv6 loopback", "http://[::1]/"],
    ["IPv6 unspecified", "http://[::]/"],
    ["IPv6 unique local fc00::/7", "http://[fd12:3456::1]/"],
    ["IPv6 link-local fe80::/10", "http://[fe80::1]/"],
    ["IPv4-mapped IPv6 loopback", "http://[::ffff:127.0.0.1]/"],
    ["IPv4-mapped IPv6 private", "http://[::ffff:10.0.0.1]/"],
    ["NAT64 prefix wrapping loopback", "http://[64:ff9b::7f00:1]/"],
  ];

  for (const [label, url] of blocked) {
    it(`refuses to fetch ${label}: ${url}`, async () => {
      const fetchMock = vi.fn().mockResolvedValue(htmlResponse("Should Not Be Read"));
      vi.stubGlobal("fetch", fetchMock);

      expect(await fetchPageTitle(url)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it("does not let the server follow redirects on its own", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse("Page"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPageTitle("https://example.com/");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("follows a redirect to another public host and reads the title there", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("https://www.example.org/landing"))
      .mockResolvedValueOnce(htmlResponse("Landing"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/")).toBe("Landing");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://www.example.org/landing");
  });

  it("resolves a relative redirect against the current URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("/moved"))
      .mockResolvedValueOnce(htmlResponse("Moved"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/old")).toBe("Moved");
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.com/moved");
  });

  it("refuses a redirect that lands on a private address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("http://169.254.169.254/latest/meta-data/"))
      .mockResolvedValue(htmlResponse("Metadata"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to a non-http scheme", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("file:///etc/hosts"))
      .mockResolvedValue(htmlResponse("Hosts"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up on a redirect loop instead of following it forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue(redirectResponse("https://example.com/loop"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/loop")).toBeNull();
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("returns null on a redirect without a Location header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPageTitle("https://example.com/")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("isPublicHttpUrl", () => {
  it("accepts public hostnames and public IP literals", () => {
    expect(isPublicHttpUrl("https://example.com/")).toBe(true);
    expect(isPublicHttpUrl("http://93.184.216.34/")).toBe(true);
    expect(isPublicHttpUrl("https://[2606:2800:220:1:248:1893:25c8:1946]/")).toBe(true);
    expect(isPublicHttpUrl("http://172.15.255.255/")).toBe(true);
    expect(isPublicHttpUrl("http://172.32.0.1/")).toBe(true);
  });

  it("rejects private, loopback, link-local and non-http targets", () => {
    expect(isPublicHttpUrl("http://127.0.0.1/")).toBe(false);
    expect(isPublicHttpUrl("http://172.16.0.1/")).toBe(false);
    expect(isPublicHttpUrl("http://[::1]/")).toBe(false);
    expect(isPublicHttpUrl("ftp://example.com/")).toBe(false);
    expect(isPublicHttpUrl("nope")).toBe(false);
  });
});
