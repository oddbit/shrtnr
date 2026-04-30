// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Typed wrapper over chrome.storage.sync. Stores a single key, "config",
// holding the configured baseUrl and apiKey. Validates and normalizes on
// write so consumers can trust the values they read.

const STORAGE_KEY = "config";

export type Config = {
  baseUrl: string;
  apiKey: string;
};

type Subscriber = (config: Config | null) => void;

function parseConfig(raw: unknown): Config | null {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.baseUrl !== "string" || typeof r.apiKey !== "string") return null;
  if (!r.baseUrl || !r.apiKey) return null;
  return { baseUrl: r.baseUrl, apiKey: r.apiKey };
}

function normalize(input: Config): Config {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("apiKey must not be empty");
  }

  let url: URL;
  try {
    url = new URL(input.baseUrl);
  } catch {
    throw new Error(`baseUrl is not a valid URL: ${input.baseUrl}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`baseUrl protocol must be http or https, got ${url.protocol}`);
  }

  return { baseUrl: url.origin, apiKey };
}

export async function getConfig(): Promise<Config | null> {
  const raw = await chrome.storage.sync.get(STORAGE_KEY);
  return parseConfig(raw[STORAGE_KEY]);
}

export async function setConfig(config: Config): Promise<void> {
  const normalized = normalize(config);
  await chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
}

export async function clearConfig(): Promise<void> {
  await chrome.storage.sync.remove(STORAGE_KEY);
}

export function onConfigChange(cb: Subscriber): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== "sync") return;
    if (!(STORAGE_KEY in changes)) return;
    cb(parseConfig(changes[STORAGE_KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
