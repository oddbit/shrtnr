// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Context } from "hono";
import type { WidgetCtx } from "./types";
import { getAppSettings, resolveClickFilters } from "../../services";
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
 * Language precedence matches the admin pages' `getPageData`: the stored `lang`
 * setting wins, then the `lang` cookie, then the default. Any value outside the
 * supported set clamps to the default.
 */
export async function buildWidgetCtx(c: Context): Promise<WidgetCtx> {
  const identity: string = c.var.identity;
  const [filters, settingsResult] = await Promise.all([
    resolveClickFilters(c.env, identity),
    getAppSettings(c.env, identity),
  ]);
  const settingsLang = settingsResult.ok ? settingsResult.data.lang : null;
  const langRaw = settingsLang ?? readCookie(c.req.raw, "lang") ?? DEFAULT_LANGUAGE;
  const lang = isSupportedLanguage(langRaw) ? langRaw : DEFAULT_LANGUAGE;
  return { identity, filters, t: createTranslateFn(lang), lang };
}
