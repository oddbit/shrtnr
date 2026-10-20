// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The copy button and the QR modal run in the browser, which cannot read the
// Worker's environment, so the pinned origin reaches them as an attribute on
// the admin document. This runs the client script's own shortOrigin() helper
// against a stub document, which is the half of the rule the server cannot
// test: the page tests prove the attribute is rendered, this proves the
// script prefers it and still falls back to the host the admin was opened on.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";
import { extractTopLevelChunk } from "../client-script";

function loadShortOrigin(attribute: string | null, origin: string): () => string {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [extractTopLevelChunk(script, /^function shortOrigin\(/), "return shortOrigin;"].join("\n");
  const documentElement = {
    getAttribute: (name: string) => (name === "data-short-origin" ? attribute : null),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function("document", "location", code) as (d: unknown, l: unknown) => () => string;
  return factory({ documentElement }, { origin });
}

describe("client.ts shortOrigin()", () => {
  it("prefers the origin the server pinned", () => {
    expect(loadShortOrigin("https://c.example", "http://localhost:8797")()).toBe("https://c.example");
  });

  it("falls back to the host the admin was opened on", () => {
    expect(loadShortOrigin(null, "http://localhost:8797")()).toBe("http://localhost:8797");
  });

  it("treats an empty attribute as unset", () => {
    expect(loadShortOrigin("", "http://localhost:8797")()).toBe("http://localhost:8797");
  });
});

// ---- copyUrl ----
// navigator.clipboard is undefined outside a secure context, which is the
// plain-http LAN deployment SHORT_ORIGIN supports. A throw there was a dead
// button: no toast, no redirect. The guard lives in the shared copyText()
// helper, and the rejection is swallowed for the same reason. A copy that did
// not land is announced as a failure that names the URL to copy by hand. The
// toast waits for the write to settle, so each test awaits the promise
// copyUrl() returns.

type Toast = { message: string; type?: string };
type CopyUrlHarness = { copyUrl: (slug: string) => Promise<boolean>; toasts: Toast[] };

function loadCopyUrl(navigatorObject: unknown): CopyUrlHarness {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    extractTopLevelChunk(script, /^function shortOrigin\(/),
    extractTopLevelChunk(script, /^function copyText\(/),
    extractTopLevelChunk(script, /^function copyUrl\(/),
    "return copyUrl;",
  ].join("\n");

  const toasts: Toast[] = [];
  const documentElement = {
    getAttribute: (name: string) => (name === "data-short-origin" ? "https://c.example" : null),
  };
  const factory = new Function("document", "location", "navigator", "toast", "t", code) as (
    document: unknown,
    location: unknown,
    navigator: unknown,
    toast: (message: string, type?: string) => void,
    t: (key: string, params?: { url?: string }) => string,
  ) => (slug: string) => Promise<boolean>;

  return {
    copyUrl: factory(
      { documentElement },
      { origin: "http://localhost:8797" },
      navigatorObject,
      (message: string, type?: string) => {
        toasts.push(type ? { message, type } : { message });
      },
      // Echo the key: a stub that ignored it let a success toast on a failed
      // copy pass as the failure message.
      (key, params) => `${key} ${params?.url}`,
    ),
    toasts,
  };
}

describe("client.ts copyUrl()", () => {
  it("copies the pinned origin and the slug", async () => {
    const written: string[] = [];
    const { copyUrl, toasts } = loadCopyUrl({
      clipboard: {
        writeText: (text: string) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });

    await copyUrl("abc");

    expect(written).toEqual(["https://c.example/abc"]);
    expect(toasts).toEqual([{ message: "client.copied https://c.example/abc" }]);
  });

  it("names the URL to copy by hand when the clipboard is missing", async () => {
    const { copyUrl, toasts } = loadCopyUrl({});

    let pending: Promise<boolean> | undefined;
    expect(() => {
      pending = copyUrl("abc");
    }).not.toThrow();
    await pending;
    expect(toasts).toEqual([{ message: "client.copyFailedUrl https://c.example/abc", type: "error" }]);
  });

  it("names the URL to copy by hand when the clipboard rejects", async () => {
    const { copyUrl, toasts } = loadCopyUrl({
      clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) },
    });

    // An unhandled rejection fails the vitest run, so letting the microtask
    // queue drain is the assertion: the helper has to attach a handler.
    await copyUrl("abc");

    expect(toasts).toEqual([{ message: "client.copyFailedUrl https://c.example/abc", type: "error" }]);
  });
});

// ---- qrSrc ----
// The QR response is cached for a day under a URL that would otherwise be
// identical before and after an operator repoints SHORT_ORIGIN, which left the
// modal naming the new origin while the image and both downloads still served
// the old one. The origin is part of the request URL so the browser cannot keep
// serving a QR the deployment has stopped handing out.

function loadQrSrc(attribute: string | null, origin: string): (linkId: number, slug: string) => string {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    extractTopLevelChunk(script, /^function shortOrigin\(/),
    extractTopLevelChunk(script, /^function qrSrc\(/),
    "return qrSrc;",
  ].join("\n");
  const documentElement = {
    getAttribute: (name: string) => (name === "data-short-origin" ? attribute : null),
  };
  const factory = new Function("document", "location", "API", code) as (
    document: unknown,
    location: unknown,
    api: string,
  ) => (linkId: number, slug: string) => string;

  return factory({ documentElement }, { origin }, "/_/admin/api");
}

describe("client.ts qrSrc()", () => {
  it("keys the QR request by the pinned origin", () => {
    expect(loadQrSrc("https://c.example", "http://localhost:8797")(7, "abc")).toBe(
      "/_/admin/api/links/7/qr?slug=abc&origin=https%3A%2F%2Fc.example",
    );
  });

  it("keys by the host the admin was opened on when nothing is pinned", () => {
    expect(loadQrSrc(null, "http://localhost:8797")(7, "abc")).toBe(
      "/_/admin/api/links/7/qr?slug=abc&origin=http%3A%2F%2Flocalhost%3A8797",
    );
  });
});
