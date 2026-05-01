// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import { getLink } from "../services/link-management";
import { renderQrSvg } from "../qr";
import { json } from "./response";

export async function handleLinkQr(request: Request, env: Env, linkId: number): Promise<Response> {
  const result = await getLink(env, linkId);
  if (!result.ok) return json({ error: result.error }, result.status);

  const link = result.data;
  const url = new URL(request.url);
  const requestedSlug = url.searchParams.get("slug");
  const sizeParam = url.searchParams.get("size");
  const size = sizeParam ? parseInt(sizeParam, 10) : undefined;

  const slug = requestedSlug
    ? link.slugs.find((s) => s.slug === requestedSlug)
    : link.slugs.find((s) => s.is_custom) ?? link.slugs[0];

  if (!slug) return json({ error: "Slug not found" }, 404);

  const origin = url.origin;
  const qrUrl = `${origin}/${slug.slug}?utm_medium=qr`;
  const svg = renderQrSvg(qrUrl, { size });

  if (!svg) return json({ error: "Failed to generate QR code" }, 500);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
