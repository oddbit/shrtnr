// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The slug-action handlers report API failures by reading `error` off a JSON
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
type SlugAction = (linkId: number, slug: string) => void;

const ACTIONS = [
  "doSetPrimary",
  "doDeleteSlug",
  "doDisableSlug",
  "doEnableSlug",
] as const;

// Loads the four handlers with `api` stubbed to a non-ok response whose json()
// rejects, the way a real Response does when the body is empty or HTML.
function loadSlugActions(json: () => Promise<unknown>) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    ...ACTIONS.map((name) =>
      extractTopLevelChunk(script, new RegExp(`^function ${name}\\(`)),
    ),
    `return { ${ACTIONS.map((n) => `${n}: ${n}`).join(", ")} };`,
  ].join("\n");

  const toasts: ToastCall[] = [];
  const factory = new Function(
    "api",
    "toast",
    "t",
    "closeModal",
    "window",
    code,
  ) as (
    api: () => Promise<unknown>,
    toast: (message: string, level?: string) => void,
    t: (key: string) => string,
    closeModal: () => void,
    win: unknown,
  ) => Record<(typeof ACTIONS)[number], SlugAction>;

  const fns = factory(
    () => Promise.resolve({ ok: false, status: 502, json }),
    (message, level) => {
      toasts.push({ message, level });
    },
    (key) => key,
    () => {},
    { location: { reload() {}, href: "" } },
  );
  return { fns, toasts };
}

// The handlers do not return their promise chain, so there is nothing to await.
// Reading a Response body is real I/O rather than a microtask hop, so yield the
// event loop until a toast lands (or give up, which fails the assertion below).
async function waitForToast(toasts: ToastCall[]) {
  for (let i = 0; i < 50 && toasts.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("admin slug-action error toasts", () => {
  it("res.json() really does reject on the bodies this guards against", async () => {
    await expect(new Response("", { status: 502 }).json()).rejects.toThrow();
    await expect(
      new Response("<html>error</html>", { status: 524 }).json(),
    ).rejects.toThrow();
  });

  for (const name of ACTIONS) {
    it(`${name} toasts an error when the failure body is empty`, async () => {
      const { fns, toasts } = loadSlugActions(() =>
        new Response("", { status: 502 }).json(),
      );

      fns[name](1, "my-slug");
      await waitForToast(toasts);

      expect(toasts).toHaveLength(1);
      expect(toasts[0].level).toBe("error");
      expect(toasts[0].message).toBeTruthy();
    });

    it(`${name} toasts an error when the failure body is HTML`, async () => {
      const { fns, toasts } = loadSlugActions(() =>
        new Response("<html>Bad gateway</html>", { status: 502 }).json(),
      );

      fns[name](1, "my-slug");
      await waitForToast(toasts);

      expect(toasts).toHaveLength(1);
      expect(toasts[0].level).toBe("error");
    });

    it(`${name} still prefers the API's error message when one is present`, async () => {
      const { fns, toasts } = loadSlugActions(() =>
        Promise.resolve({ error: "slug is in use" }),
      );

      fns[name](1, "my-slug");
      await waitForToast(toasts);

      expect(toasts).toEqual([{ message: "slug is in use", level: "error" }]);
    });
  }
});
