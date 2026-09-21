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
import { extractTopLevelChunk } from "../client-script";

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
  let modalClosed = false;
  const handlers = factory(
    api,
    (message: string, level?: string) => {
      toasts.push({ message, level });
    },
    (key: string) => key,
    () => {
      modalClosed = true;
    },
    window_,
    fakeDocument(),
  );
  return { handlers, toasts, window: window_, wasModalClosed: () => modalClosed };
}

async function waitForToast(toasts: ToastCall[]) {
  for (let i = 0; i < 50 && toasts.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("createLink() custom-slug attach toast", () => {
  it("toasts a distinct error when attaching the requested custom slug fails", async () => {
    const { handlers, toasts } = loadCreateLink(false, () =>
      Promise.resolve({ error: "slug already taken" }),
    );

    handlers.createLink();
    await waitForToast(toasts);

    expect(toasts).toEqual([{ message: "slug already taken", level: "error" }]);
  });

  // toast() writes into the in-page #toast element with a 3000ms lifetime,
  // so navigating on the failure branch replaces the document and destroys
  // the message before it can be read. The user would land on the detail
  // page carrying only the auto-generated slug with no sign the one they
  // typed was rejected, which is the failure this whole path exists to
  // surface. Hold the modal open instead, the way doAddSlug does.
  it("keeps the modal open and stays on the page when the slug is rejected", async () => {
    const {
      handlers,
      toasts,
      window: win,
      wasModalClosed,
    } = loadCreateLink(false, () => Promise.resolve({ error: "slug already taken" }));

    handlers.createLink();
    await waitForToast(toasts);

    expect(win.location.href).toBe("");
    expect(wasModalClosed()).toBe(false);
  });

  it("falls back to a generic custom-slug error when the failure body has no message", async () => {
    const { handlers, toasts, window: win, wasModalClosed } = loadCreateLink(false, () =>
      Promise.reject(new Error("no body")),
    );

    handlers.createLink();
    await waitForToast(toasts);

    expect(toasts).toHaveLength(1);
    expect(toasts[0].level).toBe("error");
    expect(toasts[0].message).toBe("client.customError");
    expect(win.location.href).toBe("");
    expect(wasModalClosed()).toBe(false);
  });

  it("toasts the success message and navigates when the custom slug attaches", async () => {
    const { handlers, toasts, window: win, wasModalClosed } = loadCreateLink(true, () =>
      Promise.resolve({}),
    );

    handlers.createLink();
    await waitForToast(toasts);

    expect(toasts).toEqual([{ message: "client.linkCreated", level: undefined }]);
    expect(win.location.href).toBe("/_/admin/links/42");
    expect(wasModalClosed()).toBe(true);
  });
});
