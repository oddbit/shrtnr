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
  version: number,
): string {
  const range = policy?.varyByRange === false ? "" : (p.range ?? "");
  const entity = policy?.varyByEntity ? String(p.id ?? "") : "";
  const u = encodeURIComponent(ctx.identity);
  return `https://widget.cache/${id}?u=${u}&r=${range}&e=${entity}&v=${version}`;
}

export async function getCacheVersion(env: Env, identity: string): Promise<number> {
  if (!env.SLUG_KV) return 0;
  const raw = await env.SLUG_KV.get(VER_PREFIX + identity);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export async function bumpCacheVersion(env: Env, identity: string): Promise<void> {
  if (!env.SLUG_KV) return;
  const next = (await getCacheVersion(env, identity)) + 1;
  await env.SLUG_KV.put(VER_PREFIX + identity, String(next));
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
