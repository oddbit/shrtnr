// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { LinkRepository } from "../../db";
import { SlugCache } from "../../kv";
import { applyMigrations, resetData } from "../setup";

// Matches DEV_IDENTITY in .dev.vars; the admin middleware accepts an unsigned
// JWT in test mode and populates `identity` from the email claim. Setting the
// JWT email to dev@local lines up the link's createdBy with the analytics
// caller, so the admin endpoint scopes to this owner.
const DEV_IDENTITY = "dev@local";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

beforeAll(applyMigrations);
beforeEach(resetData);

// `recordClick` runs via `ctx.waitUntil(...)` from the redirect handler, so the
// click row may not yet exist the moment SELF.fetch resolves. Poll the row for
// up to ~1s before asserting; faster than a fixed sleep, bounded so a real
// regression still fails.
async function waitForClick(linkId: number, timeoutMs = 1000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM clicks c JOIN slugs s ON s.slug = c.slug WHERE s.link_id = ?",
    )
      .bind(linkId)
      .first<{ cnt: number }>();
    const cnt = row?.cnt ?? 0;
    if (cnt > 0) return cnt;
    await new Promise((r) => setTimeout(r, 25));
  }
  return 0;
}

describe("create -> redirect -> click -> analytics", () => {
  it("walks the full pipeline and surfaces the click in admin analytics", async () => {
    // 1. Create a link directly via the repository so the test pins each
    //    pipeline stage on its own. Using the API to create would conflate
    //    the create path with the redirect/click/analytics path.
    const link = await LinkRepository.create(env.DB, {
      url: "https://example.com/redirect-flow",
      slug: "rflow",
      createdBy: DEV_IDENTITY,
    });
    expect(link.slugs[0].slug).toBe("rflow");

    // 2. Hit /<slug> and check the 301 + Location. Pass a real-looking
    //    User-Agent so the click is not flagged as a bot. The admin
    //    analytics endpoint filters bots by default (filter_bots=true),
    //    and an empty UA is classified as a bot in src/ua.ts.
    const redirectRes = await SELF.fetch(
      new Request("https://shrtnr.test/rflow", {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        },
      }),
    );
    expect(redirectRes.status).toBe(301);
    expect(redirectRes.headers.get("Location")).toBe("https://example.com/redirect-flow");

    // 3. Wait for the waitUntil(recordClick) to land in the clicks table.
    const clickCount = await waitForClick(link.id);
    expect(clickCount).toBeGreaterThanOrEqual(1);

    // 4. Hit the admin analytics endpoint with an authenticated JWT whose
    //    email matches the link's createdBy. The admin handler scopes the
    //    response to the caller's identity via resolveClickFilters.
    const token = makeFakeJwt({ email: DEV_IDENTITY });
    const analyticsRes = await SELF.fetch(
      new Request(`https://shrtnr.test/_/admin/api/links/${link.id}/analytics?range=all`, {
        headers: { "Cf-Access-Jwt-Assertion": token },
      }),
    );
    expect(analyticsRes.status).toBe(200);
    const stats = (await analyticsRes.json()) as { total_clicks: number };
    // ClickStats.total_clicks is a top-level number (see src/types.ts).
    expect(stats.total_clicks).toBeGreaterThanOrEqual(1);
  });
});
