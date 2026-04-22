// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// End-to-end tests run by scripts/test-sdks-e2e.sh against a live
// `wrangler dev` instance. Requires:
//   SHRTNR_TEST_URL        base URL of the running dev server
//   SHRTNR_TEST_API_KEY    a create+read API key minted by the harness
// If either is missing the suite is skipped — these tests are not part
// of the in-process unit run.

import { describe, it, expect, beforeAll } from "vitest";
import { ShrtnrClient } from "../../src";

const BASE_URL = process.env.SHRTNR_TEST_URL;
const API_KEY = process.env.SHRTNR_TEST_API_KEY;

const describeE2E = BASE_URL && API_KEY ? describe : describe.skip;

describeE2E("TS SDK e2e — live wrangler dev", () => {
  let client: ShrtnrClient;

  beforeAll(() => {
    client = new ShrtnrClient({
      baseUrl: BASE_URL as string,
      auth: { apiKey: API_KEY as string },
    });
  });

  it("health() reaches the live /_/health", async () => {
    const h = await client.health();
    expect(typeof h.status).toBe("string");
  });

  it("link lifecycle — create, get, delete", async () => {
    const link = await client.createLink({
      url: "https://example.com/ts-e2e",
      label: "ts-e2e",
    });
    expect(link.url).toBe("https://example.com/ts-e2e");
    const fetched = await client.getLink(link.id);
    expect(fetched.id).toBe(link.id);
    const del = await client.deleteLink(link.id);
    expect(del.deleted).toBe(true);
  });

  it("slug mutations work against public routes (the regression guard)", async () => {
    const link = await client.createLink({ url: "https://example.com/ts-slugs" });
    await client.addCustomSlug(link.id, "ts-e2e-slug");
    const disabled = await client.disableSlug(link.id, "ts-e2e-slug");
    expect(disabled.disabled_at).not.toBeNull();
    const enabled = await client.enableSlug(link.id, "ts-e2e-slug");
    expect(enabled.disabled_at).toBeNull();
    const removed = await client.removeSlug(link.id, "ts-e2e-slug");
    expect(removed.removed).toBe(true);
    await client.deleteLink(link.id);
  });

  it("bundle create/delete against live server", async () => {
    const bundle = await client.createBundle({ name: "ts e2e bundle" });
    expect(bundle.name).toBe("ts e2e bundle");
    const del = await client.deleteBundle(bundle.id);
    expect(del.deleted).toBe(true);
  });
});
