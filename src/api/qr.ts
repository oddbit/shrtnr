// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { MAX_QR_SIZE, MIN_QR_SIZE } from "../constants";
import { Env } from "../types";
import { getLink } from "../services/link-management";
import { renderQrSvg } from "../qr";
import { pickPrimarySlug } from "../slugs";
import { resolveShortOrigin } from "../short-origin";
import { json } from "./response";

export async function handleLinkQr(request: Request, env: Env, linkId: number): Promise<Response> {
  const url = new URL(request.url);
  const requestedSlug = url.searchParams.get("slug") ?? undefined;
  const sizeParam = url.searchParams.get("size");
  // `origin` is deliberately read nowhere below. The admin adds it as a browser
  // cache key (see qrSrc() in src/client.ts) so that a cached SVG cannot outlive
  // a change to SHORT_ORIGIN, and the payload stays the server's decision: a
  // parameter the caller controls would mint QRs for an origin this deployment
  // does not serve.

  if (requestedSlug === "") {
    return json({ error: "slug must not be empty" }, 400);
  }

  let size: number | undefined;
  if (sizeParam !== null) {
    const parsed = Number(sizeParam);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < MIN_QR_SIZE || parsed > MAX_QR_SIZE) {
      return json({ error: `size must be an integer between ${MIN_QR_SIZE} and ${MAX_QR_SIZE}` }, 400);
    }
    size = parsed;
  }

  const result = await getLink(env, linkId);
  if (!result.ok) return json({ error: result.error }, result.status);

  const link = result.data;
  const slug = requestedSlug
    ? link.slugs.find((s) => s.slug === requestedSlug.toLowerCase())
    : pickPrimarySlug(link.slugs);

  if (!slug) return json({ error: "Slug not found" }, 404);

  const qrUrl = `${resolveShortOrigin(env, url)}/${slug.slug}?utm_medium=qr`;
  const svg = renderQrSvg(qrUrl, { size });

  if (!svg) return json({ error: "Failed to generate QR code" }, 500);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // private, not public: this endpoint sits behind a bearer token, and
      // public would let a shared cache store the authenticated response and
      // serve the link-id to slug mapping to unauthenticated clients. private
      // keeps the same browser caching without the shared-cache waiver.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
