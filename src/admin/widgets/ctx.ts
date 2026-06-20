// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Context } from "hono";
import type { WidgetCtx } from "./types";
import type { ClickFilters } from "../../db/filters";
import { getAppSettings } from "../../services";
import { createTranslateFn, isSupportedLanguage, DEFAULT_LANGUAGE } from "../../i18n";

/**
 * Read a single cookie value off the raw request, mirroring the helper the
 * admin page handlers use. Returns null when the cookie is absent.
 */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Assemble the per-request widget context once so each widget's generic route
 * handler does not re-derive identity, filters, language and the translate fn.
 *
 * Settings are fetched exactly once: both `filters` and `lang` derive from the
 * same `getAppSettings` result. `resolveClickFilters` is not used here because
 * it would fetch settings a second time per request (it calls getAppSettings
 * internally), doubling the read under the widgets' 30s poll.
 *
 * Language precedence matches the admin pages' `getPageData`: the stored `lang`
 * setting wins, then the `lang` cookie, then the default. Any value outside the
 * supported set clamps to the default. Filters mirror `resolveClickFilters`:
 * both exclusions default on when settings cannot be read.
 */
export async function buildWidgetCtx(c: Context): Promise<WidgetCtx> {
  const identity: string = c.var.identity;
  const settingsResult = await getAppSettings(c.env, identity);
  const filters: ClickFilters = settingsResult.ok
    ? {
        excludeBots: settingsResult.data.filter_bots,
        excludeSelfReferrers: settingsResult.data.filter_self_referrers,
      }
    : { excludeBots: true, excludeSelfReferrers: true };
  const settingsLang = settingsResult.ok ? settingsResult.data.lang : null;
  const langRaw = settingsLang ?? readCookie(c.req.raw, "lang") ?? DEFAULT_LANGUAGE;
  const lang = isSupportedLanguage(langRaw) ? langRaw : DEFAULT_LANGUAGE;
  return { identity, filters, t: createTranslateFn(lang), lang };
}
