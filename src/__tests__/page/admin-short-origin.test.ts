// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin shell carries the origin short URLs are built from, so the
// browser-side copy button and QR modal can use it without asking the server
// again. Every admin page is listed on purpose: the value travels from
// getPageData() into each route's <Layout> by hand, and a route that omits the
// required prop fails tsc rather than falling back silently. What the list
// catches is a route that passes the wrong value, such as the request origin
// computed locally instead of the resolved one.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, createExecutionContext } from "cloudflare:test";
import worker from "../../index";
import { LinkRepository, BundleRepository } from "../../db";
import { applyMigrations, resetData } from "../setup";
import type { Env } from "../../types";

beforeAll(applyMigrations);
beforeEach(resetData);

async function fetchPage(path: string, shortOrigin?: unknown): Promise<string> {
  const e = { ...env, SHORT_ORIGIN: shortOrigin } as Env;
  const res = await worker.fetch(new Request(`https://shrtnr.test${path}`), e, createExecutionContext());
  expect(res.status, path).toBe(200);
  return res.text();
}

/** Every admin page that renders through <Layout>. */
async function adminPaths(): Promise<string[]> {
  const link = await LinkRepository.create(env.DB, { url: "https://example.com/landing", slug: "abc" });
  const bundle = await BundleRepository.create(env.DB, { name: "Launch", createdBy: "dev@local" });
  return [
    "/_/admin/dashboard",
    "/_/admin/links",
    `/_/admin/links/${link.id}`,
    "/_/admin/bundles",
    `/_/admin/bundles/${bundle.id}`,
    "/_/admin/keys",
    "/_/admin/settings",
  ];
}

describe("the admin shell carries the short origin", () => {
  it("pins the configured origin on every admin page", async () => {
    for (const path of await adminPaths()) {
      expect(await fetchPage(path, "https://c.example"), path).toContain('data-short-origin="https://c.example"');
    }
  });

  it("falls back to the request origin when SHORT_ORIGIN is unset", async () => {
    for (const path of await adminPaths()) {
      expect(await fetchPage(path), path).toContain('data-short-origin="https://shrtnr.test"');
    }
  });

  it("renders a bare host as an https origin", async () => {
    const html = await fetchPage("/_/admin/links", "c.example");
    expect(html).toContain('data-short-origin="https://c.example"');
  });

  it("falls back to the request origin when the value is not a bare origin", async () => {
    const html = await fetchPage("/_/admin/links", "https://c.example/s");
    expect(html).toContain('data-short-origin="https://shrtnr.test"');
  });

  // wrangler's `vars` and the dashboard accept JSON values, so the binding can
  // reach the Worker as a number. It has to render the page anyway: a cosmetic
  // setting that answered every admin route with a 500 would be worse than the
  // wrong origin.
  it("renders every admin page when the value is not a string", async () => {
    for (const path of await adminPaths()) {
      expect(await fetchPage(path, 42), path).toContain('data-short-origin="https://shrtnr.test"');
    }
  });
});
