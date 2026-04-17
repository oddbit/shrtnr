import { describe, it, expect } from "vitest";
import { notFoundResponse } from "../404";

describe("notFoundResponse", () => {
  it("should return status 404", () => {
    const res = notFoundResponse();
    expect(res.status).toBe(404);
  });

  it("should return text/html content type", () => {
    const res = notFoundResponse();
    expect(res.headers.get("Content-Type")).toBe("text/html;charset=UTF-8");
  });

  it("should set a no-cache Cache-Control header so inline styles refresh on each deploy", () => {
    const res = notFoundResponse();
    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("must-revalidate");
  });
});
