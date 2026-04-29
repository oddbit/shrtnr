// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";

const ADMIN_AUTH = {
  "Cf-Access-Jwt-Assertion":
    btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    btoa(JSON.stringify({ email: "test@example.com" })) +
    ".sig",
};

async function createApiKey(scope: string): Promise<string> {
  const res = await SELF.fetch(
    new Request("https://shrtnr.test/_/admin/api/keys", {
      method: "POST",
      headers: { ...ADMIN_AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${scope} key`, scope }),
    }),
  );
  const { raw_key } = (await res.json()) as { raw_key: string };
  return raw_key;
}

beforeAll(applyMigrations);
beforeEach(resetData);

describe("OpenAPI surface", () => {
  it("GET /_/api/openapi.json returns a valid OpenAPI 3.1 document", async () => {
    const res = await SELF.fetch("https://shrtnr.test/_/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type") ?? "").toMatch(/application\/json/);
    const doc = await res.json() as { openapi: string; info: { title: string; version: string }; paths: Record<string, unknown> };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("shrtnr API");
    expect(doc.info.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof doc.paths).toBe("object");
  });

  it("GET /_/api/docs returns HTML referencing the spec endpoint", async () => {
    const res = await SELF.fetch("https://shrtnr.test/_/api/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type") ?? "").toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("/_/api/openapi.json");
  });
});

describe("OpenAPI strict validation", () => {
  it("POST /_/api/links with an unknown field returns 400 + {error}", async () => {
    const key = await createApiKey("create");
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com", banana: "yellow" }),
      }),
    );
    expect(res.status).toBe(400);
    // @hono/zod-openapi routes without a defaultHook return the library's default
    // validation envelope: { success: false, error: { name: "ZodError", message: "..." } }
    const body = (await res.json()) as { success?: boolean; error?: { name?: string; message?: string } };
    expect(body.success).toBe(false);
    expect(body.error?.message).toMatch(/banana/i);
  });

  it("GET /_/api/links/abc returns 404 (NaN-id contract preserved via paramHook)", async () => {
    const key = await createApiKey("read");
    const res = await SELF.fetch(
      new Request("https://shrtnr.test/_/api/links/abc", {
        headers: { Authorization: `Bearer ${key}` },
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });
});

describe("OpenAPI spec coverage", () => {
  it("the spec documents every migrated public-API path", async () => {
    const res = await SELF.fetch("https://shrtnr.test/_/api/openapi.json");
    const doc = (await res.json()) as {
      paths: Record<string, Record<string, unknown>>;
    };
    // @hono/zod-openapi records paths relative to the sub-app mount point, so
    // the /_/api prefix is stripped and keys start with /links, /bundles, etc.
    const expected = [
      "/links",
      "/links/{id}",
      "/links/{id}/disable",
      "/links/{id}/enable",
      "/links/{id}/slugs",
      "/links/{id}/slugs/{slug}",
      "/links/{id}/slugs/{slug}/disable",
      "/links/{id}/slugs/{slug}/enable",
      "/links/{id}/qr",
      "/links/{id}/analytics",
      "/links/{id}/timeline",
      "/links/{id}/bundles",
      "/slugs/{slug}",
      "/bundles",
      "/bundles/{id}",
      "/bundles/{id}/archive",
      "/bundles/{id}/unarchive",
      "/bundles/{id}/analytics",
      "/bundles/{id}/links",
      "/bundles/{id}/links/{linkId}",
    ];
    const actualKeys = Object.keys(doc.paths).sort();
    for (const path of expected) {
      expect(
        doc.paths[path],
        `expected path missing from spec: ${path}\nactual paths: ${actualKeys.join(", ")}`,
      ).toBeDefined();
    }
  });
});
