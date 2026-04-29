// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// End-to-end tests run by scripts/test-sdks-e2e.sh against a live
// `wrangler dev` instance. Requires:
//   SHRTNR_TEST_URL        base URL of the running dev server
//   SHRTNR_TEST_API_KEY    a create+read API key minted by the harness
// Default `yarn test` excludes this path via vitest.config.ts, so this
// suite only runs via the dedicated vitest.e2e.config.ts used by the
// harness. If either env var is missing at runtime, beforeAll throws so
// a misconfigured harness can't pass silently.

import { describe, it, expect, beforeAll } from "vitest";
import { ShrtnrClient } from "../../src";

const BASE_URL = process.env.SHRTNR_TEST_URL;
const API_KEY = process.env.SHRTNR_TEST_API_KEY;

describe("TS SDK e2e — live wrangler dev", () => {
  let client: ShrtnrClient;

  beforeAll(() => {
    // Fail hard rather than skip. These tests only run via the explicit
    // tests/e2e/ path (default `yarn test` excludes this folder), so missing
    // env vars at this point means the harness is misconfigured. A silent
    // skip would hide it behind a green CI check.
    if (!BASE_URL || !API_KEY) {
      throw new Error(
        "SHRTNR_TEST_URL and SHRTNR_TEST_API_KEY must be set. " +
          "Run e2e tests via scripts/test-sdks-e2e.sh from the repo root, not directly.",
      );
    }
    client = new ShrtnrClient({ baseUrl: BASE_URL, apiKey: API_KEY });
  });

  it("link lifecycle — create, get, delete", async () => {
    const link = await client.links.create({
      url: "https://example.com/ts-e2e",
      label: "ts-e2e",
    });
    expect(link.url).toBe("https://example.com/ts-e2e");
    const fetched = await client.links.get(link.id);
    expect(fetched.id).toBe(link.id);
    const del = await client.links.delete(link.id);
    expect(del.deleted).toBe(true);
  });

  it("slug mutations work against live routes", async () => {
    const link = await client.links.create({ url: "https://example.com/ts-slugs" });
    await client.slugs.add(link.id, "ts-e2e-slug");
    const disabled = await client.slugs.disable(link.id, "ts-e2e-slug");
    expect(disabled.disabledAt).not.toBeNull();
    const enabled = await client.slugs.enable(link.id, "ts-e2e-slug");
    expect(enabled.disabledAt).toBeNull();
    const removed = await client.slugs.remove(link.id, "ts-e2e-slug");
    expect(removed.removed).toBe(true);
    await client.links.delete(link.id);
  });

  it("bundle create/delete against live server", async () => {
    const bundle = await client.bundles.create({ name: "ts e2e bundle" });
    expect(bundle.name).toBe("ts e2e bundle");
    const del = await client.bundles.delete(bundle.id);
    expect(del.deleted).toBe(true);
  });
});
