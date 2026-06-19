// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Context } from "hono";
import { raw } from "hono/html";
import { getWidget } from "./registry";
import { buildWidgetCtx } from "./ctx";
import { cacheKey, getCacheVersion, serveCached } from "./cache";

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
    const msg = ctx.t("widget.error");
    const retry = ctx.t("widget.retry");
    // Re-fire the exact same hx-get (path + query) so Retry repeats the
    // request that failed. The error card swaps into the same bento shell.
    const query = c.req.url.includes("?") ? "?" + c.req.url.split("?").slice(1).join("?") : "";
    return c.html(
      String(
        raw(
          `<div class="widget-error"><p>${msg}</p>` +
            `<button type="button" class="btn btn-sm" hx-get="/_/admin/w/${id}${query}" hx-target="closest .bento-card" hx-swap="innerHTML">${retry}</button></div>`,
        ),
      ),
      200,
    );
  }
}
