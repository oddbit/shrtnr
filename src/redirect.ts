// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { findSlugForRedirect, recordClick } from "./services/link-management";
import { parseDeviceType, parseBrowser } from "./ua";
import { notFoundResponse } from "./404";
import { Env } from "./types";

export async function handleRedirect(
  slug: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const record = await findSlugForRedirect(env, slug);

  if (!record) {
    return notFoundResponse();
  }

  if (record.expires_at && record.expires_at < Math.floor(Date.now() / 1000)) {
    return notFoundResponse();
  }

  if (record.disabled_at) {
    return notFoundResponse();
  }

  const referrer = request.headers.get("Referer") || null;
  const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? request.headers.get("cf-ipcountry") ?? null;
  const ua = request.headers.get("User-Agent") || "";
  const deviceType = ua ? parseDeviceType(ua) : null;
  const browser = ua ? parseBrowser(ua) : null;
  const url = new URL(request.url);
  const channel = url.searchParams.has("qr") ? "qr" : "direct";

  ctx.waitUntil(recordClick(env, record.id, referrer, country, deviceType, browser, channel));

  return Response.redirect(record.url, 301);
}
