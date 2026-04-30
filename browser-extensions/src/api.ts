// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Thin wrapper over @oddbit/shrtnr that reads config from storage,
// guards against internal browser URLs, and maps SDK errors into the
// extension's ErrorCategory taxonomy. The popup and options pages
// import only from here — never from the SDK directly.

import { ShrtnrClient, ShrtnrError } from "@oddbit/shrtnr";
import { getConfig, type Config } from "./storage";
import { ExtensionError, categorizeStatus } from "./errors";
import { QR_SIZE_PX } from "./constants";

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

export async function getQrSvg(linkId: number): Promise<string> {
  const config = await getConfig();
  if (!config) {
    throw new Error("shrtnr extension is not configured");
  }
  const client = buildClient(config);
  try {
    return await client.links.qr(linkId, { size: String(QR_SIZE_PX) });
  } catch (err) {
    rethrow(err);
  }
}

export async function testConnection(config: Config): Promise<void> {
  const client = buildClient(config);
  try {
    await client.links.list({ range: "24h" });
  } catch (err) {
    rethrow(err);
  }
}
