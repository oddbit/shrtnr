// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/** Redirect hops fetchPageTitle() follows before giving up. */
const MAX_REDIRECTS = 5;

/**
 * Decides whether the server may fetch this URL on the user's behalf.
 *
 * Link URLs are user-supplied, so this fetch is a server-side request
 * forgery surface: without a guard, a link pointing at a loopback, RFC 1918,
 * link-local or cloud-metadata address would have the Worker fetch it and
 * store the response's <title> where the link's owner can read it.
 * Cloudflare Workers already refuse most such destinations, but the guard
 * does not rely on that: only http(s) URLs whose host is a public name or
 * a public IP literal pass.
 *
 * Hostnames are not resolved here (Workers expose no DNS lookup), so a
 * public name that resolves to a private address is not caught. That gap
 * is closed by the platform's own egress restrictions.
 */
export function isPublicHttpUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;

  if (host.startsWith("[") && host.endsWith("]")) {
    const groups = parseIPv6(host.slice(1, -1));
    return groups !== null && !isReservedIPv6(groups);
  }

  // URL parsing already normalized decimal, octal and hex IPv4 spellings
  // (2130706433, 0x7f.0.0.1, 0177.0.0.1) into dotted quads, so one check
  // on the normalized form covers every spelling.
  const octets = parseIPv4(host);
  if (octets) return !isReservedIPv4(octets);

  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;
  return true;
}

function parseIPv4(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

function isReservedIPv4([a, b]: number[]): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this" network
  if (a === 10) return true; // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 shared address space
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, cloud metadata endpoints
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments, 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** Expands an IPv6 literal (without brackets) into eight 16-bit groups. */
function parseIPv6(host: string): number[] | null {
  // Embedded dotted-quad tail (::ffff:127.0.0.1): fold it into two groups.
  const lastColon = host.lastIndexOf(":");
  const tail = host.slice(lastColon + 1);
  if (tail.includes(".")) {
    const octets = parseIPv4(tail);
    if (!octets) return null;
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    host = `${host.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = host.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const g of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !rest) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array(missing).fill(0), ...rest];
}

function isReservedIPv6(g: number[]): boolean {
  const leadingZero = g.slice(0, 5).every((x) => x === 0);
  // :: (unspecified) and ::1 (loopback)
  if (leadingZero && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true;
  // ::ffff:a.b.c.d IPv4-mapped: judge the embedded IPv4 address
  if (leadingZero && g[5] === 0xffff) return isReservedIPv4(groupsToIPv4(g[6], g[7]));
  // 64:ff9b::/96 NAT64: same, the last 32 bits are an IPv4 address
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isReservedIPv4(groupsToIPv4(g[6], g[7]));
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

function groupsToIPv4(hi: number, lo: number): number[] {
  return [hi >>> 8, hi & 0xff, lo >>> 8, lo & 0xff];
}

/**
 * Fetches the page at the given URL and extracts the <title> content.
 * Returns null if the page cannot be fetched, points at a non-public
 * address, or has no title. Redirects are followed by hand so every hop
 * passes the same public-address check as the starting URL.
 */
export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    let current = url;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isPublicHttpUrl(current)) return null;
      const candidate = await fetch(current, {
        headers: { "User-Agent": "Shrtnr/1.0 (link preview)" },
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      if (candidate.status < 300 || candidate.status > 399) {
        res = candidate;
        break;
      }
      await candidate.body?.cancel();
      const location = candidate.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
    }
    if (!res) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      // Drain the body instead of abandoning it: most destination URLs are
      // not HTML (APIs, PDFs, images, ...), and this runs on every link
      // creation, so leaving the stream open here leaks it on the common path.
      await res.body?.cancel();
      return null;
    }

    // Read only the first 16KB to find the title without downloading the full page
    const reader = res.body?.getReader();
    if (!reader) return null;

    let html = "";
    const decoder = new TextDecoder();
    const maxBytes = 16384;
    let totalBytes = 0;

    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      totalBytes += value.byteLength;

      // Stop early once we pass </head> or find a </title>
      if (html.includes("</title>") || html.includes("</head>")) break;
    }
    reader.cancel();

    return extractTitle(html);
  } catch {
    return null;
  }
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;

  const raw = match[1]
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .trim();

  return raw || null;
}
