// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The admin action handlers report API failures by reading `error` off a JSON
// error body. Not every failure carries one: an edge-level 502/524 serves an
// HTML page and a bare 500 can serve nothing at all, and res.json() rejects on
// both. Without a fallback the rejection goes unhandled and the user sees no
// toast, so the click looks like it did nothing. These tests extract the real
// handlers from the generated script and drive them against a rejecting
// res.json() to prove a toast still fires.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";

function extractTopLevelChunk(source: string, startPattern: RegExp): string {
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => startPattern.test(l));
  if (startIdx === -1) throw new Error(`chunk not found: ${startPattern}`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^(function |var |if |window\.|document\.)/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

type ToastCall = { message: string; level?: string };
type Handlers = Record<string, (...args: unknown[]) => void>;

// Every handler whose failure path parses a JSON error body. `invoke` supplies
// whatever arguments the handler takes; the stubbed api() ignores them.
const HANDLERS: Array<{ name: string; invoke: (h: Handlers) => void }> = [
  { name: "createKey", invoke: (h) => h.createKey() },
  { name: "doAddSlug", invoke: (h) => h.doAddSlug(1) },
  { name: "doSetPrimary", invoke: (h) => h.doSetPrimary(1, "my-slug") },
  { name: "doDeleteSlug", invoke: (h) => h.doDeleteSlug(1, "my-slug") },
  { name: "doDisableSlug", invoke: (h) => h.doDisableSlug(1, "my-slug") },
  { name: "doEnableSlug", invoke: (h) => h.doEnableSlug(1, "my-slug") },
  { name: "saveDetailLabel", invoke: (h) => h.saveDetailLabel(1) },
  { name: "saveDetailExpiry", invoke: (h) => h.saveDetailExpiry(1) },
  { name: "doCreateBundle", invoke: (h) => h.doCreateBundle() },
  { name: "doUpdateBundle", invoke: (h) => h.doUpdateBundle(1) },
  { name: "doAddLinkToBundle", invoke: (h) => h.doAddLinkToBundle(1, 2) },
];

// Enough of a DOM for the handlers that read form fields before calling the
// API. Every field reads as non-empty so none of them bail out early.
function fakeDocument() {
  const field = { value: "x", focus() {}, style: {} };
  return {
    getElementById: () => field,
    querySelector: () => field,
    querySelectorAll: () => [],
  };
}

// Loads every handler with `api` stubbed to a non-ok response whose json()
// behaves as the test dictates.
function loadHandlers(json: () => Promise<unknown>) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    ...HANDLERS.map((h) =>
      extractTopLevelChunk(script, new RegExp(`^function ${h.name}\\(`)),
    ),
    `return { ${HANDLERS.map((h) => `${h.name}: ${h.name}`).join(", ")} };`,
  ].join("\n");

  const toasts: ToastCall[] = [];
  const factory = new Function(
    "api",
    "toast",
    "t",
    "closeModal",
    "openModal",
    "showKeyRevealModal",
    "window",
    "document",
    code,
  ) as (...args: unknown[]) => Handlers;

  const handlers = factory(
    () => Promise.resolve({ ok: false, status: 502, json }),
    (message: string, level?: string) => {
      toasts.push({ message, level });
    },
    (key: string) => key,
    () => {},
    () => {},
    () => {},
    { location: { reload() {}, href: "" }, __bundleOnCreated: null },
    fakeDocument(),
  );
  return { handlers, toasts };
}

// The handlers do not return their promise chain, so there is nothing to await.
// Reading a Response body is real I/O rather than a microtask hop, so yield the
// event loop until a toast lands (or give up, which fails the assertion below).
async function waitForToast(toasts: ToastCall[]) {
  for (let i = 0; i < 50 && toasts.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("admin action error toasts", () => {
  it("res.json() really does reject on the bodies this guards against", async () => {
    await expect(new Response("", { status: 502 }).json()).rejects.toThrow();
    await expect(
      new Response("<html>error</html>", { status: 524 }).json(),
    ).rejects.toThrow();
  });

  it("leaves no failure path parsing a JSON error body without a fallback", () => {
    const script = adminClientScript("1.0.0", {} as unknown as Translations);
    const unguarded = script
      .split("\n")
      .filter(
        (line) =>
          /res\.json\(\)\.then\(/.test(line) &&
          /toast\(/.test(line) &&
          !/\.catch\(/.test(line),
      );

    expect(unguarded).toEqual([]);
  });

  for (const { name, invoke } of HANDLERS) {
    it(`${name} toasts an error when the failure body is empty`, async () => {
      const { handlers, toasts } = loadHandlers(() =>
        new Response("", { status: 502 }).json(),
      );

      invoke(handlers);
      await waitForToast(toasts);

      expect(toasts).toHaveLength(1);
      expect(toasts[0].level).toBe("error");
      expect(toasts[0].message).toBeTruthy();
    });

    it(`${name} toasts an error when the failure body is HTML`, async () => {
      const { handlers, toasts } = loadHandlers(() =>
        new Response("<html>Bad gateway</html>", { status: 502 }).json(),
      );

      invoke(handlers);
      await waitForToast(toasts);

      expect(toasts).toHaveLength(1);
      expect(toasts[0].level).toBe("error");
    });

    it(`${name} still prefers the API's error message when one is present`, async () => {
      const { handlers, toasts } = loadHandlers(() =>
        Promise.resolve({ error: "upstream said no" }),
      );

      invoke(handlers);
      await waitForToast(toasts);

      expect(toasts).toEqual([{ message: "upstream said no", level: "error" }]);
    });
  }
});
