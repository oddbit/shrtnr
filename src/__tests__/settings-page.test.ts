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
