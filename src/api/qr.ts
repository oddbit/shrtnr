// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import { dbGetLinkById } from "../db";
import { renderQrSvg } from "../qr";
import { json } from "./response";

export async function handleLinkQr(request: Request, env: Env, linkId: number): Promise<Response> {
  const link = await dbGetLinkById(env.DB, linkId);
  if (!link) return json({ error: "Link not found" }, 404);

  const url = new URL(request.url);
  const requestedSlug = url.searchParams.get("slug");

  const slug = requestedSlug
    ? link.slugs.find((s) => s.slug === requestedSlug)
    : link.slugs.find((s) => s.is_vanity) ?? link.slugs[0];

  if (!slug) return json({ error: "Slug not found" }, 404);

  const origin = url.origin;
  const qrUrl = `${origin}/${slug.slug}?qr`;
  const svg = renderQrSvg(qrUrl);

  if (!svg) return json({ error: "Failed to generate QR code" }, 500);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
