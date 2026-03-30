// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShrtnrClient } from "../index";

const BASE = "https://shrtnr.test";
let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetch(status: number, body: unknown) {
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

describe("public SDK client surface", () => {
  it("exposes link CRUD but not administrative methods", async () => {
    const client = new ShrtnrClient({ baseUrl: BASE, auth: { apiKey: "sk_abc" } }) as Record<string, unknown>;

    mockFetch(200, { id: 10, url: "https://example.com", slugs: [], total_clicks: 0 });
    await (client.getLink as (id: number) => Promise<unknown>)(10);

    expect(typeof client.createLink).toBe("function");
    expect(typeof client.listLinks).toBe("function");
    expect(typeof client.getLink).toBe("function");
    expect(typeof client.updateLink).toBe("function");
    expect(typeof client.disableLink).toBe("function");

    expect(client.listApiKeys).toBeUndefined();
    expect(client.createApiKey).toBeUndefined();
    expect(client.deleteApiKey).toBeUndefined();
    expect(client.getSettings).toBeUndefined();
    expect(client.updateSettings).toBeUndefined();
    expect(client.getPreferences).toBeUndefined();
    expect(client.updatePreferences).toBeUndefined();
    expect(client.getDashboard).toBeUndefined();
  });
});
