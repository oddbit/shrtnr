// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// copyText() resolves false when the clipboard is missing (plain http) or the
// write is refused. Every caller has to read that answer. Before this, the
// callers ignored it and announced a copy that never happened. The worst case
// was the API key modal: "API key copied", then Done, and the key, shown only
// once, was gone. These tests run the client script's own functions against
// stubs and assert which message the user sees for each outcome.
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";
import { extractTopLevelChunk } from "../client-script";

type Toast = { key: string; url?: string; type?: string; ms?: number };

const clipboardOk = (written: string[]) => ({
  clipboard: {
    writeText: (text: string) => {
      written.push(text);
      return Promise.resolve();
    },
  },
});

function chunks(...names: string[]): string {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  return names.map((name) => extractTopLevelChunk(script, new RegExp(`^function ${name}\\(`))).join("\n");
}

// t() echoes the key so each assertion names the message, not its English text.
function stubs(toasts: Toast[]) {
  return {
    toast: (message: string, type?: string, ms?: number) => {
      const parsed = JSON.parse(message) as { key: string; url?: string };
      toasts.push({ ...parsed, ...(type ? { type } : {}), ...(ms ? { ms } : {}) });
    },
    t: (key: string, params?: { url?: string }) => JSON.stringify({ key, ...(params?.url ? { url: params.url } : {}) }),
  };
}

const documentElement = { getAttribute: () => "https://c.example" };

describe("copyUrl() reports the outcome", () => {
  function load(navigatorObject: unknown) {
    const toasts: Toast[] = [];
    const { toast, t } = stubs(toasts);
    const factory = new Function(
      "document",
      "location",
      "navigator",
      "toast",
      "t",
      `${chunks("shortOrigin", "copyText", "copyUrl")}\nreturn copyUrl;`,
    ) as (...args: unknown[]) => (slug: string) => Promise<boolean>;
    const copyUrl = factory({ documentElement }, { origin: "http://localhost:8797" }, navigatorObject, toast, t);
    return { copyUrl, toasts };
  }

  it("confirms a copy that landed", async () => {
    const written: string[] = [];
    const { copyUrl, toasts } = load(clipboardOk(written));

    expect(await copyUrl("abc")).toBe(true);
    expect(written).toEqual(["https://c.example/abc"]);
    expect(toasts).toEqual([{ key: "client.copied", url: "https://c.example/abc" }]);
  });

  it("names the URL to copy by hand when there is no clipboard", async () => {
    const { copyUrl, toasts } = load({});

    expect(await copyUrl("abc")).toBe(false);
    expect(toasts).toEqual([{ key: "client.copyFailedUrl", url: "https://c.example/abc", type: "error", ms: 10000 }]);
  });

  it("names the URL to copy by hand when the write is refused", async () => {
    const { copyUrl, toasts } = load({
      clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) },
    });

    expect(await copyUrl("abc")).toBe(false);
    expect(toasts).toEqual([{ key: "client.copyFailedUrl", url: "https://c.example/abc", type: "error", ms: 10000 }]);
  });
});

describe("copyRawKey() never claims a copy that failed", () => {
  function load(navigatorObject: unknown) {
    const toasts: Toast[] = [];
    const selected: unknown[] = [];
    const { toast, t } = stubs(toasts);
    const keyEl = { textContent: "sk_secret" };
    const document = { getElementById: (id: string) => (id === "revealed-key" ? keyEl : null) };
    const window = { getSelection: () => ({ selectAllChildren: (el: unknown) => selected.push(el) }) };
    const factory = new Function(
      "document",
      "window",
      "navigator",
      "toast",
      "t",
      `${chunks("copyText", "copyRawKey")}\nreturn copyRawKey;`,
    ) as (...args: unknown[]) => () => Promise<boolean>;
    const copyRawKey = factory(document, window, navigatorObject, toast, t);
    return { copyRawKey, toasts, selected, keyEl };
  }

  it("confirms a copy that landed", async () => {
    const written: string[] = [];
    const { copyRawKey, toasts, selected } = load(clipboardOk(written));

    await copyRawKey();

    expect(written).toEqual(["sk_secret"]);
    expect(toasts).toEqual([{ key: "client.apiKeyCopied" }]);
    expect(selected).toEqual([]);
  });

  it("selects the key and says to copy it by hand when there is no clipboard", async () => {
    const { copyRawKey, toasts, selected, keyEl } = load({});

    await copyRawKey();

    expect(toasts).toEqual([{ key: "client.keyCopyFailed", type: "error" }]);
    expect(selected).toEqual([keyEl]);
  });
});

