// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

beforeAll(applyMigrations);
beforeEach(resetData);

const page = (path: string, cookie: string) =>
  SELF.fetch(new Request(`http://localhost:8787${path}`, { redirect: "manual", headers: { Cookie: cookie } }));

// The theme and lang cookies are the fallback for a viewer with no stored
// setting. They are caller-controlled, so a value that is not valid
// percent-encoding counts as no cookie: the page renders with the default.
describe("admin pages with a malformed preference cookie", () => {
  it("renders with the default theme when the theme cookie is not valid percent-encoding", async () => {
    const res = await page("/_/admin/settings", "theme=%E0%A4%A");
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/<html[^>]*data-theme="oddbit"/);
  });

  it("renders in the default language when the lang cookie is not valid percent-encoding", async () => {
    const res = await page("/_/admin/links", "lang=%");
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/<html[^>]*lang="en"/);
  });

  it("still honours a well-formed cookie", async () => {
    const res = await page("/_/admin/settings", "theme=dark; lang=sv");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*data-theme="dark"/);
    expect(html).toMatch(/<html[^>]*lang="sv"/);
  });

  // The dashboard loads its panels as separate requests, each of which reads
  // the lang cookie again. A page that renders around panels that all answer
  // 500 is still a broken dashboard.
  it("renders the dashboard panels when the lang cookie is not valid percent-encoding", async () => {
    for (const widget of ["dashboard.kpis?range=30d", "dashboard.timeline?range=30d", "dashboard.top-links?range=30d"]) {
      const res = await page(`/_/admin/w/${widget}`, "lang=%");
      expect(res.status, widget).toBe(200);
    }
  });

  // A parent-domain cookie of the same name is sent alongside the host's own.
  // A malformed one must not hide the valid one behind it.
  it("honours a well-formed cookie that follows a malformed one of the same name", async () => {
    const res = await page("/_/admin/settings", "theme=%E0%A4%A; theme=dark; lang=%; lang=sv");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<html[^>]*data-theme="dark"/);
    expect(html).toMatch(/<html[^>]*lang="sv"/);
  });
});
