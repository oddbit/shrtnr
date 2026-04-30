// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { landingResponse } from "../../pages/landing";

describe("landingResponse", () => {
  it("returns status 200", () => {
    const res = landingResponse();
    expect(res.status).toBe(200);
  });

  it("returns text/html content type", () => {
    const res = landingResponse();
    expect(res.headers.get("Content-Type")).toBe("text/html;charset=UTF-8");
  });

  it("sets a no-cache Cache-Control header so inline styles refresh on each deploy", () => {
    const res = landingResponse();
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });

  it("renders the logotype image", async () => {
    const res = landingResponse();
    const body = await res.text();
    expect(body).toContain("logotype");
  });

  it("renders URL SHORTENER subtitle", async () => {
    const res = landingResponse();
    const body = await res.text();
    expect(body).toContain("URL SHORTENER");
  });

  it("renders a login link pointing to /_/admin/dashboard", async () => {
    const res = landingResponse();
    const body = await res.text();
    expect(body).toContain('href="/_/admin/dashboard"');
    expect(body).toMatch(/login/i);
  });

  it("renders the current copyright year", async () => {
    const res = landingResponse();
    const body = await res.text();
    const currentYear = new Date().getFullYear().toString();
    expect(body).toContain(`&copy; ${currentYear}`);
  });
});
