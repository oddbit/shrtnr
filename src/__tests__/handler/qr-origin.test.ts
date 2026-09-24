// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The QR endpoint is the server-side half of the same rule the copy button
// follows: with SHORT_ORIGIN set, the encoded URL names the pinned origin
// rather than the host the admin was opened on. The SVG is compared against
// renderQrSvg()'s own output for the expected URL, which pins the payload
// without needing a QR decoder: the renderer is a pure function of the text
// it is given.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, createExecutionContext } from "cloudflare:test";
import worker from "../../index";
import { createLink } from "../../services/link-management";
import { renderQrSvg } from "../../qr";
import { applyMigrations, resetData } from "../setup";
import type { Env } from "../../types";

beforeAll(applyMigrations);
beforeEach(resetData);

async function seedLink(): Promise<{ id: number; slug: string }> {
  const result = await createLink(env as Env, { url: "https://example.com/landing", created_by: "dev@local" });
  if (!result.ok) throw new Error("seed failed");
  return { id: result.data.id, slug: result.data.slugs[0].slug };
}

async function qrSvg(linkId: number, shortOrigin?: string): Promise<string> {
  const e = { ...env, SHORT_ORIGIN: shortOrigin } as Env;
  const res = await worker.fetch(
    new Request(`https://shrtnr.test/_/admin/api/links/${linkId}/qr`),
    e,
    createExecutionContext(),
  );
  expect(res.status).toBe(200);
  return res.text();
}

/** The SVG the endpoint would serve for this exact short URL. */
function svgFor(origin: string, slug: string): string | null {
  return renderQrSvg(`${origin}/${slug}?utm_medium=qr`, { size: undefined });
}

describe("the QR endpoint encodes the pinned short origin", () => {
  it("uses SHORT_ORIGIN instead of the request origin", async () => {
    const { id, slug } = await seedLink();
    const svg = await qrSvg(id, "https://c.example");
    expect(svg).toBe(svgFor("https://c.example", slug));
    // Guards against a coincidental match: the request origin is a different URL.
    expect(svg).not.toBe(svgFor("https://shrtnr.test", slug));
  });

  it("keeps the request origin when SHORT_ORIGIN is unset", async () => {
    const { id, slug } = await seedLink();
    expect(await qrSvg(id)).toBe(svgFor("https://shrtnr.test", slug));
  });

  it("keeps the request origin when the value is not a bare origin", async () => {
    const { id, slug } = await seedLink();
    expect(await qrSvg(id, "https://c.example/s")).toBe(svgFor("https://shrtnr.test", slug));
  });
});