// quickShorten() and createDuplicate() leave the page once the link exists. They
// used to navigate on the line after starting the write, and the browser can
// abort a pending clipboard write on unload. They now wait for the write, up
// to 1.5 s, and announce "created & copied" only when the copy landed.
describe("creating a link waits for the copy before leaving the page", () => {
  type Harness = {
    run: () => Promise<void>;
    events: string[];
    toasts: Toast[];
  };

  function load(entry: "quickShorten" | "createDuplicate", navigatorObject: unknown, events: string[]): Harness {
    const toasts: Toast[] = [];
    const { toast, t } = stubs(toasts);
    const link = { id: 42, slugs: [{ slug: "abc", is_primary: true, is_custom: false }] };
    let settled: Promise<unknown> = Promise.resolve();
    const api = () => {
      const response = { ok: true, status: 201, json: () => Promise.resolve(link) };
      return {
        then: (fn: (res: unknown) => Promise<unknown>) => {
          settled = fn(response);
          return settled;
        },
      };
    };
    const location = {
      origin: "http://localhost:8797",
      set href(value: string) {
        events.push(`navigate ${value}`);
      },
    };
    const document = {
      documentElement,
      getElementById: (id: string) => (id === "quick-url" ? { value: "https://example.com/new" } : null),
    };
    const loggingToast = (message: string, type?: string) => {
      toast(message, type);
      events.push(`toast ${toasts[toasts.length - 1].key}`);
    };
    const factory = new Function(
      "document",
      "window",
      "location",
      "navigator",
      "toast",
      "t",
      "api",
      `${chunks("shortOrigin", "copyText", "copyUrl", "pickPrimarySlug", "isUrl", "copyThenOpen", entry)}\nreturn ${entry};`,
    ) as (...args: unknown[]) => (url?: string) => void;
    const fn = factory(document, { location }, location, navigatorObject, loggingToast, t, api);
    return {
      run: async () => {
        fn("https://example.com/new");
        await settled;
      },
      events,
      toasts,
    };
  }

  for (const entry of ["quickShorten", "createDuplicate"] as const) {
    it(`${entry}: copies, confirms, then navigates`, async () => {
      const events: string[] = [];
      const written: string[] = [];
      const writing = {
        clipboard: {
          writeText: (text: string) => {
            events.push("write started");
            return new Promise<void>((resolve) =>
              setTimeout(() => {
                written.push(text);
                events.push("write settled");
                resolve();
              }, 0),
            );
          },
        },
      };
      const { run } = load(entry, writing, events);

      await run();

      expect(written).toEqual(["https://c.example/abc"]);
      expect(events).toEqual([
        "write started",
        "write settled",
        "toast client.linkCreatedCopied",
        "navigate /_/admin/links/42",
      ]);
    });

    it(`${entry}: does not announce a copy when the clipboard is missing`, async () => {
      const events: string[] = [];
      const { run, toasts } = load(entry, {}, events);

      await run();

      expect(toasts.map((toast) => toast.key)).not.toContain("client.linkCreatedCopied");
      expect(events[events.length - 1]).toBe("navigate /_/admin/links/42");
    });

    it(`${entry}: opens the link page when the write never settles`, async () => {
      vi.useFakeTimers();
      const events: string[] = [];
      const pending = { clipboard: { writeText: () => new Promise<void>(() => {}) } };
      const { run, toasts } = load(entry, pending, events);

      const done = run();
      await vi.advanceTimersByTimeAsync(1499);
      expect(events).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      await done;

      expect(toasts).toEqual([]);
      expect(events).toEqual(["navigate /_/admin/links/42"]);
    });
  }
});

afterEach(() => {
  vi.useRealTimers();
});
