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

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
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
function installWorkerFetch(): void {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input, init);
    if (req.url.startsWith(BASE_URL)) {
      return SELF.fetch(req);
    }
    return ORIGINAL_FETCH(input, init);
  }) as typeof fetch;
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

beforeEach(resetData);

describe("TS SDK integration — health and auth", () => {
  it("health() reaches the real /_/health route", async () => {
    const apiKey = await mintApiKey("owner@example.com", "read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });
    const h = await client.health();
    expect(typeof h.status).toBe("string");
  });

  it("an invalid API key surfaces ShrtnrError(401)", async () => {
    const client = new ShrtnrClient({
      baseUrl: BASE_URL,
      auth: { apiKey: "sk_000000000000000000000000000000000000000000000000000" },
    });
    await expect(client.listLinks()).rejects.toBeInstanceOf(ShrtnrError);
  });
});

describe("TS SDK integration — links", () => {
  it("create/list/get/update/disable/enable/delete round-trip", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });

    const created = await client.createLink({ url: "https://example.com/a", label: "A" });
    expect(created.url).toBe("https://example.com/a");

    const list = await client.listLinks();
    expect(list.some((l) => l.id === created.id)).toBe(true);

    const fetched = await client.getLink(created.id);
    expect(fetched.id).toBe(created.id);

    const updated = await client.updateLink(created.id, { label: "A-updated" });
    expect(updated.label).toBe("A-updated");

    const disabled = await client.disableLink(created.id);
    expect(disabled.expires_at).not.toBeNull();

    const enabled = await client.enableLink(created.id);
    expect(enabled.expires_at).toBeNull();

    // Only zero-click links can be deleted; this one has zero clicks.
    const del = await client.deleteLink(created.id);
    expect(del.deleted).toBe(true);
  });

  it("listLinksByOwner filters by the owner query param", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });
    await client.createLink({ url: "https://example.com/filtered" });
    const mine = await client.listLinksByOwner("owner@example.com");
    expect(mine.length).toBeGreaterThan(0);
    const others = await client.listLinksByOwner("nobody@example.com");
    expect(others).toEqual([]);
  });
});

describe("TS SDK integration — slugs (the regression guard)", () => {
  it("addCustomSlug / disableSlug / enableSlug / removeSlug all resolve against real routes", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });

    const link = await client.createLink({ url: "https://example.com/slugs" });
    const slug = await client.addCustomSlug(link.id, "alpha");
    expect(slug.slug).toBe("alpha");

    const disabled = await client.disableSlug(link.id, "alpha");
    expect(disabled.disabled_at).not.toBeNull();

    const enabled = await client.enableSlug(link.id, "alpha");
    expect(enabled.disabled_at).toBeNull();

    // Remove only succeeds on zero-click custom slugs — this one has none.
    const removed = await client.removeSlug(link.id, "alpha");
    expect(removed.removed).toBe(true);
  });

  it("getLinkBySlug returns the link for a known slug", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });
    const link = await client.createLink({ url: "https://example.com/lookup" });
    const auto = link.slugs.find((s) => !s.is_custom)!.slug;
    const found = await client.getLinkBySlug(auto);
    expect(found.id).toBe(link.id);
  });
});

describe("TS SDK integration — analytics and QR", () => {
  it("getLinkAnalytics and getLinkQR both return data for a real link", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });
    const link = await client.createLink({ url: "https://example.com/qr" });

    const stats = await client.getLinkAnalytics(link.id);
    expect(typeof stats.total_clicks).toBe("number");

    const svg = await client.getLinkQR(link.id);
    expect(svg).toMatch(/<svg/);
  });
});

describe("TS SDK integration — bundles", () => {
  it("full bundle lifecycle — create/list/get/update/archive/unarchive/delete", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });

    const bundle = await client.createBundle({ name: "Campaign X" });
    expect(bundle.name).toBe("Campaign X");

    const list = await client.listBundles();
    expect(list.some((b) => b.id === bundle.id)).toBe(true);

    const fetched = await client.getBundle(bundle.id);
    expect(fetched.id).toBe(bundle.id);

    const updated = await client.updateBundle(bundle.id, { description: "edited" });
    expect(updated.description).toBe("edited");

    const archived = await client.archiveBundle(bundle.id);
    expect(archived.archived_at).not.toBeNull();

    const unarchived = await client.unarchiveBundle(bundle.id);
    expect(unarchived.archived_at).toBeNull();

    const del = await client.deleteBundle(bundle.id);
    expect(del.deleted).toBe(true);
  });

  it("bundle membership: add/list/listBundlesForLink/remove", async () => {
    const apiKey = await mintApiKey("owner@example.com", "create,read");
    const client = new ShrtnrClient({ baseUrl: BASE_URL, auth: { apiKey } });

    const link = await client.createLink({ url: "https://example.com/m" });
    const bundle = await client.createBundle({ name: "M" });

    const added = await client.addLinkToBundle(bundle.id, link.id);
    expect(added.added).toBe(true);

    const links = await client.listBundleLinks(bundle.id);
    expect(links.some((l) => l.id === link.id)).toBe(true);

    const bundlesForLink = await client.listBundlesForLink(link.id);
    expect(bundlesForLink.some((b) => b.id === bundle.id)).toBe(true);

    const analytics = await client.getBundleAnalytics(bundle.id, "30d");
    expect(analytics.bundle.id).toBe(bundle.id);

    const removed = await client.removeLinkFromBundle(bundle.id, link.id);
    expect(removed.removed).toBe(true);
  });
});
