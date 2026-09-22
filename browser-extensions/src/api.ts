// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Thin wrapper over @oddbit/shrtnr that reads config from storage,
// guards against internal browser URLs, and maps SDK errors into the
// extension's ErrorCategory taxonomy. The popup and options pages
// import only from here, never from the SDK directly.

import { ShrtnrClient, ShrtnrError } from "@oddbit/shrtnr";
import { getConfig, type Config } from "./storage";
import { ExtensionError, categorizeStatus } from "./errors";
import { MAX_SLUG_LENGTH, QR_SIZE_PX, SLUG_PATTERN } from "./constants";

const NON_SHORTENABLE_PROTOCOLS = new Set([
  "chrome:",
  "chrome-extension:",
  "about:",
  "moz-extension:",
  "edge:",
  "view-source:",
  "file:",
  "data:",
  "javascript:",
]);

export type ShortenResult = {
  id: number;
  slug: string;
  shortUrl: string;
};

export function isShortenable(url: string): boolean {
  if (!url || !url.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (NON_SHORTENABLE_PROTOCOLS.has(parsed.protocol)) return false;
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** Client-side mirror of the server's custom slug rule. The server has the final say. */
export function isValidSlug(slug: string): boolean {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.length > MAX_SLUG_LENGTH) return false;
  return SLUG_PATTERN.test(trimmed);
}

function buildClient(config: Config): ShrtnrClient {
  return new ShrtnrClient({ baseUrl: config.baseUrl, apiKey: config.apiKey });
}

export async function createClient(): Promise<ShrtnrClient | null> {
  const config = await getConfig();
  if (!config) return null;
  return buildClient(config);
}

function rethrow(err: unknown): never {
  if (err instanceof ExtensionError) throw err;
  if (err instanceof ShrtnrError) {
    throw new ExtensionError(categorizeStatus(err.status), err.serverMessage, err.status);
  }
  throw new ExtensionError("network");
}

export async function shortenUrl(url: string): Promise<ShortenResult> {
  if (!isShortenable(url)) {
    throw new ExtensionError("internal-page");
  }
  const config = await getConfig();
  if (!config) {
    throw new Error("shrtnr extension is not configured");
  }
  const client = buildClient(config);
  try {
    const link = await client.links.create({ url });
    const firstSlug = link.slugs?.[0]?.slug;
    if (!firstSlug) {
      throw new ExtensionError("server", "server returned a link with no slugs");
    }
    return {
      id: link.id,
      slug: firstSlug,
      shortUrl: `${config.baseUrl}/${firstSlug}`,
    };
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Adds a custom slug to an existing link (POST /_/api/links/{id}/slugs).
 * The server answers 409 when the slug is taken, which surfaces as the
 * "conflict" category, and 400 for a slug that breaks its rule.
 */
export async function addCustomSlug(linkId: number, slug: string): Promise<ShortenResult> {
  const trimmed = slug.trim();
  if (!isValidSlug(trimmed)) {
    throw new ExtensionError("slug-invalid");
  }
  const config = await getConfig();
  if (!config) {
    throw new Error("shrtnr extension is not configured");
  }
  const client = buildClient(config);
  try {
    const added = await client.slugs.add(linkId, trimmed.toLowerCase());
    return {
      id: linkId,
      slug: added.slug,
      shortUrl: `${config.baseUrl}/${added.slug}`,
    };
  } catch (err) {
    rethrow(err);
  }
}

/** Fetches the QR SVG for a link. Without a slug the server picks the link's primary slug. */
export async function getQrSvg(linkId: number, slug?: string): Promise<string> {
  const config = await getConfig();
  if (!config) {
    throw new Error("shrtnr extension is not configured");
  }
  const client = buildClient(config);
  try {
    const options = slug ? { size: String(QR_SIZE_PX), slug } : { size: String(QR_SIZE_PX) };
    return await client.links.qr(linkId, options);
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Probes the deployment with the cheapest read call. A key scoped to
 * "create" only answers 403 here: the caller treats that as a reachable
 * server with a valid key, not as a failure.
 */
export async function testConnection(config: Config): Promise<void> {
  const client = buildClient(config);
  try {
    await client.links.list({ range: "24h" });
  } catch (err) {
    rethrow(err);
  }
}
