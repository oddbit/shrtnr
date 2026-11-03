// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Provides a minimal in-memory chrome.* API mock for unit and component
// tests. Each test gets a fresh state by calling resetChromeMocks() in a
// beforeEach hook (or the global one below).

import { beforeEach, vi } from "vitest";

type StorageBackend = Record<string, unknown>;

interface MockChrome {
  storage: {
    sync: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      onChanged: {
        addListener: ReturnType<typeof vi.fn>;
        removeListener: ReturnType<typeof vi.fn>;
      };
    };
    onChanged: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  };
  runtime: {
    openOptionsPage: ReturnType<typeof vi.fn>;
    onInstalled: {
      addListener: ReturnType<typeof vi.fn>;
    };
    getURL: (path: string) => string;
  };
  tabs: {
    query: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  permissions: {
    request: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
  };
}

let storageBackend: StorageBackend = {};
let storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];

export function getStorageBackend(): StorageBackend {
  return storageBackend;
}

export function resetChromeMocks(): void {
  storageBackend = {};
  storageListeners = [];

  const mock: MockChrome = {
    storage: {
      sync: {
        get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
          if (keys == null) return { ...storageBackend };
          if (typeof keys === "string") {
            return keys in storageBackend ? { [keys]: storageBackend[keys] } : {};
          }
          if (Array.isArray(keys)) {
            const out: Record<string, unknown> = {};
            for (const k of keys) {
              if (k in storageBackend) out[k] = storageBackend[k];
            }
            return out;
          }
          const out: Record<string, unknown> = {};
          for (const [k, fallback] of Object.entries(keys)) {
            out[k] = k in storageBackend ? storageBackend[k] : fallback;
          }
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: storageBackend[k], newValue: v };
            storageBackend[k] = v;
          }
          for (const cb of storageListeners) cb(changes, "sync");
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const k of list) {
            if (k in storageBackend) {
              changes[k] = { oldValue: storageBackend[k], newValue: undefined };
              delete storageBackend[k];
            }
          }
          for (const cb of storageListeners) cb(changes, "sync");
        }),
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      onChanged: {
        addListener: vi.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
          storageListeners.push(cb);
        }),
        removeListener: vi.fn((cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
          storageListeners = storageListeners.filter((l) => l !== cb);
        }),
      },
    },
    runtime: {
      openOptionsPage: vi.fn(async () => undefined),
      onInstalled: {
        addListener: vi.fn(),
      },
      getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
    },
    tabs: {
      query: vi.fn(async () => [{ url: "https://example.com/page", id: 1, active: true }]),
      create: vi.fn(async (props: { url: string }) => ({ id: 2, url: props.url })),
    },
    permissions: {
      request: vi.fn(async () => true),
      contains: vi.fn(async () => true),
    },
  };

  // @ts-expect-error: assigning to global chrome
  globalThis.chrome = mock;
  // @ts-expect-error: assigning to global browser (Firefox alias)
  globalThis.browser = mock;

  // navigator.clipboard.writeText mock (happy-dom doesn't always expose it).
  if (typeof globalThis.navigator !== "undefined") {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
    // Pin navigator.language so detectLanguage() picks "en" and assertions
    // against English strings hold on any host locale.
    setBrowserLanguage("en-US");
  }
}

/**
 * Sets navigator.language, the tag detectLanguage() reads. The global
 * beforeEach re-pins it to en-US, so an override lasts one case.
 */
export function setBrowserLanguage(language: string): void {
  Object.defineProperty(globalThis.navigator, "language", { configurable: true, value: language });
}

export function getClipboardMock(): { writeText: ReturnType<typeof vi.fn> } {
  return globalThis.navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  resetChromeMocks();
});

export function setStorageItem(key: string, value: unknown): void {
  storageBackend[key] = value;
}
