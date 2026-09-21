// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Content-hashed URLs for the admin stylesheet and client script.
 *
 * Both used to be inlined in every admin document, which therefore had to
 * ship no-cache: 75 KB of CSS and 90 KB of JS on each navigation, 36 to
 * 38 KB gzip. Served from a URL that carries a hash of the content, they
 * can be cached as immutable: a deploy that changes either changes the URL,
 * and a URL a browser already holds is by construction the right content.
 *
 * The hash covers the whole body, so it moves with the app version (the
 * client script embeds it) and with the translations (one script per
 * language). It is computed on first use and memoized for the isolate.
 */

import { Hono } from "hono";
import { adminStyles } from "./styles";
import { adminClientScript } from "./client";
import { getTranslations, isSupportedLanguage, DEFAULT_LANGUAGE, type SupportedLanguage } from "./i18n";
import pkg from "../package.json";

const PREFIX = "/_/assets";
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * 64-bit FNV-1a as two 32-bit lanes, hex encoded. A cache key, not a
 * security boundary: it only has to change whenever the content does.
 */
export function contentHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

interface Asset {
  path: string;
  body: string;
  contentType: string;
}

let stylesheet: Asset | undefined;
const scripts = new Map<SupportedLanguage, Asset>();
const byPath = new Map<string, Asset>();

function register(asset: Asset): Asset {
  byPath.set(asset.path, asset);
  return asset;
}

/** The admin stylesheet's URL for the current content. */
export function adminStylesheetPath(): string {
  if (!stylesheet) {
    stylesheet = register({
      path: `${PREFIX}/admin.${contentHash(adminStyles)}.css`,
      body: adminStyles,
      contentType: "text/css; charset=utf-8",
    });
  }
  return stylesheet.path;
}

/** The admin client script's URL for the given language and the current content. */
export function adminClientScriptPath(lang: string): string {
  const language: SupportedLanguage = isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  let asset = scripts.get(language);
  if (!asset) {
    const body = adminClientScript(pkg.version, getTranslations(language));
    asset = register({
      path: `${PREFIX}/client.${language}.${contentHash(body)}.js`,
      body,
      contentType: "text/javascript; charset=utf-8",
    });
    scripts.set(language, asset);
  }
  return asset.path;
}

/**
 * Resolves a request path to an asset. A URL is only known once a page has
 * emitted it in this isolate; a cold isolate therefore builds the asset the
 * path claims (its language, or the stylesheet) and compares hashes, so a
 * browser that cached a page on one isolate can fetch its assets from any.
 */
function lookup(path: string): Asset | undefined {
  const known = byPath.get(path);
  if (known) return known;
  const script = path.match(/^\/_\/assets\/client\.([a-z]{2})\.[0-9a-f]+\.js$/);
  if (script && isSupportedLanguage(script[1])) {
    adminClientScriptPath(script[1]);
  } else if (/^\/_\/assets\/admin\.[0-9a-f]+\.css$/.test(path)) {
    adminStylesheetPath();
  }
  return byPath.get(path);
}

/** Serves the hashed assets. Mounted outside the admin auth: the files carry nothing account-specific. */
export const assetsRouter = new Hono().get(`${PREFIX}/:file`, (c) => {
  const asset = lookup(new URL(c.req.url).pathname);
  if (!asset) return c.text("Not found", 404);
  return new Response(asset.body, {
    headers: { "Content-Type": asset.contentType, "Cache-Control": IMMUTABLE },
  });
});
