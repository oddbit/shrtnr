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
    expect(await res.text()).toContain('data-theme="oddbit"');
  });

  it("renders in the default language when the lang cookie is not valid percent-encoding", async () => {
    const res = await page("/_/admin/links", "lang=%");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('lang="en"');
  });

  it("still honours a well-formed cookie", async () => {
    const res = await page("/_/admin/settings", "theme=dark; lang=sv");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('lang="sv"');
  });
});
