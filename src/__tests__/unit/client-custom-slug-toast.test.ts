// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// createLink() makes two API calls when the "New Link" modal's custom-slug
// field is filled in: create the link, then attach the custom slug. The
// second call's success and failure branches used to show the identical
// "Link created" toast either way, so a rejected custom slug (already
// taken, invalid) failed silently: the user was told the slug they asked
// for was attached when it wasn't. This drives createLink() against a
// stubbed api() that succeeds on the first call and fails on the second,
// and asserts the failure actually surfaces.
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

// Fields read by createLink(): url and custom are the interesting ones,
// label/len/expires are left blank so the request body stays minimal.
function fakeDocument() {
  const values: Record<string, string> = {
    "m-url": "https://example.com",
    "m-label": "",
    "m-len": "",
    "m-custom": "taken-slug",
    "m-expires": "",
  };
  return {
    getElementById: (id: string) => ({ value: values[id] ?? "", focus() {} }),
  };
}

// First api() call (create the link) resolves ok with a link id; second
// call (attach the custom slug) resolves with whatever `slugOk`/`slugJson`
// says, mirroring a real POST /links/:id/slugs response.
function loadCreateLink(slugOk: boolean, slugJson: () => Promise<unknown>) {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [
    extractTopLevelChunk(script, /^function createLink\(/),
    extractTopLevelChunk(script, /^function attachCustomSlugAndGo\(/),
    "return { createLink: createLink };",
  ].join("\n");

  const toasts: ToastCall[] = [];
  let call = 0;
  const api = () => {
    call += 1;
    if (call === 1) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 42 }),
      });
    }
    return Promise.resolve({ ok: slugOk, status: slugOk ? 200 : 409, json: slugJson });
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(
    "api",
    "toast",
    "t",
    "closeModal",
    "window",
    "document",
    code,
  ) as (...args: unknown[]) => { createLink: () => void };

  const window_ = { location: { href: "" } };
  const handlers = factory(
    api,
    (message: string, level?: string) => {
      toasts.push({ message, level });
    },
    (key: string) => key,
    () => {},
    window_,
    fakeDocument(),
  );
  return { handlers, toasts, window: window_ };
}

async function waitForToast(toasts: ToastCall[]) {
  for (let i = 0; i < 50 && toasts.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("createLink() custom-slug attach toast", () => {
  it("toasts a distinct error when attaching the requested custom slug fails", async () => {
    const { handlers, toasts, window: win } = loadCreateLink(false, () =>
      Promise.resolve({ error: "slug already taken" }),
    );

    handlers.createLink();
    await waitForToast(toasts);

    expect(toasts).toEqual([{ message: "slug already taken", level: "error" }]);
    // The link itself was created, so the user still lands on its detail page.
    expect(win.location.href).toBe("/_/admin/links/42");
  });

  it("falls back to a generic custom-slug error when the failure body has no message", async () => {
    const { handlers, toasts } = loadCreateLink(false, () => Promise.reject(new Error("no body")));

    handlers.createLink();
    await waitForToast(toasts);

    expect(toasts).toHaveLength(1);
    expect(toasts[0].level).toBe("error");
    expect(toasts[0].message).toBe("client.customError");
  });

  it("toasts the success message when the custom slug attaches", async () => {
    const { handlers, toasts } = loadCreateLink(true, () => Promise.resolve({}));

    handlers.createLink();
    await waitForToast(toasts);

    expect(toasts).toEqual([{ message: "client.linkCreated", level: undefined }]);
  });
});
