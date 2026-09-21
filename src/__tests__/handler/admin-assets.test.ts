// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin stylesheet and client script ship as content-hashed assets
// under /_/assets instead of inline in every document. Pinned after the web
// performance review of 2026-09-21: each admin navigation carried 75 KB of
// CSS and 90 KB of JS inside a no-cache HTML response (36 to 38 KB gzip).
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { adminStyles } from "../../styles";
import id from "../../i18n/id";

function req(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://shrtnr.test${path}`, { headers });
}

async function pageHtml(path: string, headers?: Record<string, string>): Promise<string> {
  const res = await SELF.fetch(req(path, headers));
  expect(res.status).toBe(200);
  return res.text();
}

const STYLESHEET = /<link rel="stylesheet" href="(\/_\/assets\/admin\.[0-9a-f]{8,}\.css)"\s*\/?>/;
const SCRIPT = /<script src="(\/_\/assets\/client\.([a-z]{2})\.[0-9a-f]{8,}\.js)"><\/script>/;

beforeAll(applyMigrations);
beforeEach(resetData);

describe("admin pages reference hashed assets instead of inlining them", () => {
  it("links the stylesheet from /_/assets and inlines no admin CSS", async () => {
    const html = await pageHtml("/_/admin/settings");
    expect(html).toMatch(STYLESHEET);
    // The theme token block is the first rule of the admin stylesheet.
    expect(html).not.toContain('[data-theme="oddbit"] {');
  });

  it("loads the client script from /_/assets at the end of the body and inlines none of it", async () => {
    const html = await pageHtml("/_/admin/settings");
    const m = html.match(SCRIPT);
    expect(m).not.toBeNull();
    expect(m![2]).toBe("en");
    expect(html).not.toContain("function setTheme(");
    // Same position as the inline script had: after the toast host, before </body>.
    expect(html.indexOf(m![0])).toBeGreaterThan(html.indexOf('id="toast"'));
    expect(html.indexOf(m![0])).toBeLessThan(html.indexOf("</body>"));
  });

  it("picks the script for the account's language", async () => {
    const html = await pageHtml("/_/admin/settings", { Cookie: "lang=id" });
    const m = html.match(SCRIPT);
    expect(m![2]).toBe("id");
  });

  it("keeps the document small once the assets are external", async () => {
    const html = await pageHtml("/_/admin/dashboard");
    // 170 KB before the extraction.
    expect(html.length).toBeLessThan(40_000);
  });
});

describe("GET /_/assets/*", () => {
  it("serves the stylesheet the page links, immutable, as text/css", async () => {
    const html = await pageHtml("/_/admin/settings");
    const href = html.match(STYLESHEET)![1];
    const res = await SELF.fetch(req(href));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/css");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(await res.text()).toBe(adminStyles);
  });

  it("serves the client script the page links, immutable, as JavaScript, in that language", async () => {
    const html = await pageHtml("/_/admin/settings", { Cookie: "lang=id" });
    const src = html.match(SCRIPT)![1];
    const res = await SELF.fetch(req(src));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("javascript");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    const body = await res.text();
    expect(body).toContain("function setTheme(");
    expect(body).toContain(id["client.themeUpdated"]);
  });

  it("gives each language its own script URL", async () => {
    const en = (await pageHtml("/_/admin/settings")).match(SCRIPT)![1];
    const sv = (await pageHtml("/_/admin/settings", { Cookie: "lang=sv" })).match(SCRIPT)![1];
    expect(en).not.toBe(sv);
  });

  it("serves this build's content for a hash from another build, uncached, so a deploy window never leaves a page unstyled", async () => {
    // A document from the new build can reach an isolate still on the old
    // one (and a stale tab the other way round). The URL's hash is unknown
    // here but the path says which asset it is; answer with this build's
    // copy and no-store, so nothing gets pinned under the wrong URL.
    const css = await SELF.fetch(req("/_/assets/admin.0000000000000000.css"));
    expect(css.status).toBe(200);
    expect(css.headers.get("Cache-Control")).toBe("no-store");
    expect(css.headers.get("Content-Type")).toContain("text/css");
    expect(await css.text()).toBe(adminStyles);

    const js = await SELF.fetch(req("/_/assets/client.id.0000000000000000.js"));
    expect(js.status).toBe(200);
    expect(js.headers.get("Cache-Control")).toBe("no-store");
    expect(js.headers.get("Content-Type")).toContain("javascript");
    expect(await js.text()).toContain(id["client.themeUpdated"]);
  });

  it("answers the branded 404 for a path that names no asset of this app", async () => {
    for (const path of ["/_/assets/client.xx.0000000000000000.js", "/_/assets/vendor.js", "/_/assets/admin.css"]) {
      const res = await SELF.fetch(req(path));
      expect(res.status, path).toBe(404);
      expect(res.headers.get("Content-Type"), path).toContain("text/html");
    }
  });

  it("needs no sign-in: the assets carry nothing account-specific", async () => {
    // The test env has no ACCESS_AUD, so this checks the route sits outside
    // the /_/admin/* auth middleware rather than an actual redirect.
    const html = await pageHtml("/_/admin/settings");
    const href = html.match(STYLESHEET)![1];
    expect(href.startsWith("/_/assets/")).toBe(true);
    expect(href.startsWith("/_/admin/")).toBe(false);
  });
});
