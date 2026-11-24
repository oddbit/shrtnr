// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin API parses raw JSON without a zod schema, so a malformed body
// reaches the handlers and services as-is. Every such body is a caller
// mistake and answers 400 with a sentence, never a 500 from a TypeError or a
// D1 bind error. The public API answers 400 for the same bodies through its
// schemas, and the service layer holds the limits both share.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { createLink, updateLink } from "../../services/link-management";
import { createBundle, updateBundle } from "../../services/bundle-management";
import type { Env } from "../../types";

const OWNER = "owner@example.com";
const e = env as unknown as Env;

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

function admin(method: string, path: string, body: unknown): Promise<Response> {
  return SELF.fetch(
    new Request(`https://shrtnr.test/_/admin/api${path}`, {
      method,
      headers: { "Cf-Access-Jwt-Assertion": makeJwt(OWNER), "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function expect400(res: Response): Promise<string> {
  const text = await res.text();
  expect({ status: res.status, text }).toMatchObject({ status: 400 });
  const parsed = JSON.parse(text) as { error: string };
  expect(typeof parsed.error).toBe("string");
  expect(parsed.error.length).toBeGreaterThan(0);
  return parsed.error;
}

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

async function seedLink(): Promise<number> {
  const created = await createLink(e, { url: "https://example.com/seed", created_by: OWNER });
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

async function seedBundle(): Promise<number> {
  const created = await createBundle(e, { name: "Seed" }, OWNER);
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

describe("admin API: a body that is valid JSON but not an object", () => {
  const NON_OBJECTS: [string, string][] = [
    ["null", "null"],
    ["an array", "[]"],
    ["a string", '"text"'],
    ["a number", "42"],
    ["a boolean", "true"],
  ];

  describe.each(NON_OBJECTS)("%s", (_name, raw) => {
    it("POST /links answers 400", async () => {
      await expect400(await admin("POST", "/links", raw));
    });

    it("PUT /links/:id answers 400", async () => {
      const id = await seedLink();
      await expect400(await admin("PUT", `/links/${id}`, raw));
    });

    it("POST /links/:id/slugs answers 400", async () => {
      const id = await seedLink();
      await expect400(await admin("POST", `/links/${id}/slugs`, raw));
    });

    it("PUT /links/:id/slugs/primary answers 400", async () => {
      const id = await seedLink();
      await expect400(await admin("PUT", `/links/${id}/slugs/primary`, raw));
    });

    it("POST /keys answers 400", async () => {
      await expect400(await admin("POST", "/keys", raw));
    });

    it("PUT /settings answers 400", async () => {
      await expect400(await admin("PUT", "/settings", raw));
    });

    it("POST /bundles answers 400", async () => {
      await expect400(await admin("POST", "/bundles", raw));
    });

    it("PUT /bundles/:id answers 400", async () => {
      const id = await seedBundle();
      await expect400(await admin("PUT", `/bundles/${id}`, raw));
    });

    it("POST /bundles/:id/links answers 400", async () => {
      const id = await seedBundle();
      await expect400(await admin("POST", `/bundles/${id}/links`, raw));
    });
  });
});

describe("admin API: fields of the wrong type", () => {
  it("PUT /links/:id refuses a url that is not a string", async () => {
    const id = await seedLink();
    for (const url of [["https://example.org"], 42, {}, null, true]) {
      await expect400(await admin("PUT", `/links/${id}`, { url }));
    }
  });

  it("POST /links refuses a url that is not a string", async () => {
    for (const url of [["https://example.org"], 42, {}, true]) {
      await expect400(await admin("POST", "/links", { url }));
    }
  });

  it("PUT /links/:id/slugs/primary refuses a slug that is not a string", async () => {
    const id = await seedLink();
    for (const slug of [42, ["abc"], {}, true]) {
      await expect400(await admin("PUT", `/links/${id}/slugs/primary`, { slug }));
    }
  });

  it("POST /bundles refuses a name that is not a string", async () => {
    for (const name of [42, ["x"], {}, true]) {
      await expect400(await admin("POST", "/bundles", { name }));
    }
  });

  it("POST /bundles refuses a description or icon that is not a string or null", async () => {
    for (const value of [42, ["x"], {}, true]) {
      await expect400(await admin("POST", "/bundles", { name: "B", description: value }));
      await expect400(await admin("POST", "/bundles", { name: "B", icon: value }));
    }
  });

  it("PUT /bundles/:id refuses a name, description or icon of the wrong type", async () => {
    const id = await seedBundle();
    for (const value of [42, ["x"], {}, true]) {
      await expect400(await admin("PUT", `/bundles/${id}`, { name: value }));
      await expect400(await admin("PUT", `/bundles/${id}`, { description: value }));
      await expect400(await admin("PUT", `/bundles/${id}`, { icon: value }));
    }
  });

  it("POST /bundles/:id/links refuses a link_id that is not a number", async () => {
    const id = await seedBundle();
    await seedLink();
    for (const link_id of [true, "", null, [1], {}]) {
      await expect400(await admin("POST", `/bundles/${id}/links`, { link_id }));
    }
  });

  it("still accepts null to clear a bundle's description and icon", async () => {
    const id = await seedBundle();
    const res = await admin("PUT", `/bundles/${id}`, { description: null, icon: null });
    expect(res.status).toBe(200);
  });
});

describe("the URL length limit holds on every surface", () => {
  const longUrl = `https://example.com/${"a".repeat(2048)}`;
  const maxUrl = `https://example.com/${"a".repeat(2048 - "https://example.com/".length)}`;

  it("the admin API refuses a URL longer than 2048 characters on create", async () => {
    const error = await expect400(await admin("POST", "/links", { url: longUrl }));
    expect(error).toContain("2048");
  });

  it("the admin API refuses a URL longer than 2048 characters on update", async () => {
    const id = await seedLink();
    const error = await expect400(await admin("PUT", `/links/${id}`, { url: longUrl }));
    expect(error).toContain("2048");
  });

  it("the service refuses it for every caller, MCP included", async () => {
    const created = await createLink(e, { url: longUrl, created_by: OWNER, created_via: "mcp" });
    expect(created).toMatchObject({ ok: false, status: 400 });
    const id = await seedLink();
    const updated = await updateLink(e, id, { url: longUrl }, OWNER);
    expect(updated).toMatchObject({ ok: false, status: 400 });
  });

  it("accepts a URL of exactly 2048 characters", async () => {
    expect(maxUrl.length).toBe(2048);
    const created = await createLink(e, { url: maxUrl, created_by: OWNER });
    expect(created).toMatchObject({ ok: true, status: 201 });
  });
});

describe("bundle services validate what the admin API hands them", () => {
  it("createBundle refuses a non-string name without throwing", async () => {
    const result = await createBundle(e, { name: 42 as unknown as string }, OWNER);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("updateBundle refuses a non-string name without throwing", async () => {
    const id = await seedBundle();
    const result = await updateBundle(e, id, { name: 42 as unknown as string }, OWNER);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
