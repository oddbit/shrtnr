// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import type { Env } from "../../types";
import type { CachePolicy, WidgetCtx } from "./types";

const VER_PREFIX = "wcache:ver:";

export function cacheKey(
  id: string,
  ctx: WidgetCtx,
  p: { range?: string; id?: string | number },
  policy: CachePolicy | undefined,
  version: string,
): string {
  // Encode every dynamic part. The identity, range and entity are user- or
  // setting-derived; without encoding a value containing `&`, `=` or `%`
  // could inject a fake segment and make two different inputs collide on one
  // key (incorrect fragment reuse). Validated ranges encode to themselves, so
  // this is a no-op for current widgets and pure hardening for future ones.
  const range = encodeURIComponent(policy?.varyByRange === false ? "" : (p.range ?? ""));
  const entity = encodeURIComponent(policy?.varyByEntity ? String(p.id ?? "") : "");
  const u = encodeURIComponent(ctx.identity);
  // The rendered fragment depends on the viewer's language (translations +
  // locale number formatting) and their click filters, and lang can come from
  // a cookie that identity alone does not capture. Key on both so two viewers
  // never share a fragment, and so a settings change lands on a fresh key
  // without waiting on version invalidation.
  const l = encodeURIComponent(ctx.lang);
  const f = `${ctx.filters.excludeBots ? 1 : 0}${ctx.filters.excludeSelfReferrers ? 1 : 0}`;
  // `version` is an opaque token (see bumpCacheVersion), not a counter, so
  // encode it like every other dynamic part.
  return `https://widget.cache/${encodeURIComponent(id)}?u=${u}&l=${l}&f=${f}&r=${range}&e=${entity}&v=${encodeURIComponent(version)}`;
}

export async function getCacheVersion(env: Env, identity: string): Promise<string> {
  if (!env.SLUG_KV) return "0";
  return (await env.SLUG_KV.get(VER_PREFIX + identity)) ?? "0";
}

export async function bumpCacheVersion(env: Env, identity: string): Promise<void> {
  if (!env.SLUG_KV) return;
  // Write a fresh unique token rather than a read-modify-write increment: two
  // concurrent writes for the same identity would both read version N and both
  // write N+1, collapsing to one bump and risking a fragment cached under the
  // unchanged value. A random token guarantees the key changes on every write
  // (KV stays eventually consistent, so this narrows the race, not eliminates).
  await env.SLUG_KV.put(VER_PREFIX + identity, crypto.randomUUID());
}

export async function serveCached(
  env: Env,
  key: string,
  ttl: number,
  produce: () => Promise<string>,
): Promise<string> {
  if (ttl <= 0) return produce();
  const cache = caches.default;
  const req = new Request(key);
  const hit = await cache.match(req);
  if (hit) return hit.text();
  const body = await produce();
  const res = new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": `max-age=${ttl}` },
  });
  await cache.put(req, res.clone());
  return body;
}
