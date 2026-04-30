// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Curated map from Android (and iOS) app package identifiers to the brand
// domain we attribute their in-app-browser clicks to. Browsers and any other
// uncurated package fall through to `null` and are treated as "no referrer"
// in the Domains breakdown. The raw `referrer` column always preserves the
// original Referer header verbatim, so adding entries here and re-running
// `scripts/backfill-app-referrers.ts` retroactively attributes past clicks.
export const APP_PACKAGE_TO_DOMAIN: Record<string, string> = {
  "com.linkedin.android": "linkedin.com",
  "com.twitter.android": "x.com",
  "com.facebook.katana": "facebook.com",
  "com.facebook.lite": "facebook.com",
  "com.instagram.android": "instagram.com",
  "com.zhiliaoapp.musically": "tiktok.com",
  "com.ss.android.ugc.trill": "tiktok.com",
  "com.reddit.frontpage": "reddit.com",
  "com.pinterest": "pinterest.com",
  "com.Slack": "slack.com",
  "com.discord": "discord.com",
  "org.telegram.messenger": "telegram.org",
  "com.whatsapp": "whatsapp.com",
  "com.google.android.youtube": "youtube.com",
  "com.google.android.gm": "gmail.com",
  "com.microsoft.office.outlook": "outlook.com",
};

const APP_SCHEME_PREFIXES = ["android-app://", "ios-app://"] as const;

export function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

export function parseAppReferrer(rawReferrer: string): { packageName: string } | null {
  for (const prefix of APP_SCHEME_PREFIXES) {
    if (rawReferrer.startsWith(prefix)) {
      const rest = rawReferrer.slice(prefix.length);
      const pkg = rest.split("/")[0];
      return pkg ? { packageName: pkg } : null;
    }
  }
  return null;
}

export function mapAppPackage(packageName: string): string | null {
  return APP_PACKAGE_TO_DOMAIN[packageName] ?? null;
}

export function parseReferrerHost(rawReferrer: string | null): string | null {
  if (!rawReferrer) return null;
  const app = parseAppReferrer(rawReferrer);
  if (app) return mapAppPackage(app.packageName);
  try {
    return normalizeHost(new URL(rawReferrer).hostname);
  } catch {
    return null;
  }
}

// A bare-origin self-referrer is a Referer whose URL is exactly
// `scheme://<own host>/` with no path beyond `/`, no query, no fragment.
// These are noise: browsers send them when the referring page was the
// root landing page, but content-less landing pages make those clicks
// uninformative (often bot-forged). Meaningful same-host referrers like
// `/_/admin/settings` are kept so internal link-click tracking survives.
export function isBareOriginSelfReferrer(rawReferrer: string | null, requestHost: string): boolean {
  if (!rawReferrer) return false;
  try {
    const u = new URL(rawReferrer);
    if (normalizeHost(u.hostname) !== requestHost) return false;
    return u.pathname === "/" && u.search === "" && u.hash === "";
  } catch {
    return false;
  }
}
