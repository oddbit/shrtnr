// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { mcpLandingResponse } from "../mcp/page";

describe("mcpLandingResponse", () => {
  it("returns text/html content type", () => {
    const res = mcpLandingResponse();
    expect(res.headers.get("Content-Type")).toBe("text/html;charset=UTF-8");
  });

  it("sets a no-cache Cache-Control header so inline styles refresh on each deploy", () => {
    const res = mcpLandingResponse();
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });
});
