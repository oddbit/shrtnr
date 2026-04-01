import { describe, it, expect } from "vitest";
import { unauthorizedResponse } from "../auth";

describe("unauthorizedResponse", () => {
  it("should return 401 with JSON error", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
