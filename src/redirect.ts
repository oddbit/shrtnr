// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { recordClick } from "./services/link-management";
import { SlugCache } from "./kv";
import { SlugRepository } from "./db";
import { parseDeviceType, parseBrowser, parseOS, isBot } from "./ua";
import { notFoundResponse } from "./404";
import { ClickData, Env } from "./types";
import { computeVisitorFingerprint } from "./fingerprint";

function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

function parseReferrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return normalizeHost(new URL(referrer).hostname);
  } catch {
    return null;
  }
}

export async function handleRedirect(
  slug: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const normalizedSlug = slug.toLowerCase();

  // 1. Try KV (fast edge read)
  let entry = await SlugCache.get(env.SLUG_KV, normalizedSlug);

  // 2. KV miss: fall back to D1 and populate KV (read-through)
  if (!entry) {
    const d1Result = await SlugRepository.findForRedirect(env.DB, normalizedSlug);
    if (!d1Result) return notFoundResponse();

    entry = {
      url: d1Result.url,
      disabled_at: d1Result.disabled_at,
      expires_at: d1Result.expires_at,
    };

    await SlugCache.put(env.SLUG_KV, normalizedSlug, entry);
  }

  // 3. Check disabled
  if (entry.disabled_at) return notFoundResponse();

  // 4. Check expired
  if (entry.expires_at && entry.expires_at < Math.floor(Date.now() / 1000)) {
    return notFoundResponse();
  }

  // 5. Record click (background, does not block redirect)
  const rawReferrer = request.headers.get("Referer") || null;
  const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? request.headers.get("cf-ipcountry") ?? null;
  const ua = request.headers.get("User-Agent") || "";
  const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null;

  const url = new URL(request.url);
  const utmMedium = url.searchParams.get("utm_medium")?.toLowerCase() ?? null;

  // Drop self-referrers: the referring page is on the same host the visitor
  // hit, so it is noise in the Sources/Domains breakdown. Uses the live
  // request host so any deployment works without hardcoding a domain.
  const referrerHost = parseReferrerHost(rawReferrer);
  const requestHost = normalizeHost(url.hostname);
  const selfReferrer = referrerHost !== null && referrerHost === requestHost;
  const referrer = selfReferrer ? null : rawReferrer;

  // Best-effort silent visitor fingerprint. Hashed IP + UA + daily salt.
  // Stored for future unique-visitor analytics; never exposed raw anywhere.
  const visitorFp = await computeVisitorFingerprint(clientIp, ua, env.FP_SALT).catch(() => null);

  const data: ClickData = {
    referrer,
    referrerHost: selfReferrer ? null : referrerHost,
    country,
    deviceType: ua ? parseDeviceType(ua) : null,
    os: ua ? parseOS(ua) : null,
    browser: ua ? parseBrowser(ua) : null,
    linkMode: utmMedium === "qr" ? "qr" : "link",
    utmSource: url.searchParams.get("utm_source")?.toLowerCase() ?? null,
    utmMedium,
    utmCampaign: url.searchParams.get("utm_campaign")?.toLowerCase() ?? null,
    utmTerm: url.searchParams.get("utm_term")?.toLowerCase() ?? null,
    utmContent: url.searchParams.get("utm_content")?.toLowerCase() ?? null,
    userAgent: ua || null,
    isBot: isBot(ua) ? 1 : 0,
    visitorFp,
  };

  ctx.waitUntil(recordClick(env, normalizedSlug, data));

  // 6. Redirect
  return Response.redirect(entry.url, 301);
}
