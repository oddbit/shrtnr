// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";

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
  it("POST /_/api/links with an unknown field returns 400 + {error: string}", async () => {
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
    const body = await res.json() as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/banana/i);
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

describe("paramHook handles body and query failures", () => {
  it("PUT /_/api/links/:id with an unknown body field returns 400 + {error: string}", async () => {
    const key = await createApiKey("create");
    const createRes = await SELF.fetch(new Request("https://shrtnr.test/_/api/links", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    }));
    const created = await createRes.json() as { id: number };
    const id = created.id;

    const res = await SELF.fetch(new Request(`https://shrtnr.test/_/api/links/${id}`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/new", banana: "yellow" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/banana/i);
  });

  it("GET /_/api/bundles/:id?range=invalid returns 400 + {error: string}", async () => {
    const key = await createApiKey("read");
    const res = await SELF.fetch(new Request("https://shrtnr.test/_/api/bundles/1?range=99d", {
      headers: { "Authorization": `Bearer ${key}` },
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/range/i);
  });
});

describe("slug body validation matches service-layer rules", () => {
  async function createLink(key: string): Promise<number> {
    const res = await SELF.fetch(new Request("https://shrtnr.test/_/api/links", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/slug-test" }),
    }));
    return ((await res.json()) as { id: number }).id;
  }

  async function postSlug(key: string, id: number, slug: string): Promise<Response> {
    return SELF.fetch(new Request(`https://shrtnr.test/_/api/links/${id}/slugs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }));
  }

  it.each([
    ["under_score", "underscore disallowed"],
    ["-leading", "leading hyphen disallowed"],
    ["trailing-", "trailing hyphen disallowed"],
    ["has space", "whitespace disallowed"],
    ["sl/ash", "slash disallowed"],
  ])("rejects %s at the schema boundary (%s)", async (slug, _why) => {
    const key = await createApiKey("create");
    const id = await createLink(key);
    const res = await postSlug(key, id, slug);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  it("accepts a valid mixed-case custom slug", async () => {
    const key = await createApiKey("create");
    const id = await createLink(key);
    const res = await postSlug(key, id, "Marketing-Page");
    expect(res.status).toBe(201);
  });
});

describe("expires_at must be non-negative", () => {
  it("POST /_/api/links rejects a negative expires_at with 400 + {error: string}", async () => {
    const key = await createApiKey("create");
    const res = await SELF.fetch(new Request("https://shrtnr.test/_/api/links", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/expires-neg", expires_at: -1 }),
    }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/expires_at/i);
  });

  it("PUT /_/api/links/:id rejects a negative expires_at with 400 + {error: string}", async () => {
    const key = await createApiKey("create");
    const createRes = await SELF.fetch(new Request("https://shrtnr.test/_/api/links", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/expires-neg-put" }),
    }));
    const id = ((await createRes.json()) as { id: number }).id;

    const res = await SELF.fetch(new Request(`https://shrtnr.test/_/api/links/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expires_at: -1 }),
    }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/expires_at/i);
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

describe("OpenAPI runtime parity", () => {
  it("every declared path responds (no 'no route' 404)", async () => {
    // Mint a single read+create key that we authenticate every probe with,
    // so the global /_/api/* middleware always lets us through and any 404
    // we observe is a route-level 404 (or, the failure mode we're hunting,
    // a framework no-route fall-through).
    const key = await createApiKey("read,create");

    const specRes = await SELF.fetch("https://shrtnr.test/_/api/openapi.json");
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as {
      paths: Record<string, Record<string, unknown>>;
    };

    const issues: string[] = [];
    for (const [path, methods] of Object.entries(spec.paths)) {
      // Spec paths are relative to the /_/api mount point; templated params
      // are substituted with safe values that exist in the schema's regex
      // (e.g. numeric ids and a simple slug).
      const concrete = path
        .replace(/\{slug\}/g, "abc")
        .replace(/\{[^}]+\}/g, "1");
      const fullPath = `/_/api${concrete}`;
      for (const method of Object.keys(methods)) {
        const m = method.toUpperCase();
        if (m === "PARAMETERS") continue;
        const res = await SELF.fetch(
          new Request(`https://shrtnr.test${fullPath}`, {
            method: m,
            headers: {
              Authorization: `Bearer ${key}`,
              // GET-with-body is illegal; only set Content-Type for write methods.
              ...(m === "POST" || m === "PUT" || m === "PATCH"
                ? { "Content-Type": "application/json" }
                : {}),
            },
            body:
              m === "POST" || m === "PUT" || m === "PATCH"
                ? JSON.stringify({})
                : undefined,
          }),
        );

        // Distinguish framework no-route 404 (the global notFoundResponse,
        // text/html) from declared 404 responses (JSON {error: ...}).
        if (res.status === 404) {
          const ct = res.headers.get("Content-Type") ?? "";
          if (!ct.includes("application/json")) {
            issues.push(`${m} ${fullPath} -> 404 (no route, ct=${ct || "<none>"})`);
          }
        }
      }
    }
    expect(issues).toEqual([]);
  });
});
