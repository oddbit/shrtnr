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
 * language). The four assets are fixed for the life of the isolate, so they
 * are built once at module init and served from a map.
 *
 * A deploy reaches colos one at a time, so for a short window a document
 * from the new build can request its assets from an isolate on the old one
 * (or a stale tab reloads against the new build). The hash in that URL is
 * unknown here. Answering 404 would leave the page unstyled and without its
 * script; the content this build holds for that asset is the better answer,
 * sent with no-store so nothing stale gets pinned under the wrong URL. The
 * next document load carries this build's URL and caches as immutable.
 */

import { Hono } from "hono";
import { adminStyles } from "./styles";
import { adminClientScript } from "./client";
import { getTranslations, isSupportedLanguage, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "./i18n";
import { notFoundResponse } from "./404";
import pkg from "../package.json";

const PREFIX = "/_/assets";
const IMMUTABLE = "public, max-age=31536000, immutable";
const UNPINNED = "no-store";

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

const stylesheet: Asset = {
  path: `${PREFIX}/admin.${contentHash(adminStyles)}.css`,
  body: adminStyles,
  contentType: "text/css; charset=utf-8",
};

const scripts = new Map<SupportedLanguage, Asset>(
  SUPPORTED_LANGUAGES.map((language) => {
    const body = adminClientScript(pkg.version, getTranslations(language));
    return [
      language,
      {
        path: `${PREFIX}/client.${language}.${contentHash(body)}.js`,
        body,
        contentType: "text/javascript; charset=utf-8",
      },
    ];
  }),
);

const byPath = new Map<string, Asset>([stylesheet, ...scripts.values()].map((asset) => [asset.path, asset]));

/** The admin stylesheet's URL for this build. */
export function adminStylesheetPath(): string {
  return stylesheet.path;
}

/** The admin client script's URL for the given language and this build. */
export function adminClientScriptPath(lang: string): string {
  return scripts.get(isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE)!.path;
}

const STYLESHEET_PATH = /^\/_\/assets\/admin\.[0-9a-f]+\.css$/;
const SCRIPT_PATH = /^\/_\/assets\/client\.([a-z]{2})\.[0-9a-f]+\.js$/;

/** The asset another build of this app would have emitted at the path, if the path names one. */
function sameAssetFromThisBuild(path: string): Asset | undefined {
  if (STYLESHEET_PATH.test(path)) return stylesheet;
  const script = path.match(SCRIPT_PATH);
  if (script && isSupportedLanguage(script[1])) return scripts.get(script[1]);
  return undefined;
}

/** Serves the hashed assets. Mounted outside the admin auth: the files carry nothing account-specific. */
export const assetsRouter = new Hono().get(`${PREFIX}/:file`, (c) => {
  const path = new URL(c.req.url).pathname;
  const known = byPath.get(path);
  if (known) return serve(known, IMMUTABLE);
  const fallback = sameAssetFromThisBuild(path);
  if (fallback) return serve(fallback, UNPINNED);
  return notFoundResponse();
});

function serve(asset: Asset, cacheControl: string): Response {
  return new Response(asset.body, {
    headers: { "Content-Type": asset.contentType, "Cache-Control": cacheControl },
  });
}
