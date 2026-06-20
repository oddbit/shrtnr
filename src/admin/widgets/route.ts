// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Context } from "hono";
import { raw } from "hono/html";
import type { TranslateFn } from "../../i18n";
import { escHtml } from "../../escape";
import { getWidget } from "./registry";
import { buildWidgetCtx } from "./ctx";
import { cacheKey, getCacheVersion, serveCached } from "./cache";

/**
 * Build the swap-friendly error card htmx replaces a failed widget with. The
 * Retry button re-fires the exact request that failed (same id + query) and
 * targets the closest .widget-slot, the shared marker every placeholder shape
 * carries (bento-card and kpi-strip alike), so the swap lands on the right
 * container whatever the widget's shape.
 *
 * `query` is the raw query string without a leading "?" (e.g. "range=30d") and
 * is empty when the request had none.
 */
export function widgetErrorFragment(
  id: string,
  query: string,
  t: TranslateFn,
): string {
  // Everything interpolated into this raw() string must be escaped: `query`
  // comes straight from the request URL and `id`/translations flow in too, so
  // an unescaped `"`, `<`, `>` or `&` would break out of the attribute or the
  // element content (reflected XSS on the error path). escHtml covers the
  // double-quoted attribute and text contexts used here.
  const msg = escHtml(t("widget.error"));
  const retry = escHtml(t("widget.retry"));
  const url = escHtml(`/_/admin/w/${id}${query ? `?${query}` : ""}`);
  return String(
    raw(
      `<div class="widget-error"><p>${msg}</p>` +
        `<button type="button" class="btn btn-sm" hx-get="${url}" hx-target="closest .widget-slot" hx-swap="innerHTML">${retry}</button></div>`,
    ),
  );
}

/**
 * One handler serves every registered widget. It resolves the widget by id,
 * builds the per-request context, parses the widget's params, then either
 * serves a cached fragment or runs the loader and renderer. On loader failure
 * it returns a swap-friendly error card with HTTP 200 so htmx replaces the
 * placeholder rather than aborting the swap on a 5xx.
 */
export async function handleWidget(c: Context): Promise<Response> {
  const id = c.req.param("id");
  const widget = id ? getWidget(id) : undefined;
  if (!widget || !id) return c.notFound();

  const ctx = await buildWidgetCtx(c);
  // params() returns the widget's own typed shape; the cache key reads only
  // range/id off it, so narrow to that shared subset for the key call.
  const params = widget.params(c);
  const keyParams = params as { range?: string; id?: string | number };

  const fragment = async (): Promise<string> => {
    const data = await widget.load(c.env, ctx, params);
    return String(widget.render(data, ctx));
  };

  try {
    let body: string;
    if (widget.cache && widget.cache.ttl > 0) {
      const version = await getCacheVersion(c.env, ctx.identity);
      const key = cacheKey(id, ctx, keyParams, widget.cache, version);
      body = await serveCached(c.env, key, widget.cache.ttl, fragment);
    } else {
      body = await fragment();
    }
    return c.html(body);
  } catch {
    // Re-fire the exact same hx-get (path + query) so Retry repeats the
    // request that failed. Strip the leading "?" so the fragment owns the
    // delimiter and emits no stray "?" when the request carried no query.
    const query = c.req.url.includes("?")
      ? c.req.url.split("?").slice(1).join("?")
      : "";
    return c.html(widgetErrorFragment(id, query, ctx.t), 200);
  }
}
