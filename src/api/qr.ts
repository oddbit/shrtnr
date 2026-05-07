// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { MAX_QR_SIZE, MIN_QR_SIZE } from "../constants";
import { Env } from "../types";
import { getLink } from "../services/link-management";
import { renderQrSvg } from "../qr";
import { json } from "./response";

export async function handleLinkQr(request: Request, env: Env, linkId: number): Promise<Response> {
  const url = new URL(request.url);
  const requestedSlug = url.searchParams.get("slug") ?? undefined;
  const sizeParam = url.searchParams.get("size");

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
    ? link.slugs.find((s) => s.slug === requestedSlug)
    : link.slugs.find((s) => s.is_primary) ?? link.slugs[0];

  if (!slug) return json({ error: "Slug not found" }, 404);

  const qrUrl = `${url.origin}/${slug.slug}?utm_medium=qr`;
  const svg = renderQrSvg(qrUrl, { size });

  if (!svg) return json({ error: "Failed to generate QR code" }, 500);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
