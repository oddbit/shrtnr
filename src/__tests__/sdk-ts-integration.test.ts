// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// End-to-end integration tests for the TypeScript SDK.
//
// These tests drive the real @oddbit/shrtnr `ShrtnrClient` against the real
// Worker via the Cloudflare Workers vitest pool. No mocks. A real API key is
// minted through the admin path, the SDK is constructed with it, and every
// public method is called against real routes served by the real Hono app
// backed by a real D1 database. If a server route the SDK calls goes missing,
// these tests fail with the status the SDK actually observed.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { ShrtnrClient, ShrtnrError } from "../../sdk/typescript/src";
import { applyMigrations, resetData } from "./setup";

const BASE_URL = "https://shrtnr.test";

function makeJwt(email: string): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ email }));
  return `${header}.${body}.fakesig`;
}

// Route the SDK's global fetch through the Worker so every request exercises
// the real routing, auth middleware, and D1 state instead of hitting the
// network. Restored in afterAll.
const ORIGINAL_FETCH = globalThis.fetch;
let workerFetchInstalled = false;
function installWorkerFetch(): void {
  if (workerFetchInstalled) return;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    if (req.url.startsWith(BASE_URL)) {
      return SELF.fetch(req);
    }
    return ORIGINAL_FETCH(input, init);
  }) as typeof fetch;
  workerFetchInstalled = true;
}
function restoreOriginalFetch(): void {
  if (!workerFetchInstalled) return;
  globalThis.fetch = ORIGINAL_FETCH;
  workerFetchInstalled = false;
}

async function mintApiKey(email: string, scope: string): Promise<string> {
  const jwt = makeJwt(email);
  const res = await SELF.fetch(
    new Request(`${BASE_URL}/_/admin/api/keys`, {
      method: "POST",
      headers: {
        "Cf-Access-Jwt-Assertion": jwt,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: `key-${email}-${scope}`, scope }),
    }),
  );
  if (!res.ok) throw new Error(`mintApiKey failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { raw_key: string };
  return body.raw_key;
}

beforeAll(async () => {
  await applyMigrations();
  installWorkerFetch();
});

afterAll(() => {
  restoreOriginalFetch();
});

beforeEach(resetData);

describe("TS SDK integration — auth", () => {
  it("an invalid API key surfaces ShrtnrError(401)", async () => {
    const client = new ShrtnrClient({
      baseUrl: BASE_URL,
      apiKey: "sk_000000000000000000000000000000000000000000000000000",
    });
    await expect(client.links.list()).rejects.toBeInstanceOf(ShrtnrError);
  });
});

describe("TS SDK integration — links", () => {
  it("create/list/get/update/disable/enable/delete round-trip", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });

    const created = await client.links.create({ url: "https://example.com/a", label: "A" });
    expect(created.url).toBe("https://example.com/a");

    const list = await client.links.list();
    expect(list.some((l) => l.id === created.id)).toBe(true);

    const fetched = await client.links.get(created.id);
    expect(fetched.id).toBe(created.id);

    const updated = await client.links.update(created.id, { label: "A-updated" });
    expect(updated.label).toBe("A-updated");

    const disabled = await client.links.disable(created.id);
    expect(disabled.expiresAt).not.toBeNull();

    const enabled = await client.links.enable(created.id);
    expect(enabled.expiresAt).toBeNull();

    // Only zero-click links can be deleted; this one has zero clicks.
    const del = await client.links.delete(created.id);
    expect(del.deleted).toBe(true);
  });

  it("list with owner filter returns only matching links", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });
    await client.links.create({ url: "https://example.com/filtered" });
    const mine = await client.links.list({ owner: "owner@example.com" });
    expect(mine.length).toBeGreaterThan(0);
    const others = await client.links.list({ owner: "nobody@example.com" });
    expect(others).toEqual([]);
  });
});

describe("TS SDK integration — slugs (the regression guard)", () => {
  it("add / disable / enable / remove all resolve against real routes", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });

    const link = await client.links.create({ url: "https://example.com/slugs" });
    const slug = await client.slugs.add(link.id, "alpha");
    expect(slug.slug).toBe("alpha");

    const disabled = await client.slugs.disable(link.id, "alpha");
    expect(disabled.disabledAt).not.toBeNull();

    const enabled = await client.slugs.enable(link.id, "alpha");
    expect(enabled.disabledAt).toBeNull();

    // Remove only succeeds on zero-click custom slugs — this one has none.
    const removed = await client.slugs.remove(link.id, "alpha");
    expect(removed.removed).toBe(true);
  });

  it("lookup returns the link for a known slug", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });
    const link = await client.links.create({ url: "https://example.com/lookup" });
    const auto = link.slugs.find((s) => !s.isCustom)!.slug;
    const found = await client.slugs.lookup(auto);
    expect(found.id).toBe(link.id);
  });
});

describe("TS SDK integration — analytics and QR", () => {
  it("analytics and qr both return data for a real link", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });
    const link = await client.links.create({ url: "https://example.com/qr" });

    const stats = await client.links.analytics(link.id);
    expect(typeof stats.totalClicks).toBe("number");

    const svg = await client.links.qr(link.id);
    expect(svg).toMatch(/<svg/);
  });

  it("timeline returns bucketed data with summary", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });
    const link = await client.links.create({ url: "https://example.com/timeline" });

    const td = await client.links.timeline(link.id, { range: "7d" });
    expect(td.range).toBe("7d");
    expect(Array.isArray(td.buckets)).toBe(true);
    expect(typeof td.summary.last7d).toBe("number");
  });
});

describe("TS SDK integration — bundles", () => {
  it("full bundle lifecycle — create/list/get/update/archive/unarchive/delete", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });

    const bundle = await client.bundles.create({ name: "Campaign X" });
    expect(bundle.name).toBe("Campaign X");

    const list = await client.bundles.list();
    expect(list.some((b) => b.id === bundle.id)).toBe(true);

    const fetched = await client.bundles.get(bundle.id);
    expect(fetched.id).toBe(bundle.id);

    const updated = await client.bundles.update(bundle.id, { description: "edited" });
    expect(updated.description).toBe("edited");

    const archived = await client.bundles.archive(bundle.id);
    expect(archived.archivedAt).not.toBeNull();

    const unarchived = await client.bundles.unarchive(bundle.id);
    expect(unarchived.archivedAt).toBeNull();

    const del = await client.bundles.delete(bundle.id);
    expect(del.deleted).toBe(true);
  });

  it("bundle membership: add/list/links.bundles/remove", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey });

    const link = await client.links.create({ url: "https://example.com/m" });
    const bundle = await client.bundles.create({ name: "M" });

    const added = await client.bundles.addLink(bundle.id, link.id);
    expect(added.added).toBe(true);

    const bundleLinks = await client.bundles.links(bundle.id);
    expect(bundleLinks.some((l) => l.id === link.id)).toBe(true);

    const bundlesForLink = await client.links.bundles(link.id);
    expect(bundlesForLink.some((b) => b.id === bundle.id)).toBe(true);

    const analytics = await client.bundles.analytics(bundle.id, { range: "30d" });
    expect(typeof analytics.totalClicks).toBe("number");

    const removed = await client.bundles.removeLink(bundle.id, link.id);
    expect(removed.removed).toBe(true);
  });
});
