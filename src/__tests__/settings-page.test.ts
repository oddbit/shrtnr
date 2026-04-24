import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";

function req(path: string): Request {
  return new Request(`https://shrtnr.test${path}`);
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("Settings page MCP status", () => {
  it("renders the MCP status section", async () => {
    const res = await SELF.fetch(req("/_/admin/settings"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("MCP Server");
  });

  it("shows not-configured status when secrets are missing", async () => {
    // Test env has no ACCESS_CLIENT_ID etc., so MCP should show as not configured
    const res = await SELF.fetch(req("/_/admin/settings"));
    const html = await res.text();
    expect(html).toContain("Not configured");
    expect(html).toContain("README");
  });
});

describe("Settings page default range control", () => {
  it("renders the default-range picker with all options", async () => {
    const res = await SELF.fetch(req("/_/admin/settings"));
    const html = await res.text();
    expect(html).toContain('id="default-range-picker"');
    for (const v of ["24h", "7d", "30d", "90d", "1y", "all"]) {
      expect(html).toContain(`value="${v}"`);
    }
  });

  it("offers an 'unset' option that maps to empty value", async () => {
    const res = await SELF.fetch(req("/_/admin/settings"));
    const html = await res.text();
    expect(html).toMatch(/<option value=""/);
  });
});

describe("Settings page analytics filter toggles", () => {
  it("renders the filter-bots and filter-self-referrers toggles", async () => {
    const res = await SELF.fetch(req("/_/admin/settings"));
    const html = await res.text();
    expect(html).toContain('id="filter-bots-toggle"');
    expect(html).toContain('id="filter-self-referrers-toggle"');
  });

  it("both toggles are checked by default (defaults to filtering enabled)", async () => {
    const res = await SELF.fetch(req("/_/admin/settings"));
    const html = await res.text();
    // Each input exists with `checked` in the rendered markup when enabled.
    expect(html).toMatch(/id="filter-bots-toggle"[^>]*checked/);
    expect(html).toMatch(/id="filter-self-referrers-toggle"[^>]*checked/);
  });
});
