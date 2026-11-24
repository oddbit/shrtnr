// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Behavior of single handlers cut out of the generated admin client script.

import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import en from "../../i18n/en";
import id from "../../i18n/id";
import sv from "../../i18n/sv";
import zh from "../../i18n/zh";
import { extractTopLevelChunk } from "../client-script";

const script = adminClientScript("1.0.0", en);

function chunk(name: string): string {
  return extractTopLevelChunk(script, new RegExp(`^function ${name}\\(`));
}

describe("expiry editor: local time in, the same instant out", () => {
  const toLocalInputValue = new Function(`${chunk("toLocalInputValue")}\nreturn toLocalInputValue;`)() as (
    epoch: number,
  ) => string;

  /**
   * Opens the editor on a link whose stored expiry is `original`, optionally
   * retypes the field, saves, and returns the expires_at the API was sent.
   */
  function saveThroughEditor(original: number | null, retype?: (shown: string) => string): number | null {
    const input = {
      value: "",
      focus() {},
      style: {},
      getAttribute: () => (original == null ? "" : String(original)),
    };
    const other = { style: {}, focus() {} };
    const document = { getElementById: (id: string) => (id === "detail-expires" ? input : other) };
    const window: Record<string, unknown> = { location: { reload() {} } };
    let sent: { expires_at: number | null } | undefined;
    const api = (_path: string, opts: { body: string }) => {
      sent = JSON.parse(opts.body);
      return Promise.resolve({ ok: true });
    };
    const load = new Function(
      "document",
      "window",
      "api",
      "toast",
      "t",
      `${chunk("toLocalInputValue")}\n${chunk("beginEditExpiry")}\n${chunk("saveDetailExpiry")}\nreturn { beginEditExpiry, saveDetailExpiry };`,
    );
    const handlers = load(document, window, api, () => {}, (k: string) => k) as {
      beginEditExpiry: () => void;
      saveDetailExpiry: (id: number) => void;
    };
    handlers.beginEditExpiry();
    if (retype) input.value = retype(input.value);
    handlers.saveDetailExpiry(1);
    if (!sent) throw new Error("the API was not called");
    return sent.expires_at;
  }

  const expiryFromInput = (value: string, original: number | null) => saveThroughEditor(original, () => value);

  it("formats with the local-time getters, never the UTC ones", () => {
    const body = chunk("toLocalInputValue");
    expect(body).toContain("getHours()");
    expect(body).toContain("getDate()");
    expect(body).not.toContain("getUTC");
    expect(body).not.toContain("toISOString");
  });

  it("produces a datetime-local value", () => {
    expect(toLocalInputValue(2_000_000_000)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("round-trips: what it shows parses back to the same minute", () => {
    const epoch = 2_000_000_000 - (2_000_000_000 % 60);
    expect(expiryFromInput(toLocalInputValue(epoch), null)).toBe(epoch);
  });

  it("an unchanged save keeps the stored instant, seconds included", () => {
    const original = 2_000_000_017;
    expect(saveThroughEditor(original)).toBe(original);
  });

  it("opens empty on a link that never expires, and saving that sends null", () => {
    expect(saveThroughEditor(null)).toBeNull();
  });

  it("an edited value replaces the stored instant", () => {
    const original = 2_000_000_017;
    const edited = toLocalInputValue(original + 3600);
    expect(expiryFromInput(edited, original)).toBe(original + 3600 - ((original + 3600) % 60));
  });

  it("an emptied field clears the expiry", () => {
    expect(expiryFromInput("", 2_000_000_000)).toBeNull();
  });
});

describe("analytics polling never renders an error body as data", () => {
  it("loadAnalytics checks both responses and has a rejection handler", () => {
    const body = chunk("loadAnalytics");
    expect(body).toContain("okJson");
    expect(body).toContain(".catch(");
    // The range is a fixed token today; encoding keeps the URL well formed if
    // that ever changes.
    expect(body).toContain("encodeURIComponent(range)");
  });

  it("statPageGo does not advance the page on an error response", () => {
    const body = chunk("statPageGo");
    expect(body).toContain("okJson");
  });

  it("okJson rejects a non-OK response instead of parsing it", async () => {
    const okJson = new Function(`${chunk("okJson")}\nreturn okJson;`)() as (res: unknown) => Promise<unknown>;
    await expect(okJson({ ok: false, status: 404, json: async () => ({ error: "Link not found" }) })).rejects.toThrow();
    await expect(okJson({ ok: true, status: 200, json: async () => ({ total_clicks: 3 }) })).resolves.toEqual({
      total_clicks: 3,
    });
  });

  it("downloadQrSvg does not save an error body as an SVG file", () => {
    expect(chunk("downloadQrSvg")).toContain("r.ok");
  });
});

describe("toasts say what happened", () => {
  it("an empty slug is not reported as a missing URL", () => {
    const body = chunk("doAddSlug");
    expect(body).toContain("t('client.slugRequired')");
    expect(body).not.toContain("t('client.urlRequired')");
  });

  it("an empty bundle name is not reported as a missing URL", () => {
    for (const fn of ["doCreateBundle", "doUpdateBundle"]) {
      const body = chunk(fn);
      expect(body).toContain("t('client.bundles.nameRequired')");
      expect(body).not.toContain("t('client.urlRequired')");
    }
  });

  it("changing the primary slug is not reported as a label update", () => {
    const body = chunk("doSetPrimary");
    expect(body).toContain("t('client.primaryUpdated')");
    expect(body).not.toContain("t('client.labelUpdated')");
  });

  it("a failed load is not reported as a failed link creation", () => {
    for (const fn of ["showChangePrimaryModal", "showAddLinkToBundlePicker", "showAddToBundleModal"]) {
      const body = chunk(fn);
      expect(body).toContain("t('client.loadError')");
      expect(body).not.toContain("t('client.createLinkError')");
    }
  });

  it("every language carries the new strings", () => {
    for (const table of [en, id, sv, zh]) {
      for (const key of [
        "client.slugRequired",
        "client.bundles.nameRequired",
        "client.primaryUpdated",
        "client.loadError",
        "keys.deleteKey",
      ] as const) {
        expect(table[key], key).toBeTruthy();
      }
    }
  });
});

describe("change-primary modal markup", () => {
  it("emits one style attribute per slug button", () => {
    const body = chunk("showChangePrimaryModal");
    // Two style attributes on one element: the parser keeps the first and
    // drops the second, which cost the primary row its layout.
    expect(body).not.toMatch(/' \+ active \+ ' onclick=/);
    expect(body).toContain("slug-choice");
  });
});
