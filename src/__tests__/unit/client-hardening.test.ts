// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// What the admin does in the browser when things go wrong, and what it tells
// the user. Each test cuts handlers out of the generated client script, runs
// them against a stand-in page and API, and asserts on what a user would
// observe: which toast appeared, what the API was sent, what stayed on screen.
// None of them reads the handler's source.

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

type Fn = (...args: unknown[]) => unknown;
type Toast = { message: string; level?: string };

// Small shared helpers a handler may call. They ride along whenever the script
// defines them, so a test names only the handler it is about and keeps running
// (and failing for the right reason) if a helper is renamed or inlined.
const SHARED_HELPERS = ["okJson", "toLocalInputValue"];

/** Loads `names` from the client script with `globals` in scope. */
function load(names: string[], globals: Record<string, unknown>): Record<string, Fn> {
  const keys = Object.keys(globals);
  const helpers = SHARED_HELPERS.filter((h) => !names.includes(h) && script.includes(`\nfunction ${h}(`));
  const body = `${[...helpers, ...names].map(chunk).join("\n")}\nreturn { ${names.join(", ")} };`;
  return new Function(...keys, body)(...keys.map((k) => globals[k])) as Record<string, Fn>;
}

/** Lets every promise chain a handler started run to its end. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, blob: async () => new Blob([JSON.stringify(body)]) };
}

/** The pieces every handler reaches for: toasts, t(), a page, a window. */
function page(fields: Record<string, string> = {}) {
  const toasts: Toast[] = [];
  const modals: string[] = [];
  const elements = new Map<string, Record<string, unknown>>();
  const element = (key: string) => {
    if (!elements.has(key)) {
      elements.set(key, { value: fields[key] ?? "", textContent: "as rendered", style: {}, focus() {}, getAttribute: () => "0" });
    }
    return elements.get(key)!;
  };
  let reloads = 0;
  return {
    toasts,
    modals,
    element,
    reloads: () => reloads,
    globals: {
      toast: (message: string, level?: string) => void toasts.push({ message, level }),
      // t() answers the key, so an assertion names the string that was chosen.
      t: (key: string) => key,
      esc: (s: unknown) => String(s),
      openModal: (html: string) => void modals.push(html),
      closeModal: () => {},
      document: { getElementById: element, querySelector: element, querySelectorAll: () => [] },
      window: { location: { reload: () => void reloads++, href: "" } } as Record<string, unknown>,
    },
  };
}

describe("expiry editor: local time in, the same instant out", () => {
  // Loaded per call, so a missing helper fails the test that needs it rather
  // than the whole file.
  const toLocalInputValue = (epoch: number) => load(["toLocalInputValue"], {}).toLocalInputValue(epoch) as string;

  /**
   * Opens the editor on a link whose stored expiry is `original`, optionally
   * retypes the field, saves, and returns the expires_at the API was sent.
   */
  function saveThroughEditor(original: number | null, retype?: (shown: string) => string): number | null {
    const p = page();
    const field = p.element("detail-expires");
    field.getAttribute = () => (original == null ? "" : String(original));
    let sent: { expires_at: number | null } | undefined;
    const api = (_path: string, opts: { body: string }) => {
      sent = JSON.parse(opts.body);
      return Promise.resolve(response(200, {}));
    };
    const h = load(["beginEditExpiry", "saveDetailExpiry"], { ...p.globals, api });
    h.beginEditExpiry();
    if (retype) field.value = retype(field.value as string);
    h.saveDetailExpiry(1);
    if (!sent) throw new Error("the API was not called");
    return sent.expires_at;
  }

  it("shows the stored instant as a datetime-local value", () => {
    expect(toLocalInputValue(2_000_000_000)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("shows a value the browser parses back to the same minute", () => {
    const epoch = 2_000_000_000 - (2_000_000_000 % 60);
    expect(new Date(toLocalInputValue(epoch)).getTime() / 1000).toBe(epoch);
  });

  it("opening and saving without touching the field keeps the stored instant, seconds included", () => {
    expect(saveThroughEditor(2_000_000_017)).toBe(2_000_000_017);
  });

  it("an edited value replaces the stored instant", () => {
    const original = 2_000_000_017;
    const anHourLater = original + 3600;
    const sent = saveThroughEditor(original, () => toLocalInputValue(anHourLater));
    expect(sent).toBe(anHourLater - (anHourLater % 60));
  });

  it("an emptied field clears the expiry", () => {
    expect(saveThroughEditor(2_000_000_000, () => "")).toBeNull();
  });

  it("opens empty on a link that never expires, and saving that sends null", () => {
    expect(saveThroughEditor(null)).toBeNull();
  });

  it("a link that never expires can be given an expiry", () => {
    const epoch = 2_000_000_040 - (2_000_000_040 % 60);
    expect(saveThroughEditor(null, () => toLocalInputValue(epoch))).toBe(epoch);
  });
});

describe("the link detail page when its analytics poll fails", () => {
  /** Runs loadAnalytics against an API that answers as given and reports what was drawn. */
  async function poll(api: () => Promise<unknown>) {
    const p = page();
    const drawn: string[] = [];
    const draw = (name: string) => (...args: unknown[]) => {
      drawn.push(name);
      return args[0];
    };
    const h = load(["loadAnalytics"], {
      ...p.globals,
      api,
      _tlData: null,
      ACCESS_METHOD_OPTIONS: [],
      fmtNum: (n: unknown) => String(n),
      fmtAvgPerDay: () => "0",
      sumCounts: () => 0,
      countryName: () => "",
      linkModeIcon: () => "",
      deviceIcon: () => "",
      osIcon: () => "",
      fillMissingOptions: draw("fillMissingOptions"),
      renderTimeline: draw("renderTimeline"),
      renderStatCard: draw("renderStatCard"),
      setupStatPager: draw("setupStatPager"),
      updateCount: draw("updateCount"),
    });
    h.loadAnalytics(7, "30d");
    await settle();
    return { drawn, hero: p.element("hero-total-clicks").textContent, toasts: p.toasts };
  }

  // The link was deleted in another tab: the API answers 404 with an error
  // body. The page used to treat that body as statistics and paint
  // "undefined" and "NaN" over the real numbers.
  it("keeps the numbers on screen when the API answers an error", async () => {
    const result = await poll(async () => response(404, { error: "Link not found" }));
    expect(result.hero).toBe("as rendered");
    expect(result.drawn).toEqual([]);
  });

  it("keeps the numbers on screen when the server fails", async () => {
    const result = await poll(async () => response(500, { error: "Internal server error" }));
    expect(result.hero).toBe("as rendered");
    expect(result.drawn).toEqual([]);
  });

  // An unhandled rejection here would fail the run, which is the assertion.
  it("survives a network failure without drawing anything", async () => {
    const result = await poll(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result.hero).toBe("as rendered");
    expect(result.drawn).toEqual([]);
  });

  it("draws the new numbers when the API answers", async () => {
    const stats = { total_clicks: 12, slug_clicks: [], countries: [], referrer_hosts: [], referrers: [] };
    const result = await poll(async () => response(200, stats));
    expect(result.hero).toBe("12");
    expect(result.drawn).toContain("renderTimeline");
  });
});

describe("switching the range on the link detail page", () => {
  const RANGES = ["7d", "30d", "all"];
  const statsOf = (total: number) => ({ total_clicks: total, slug_clicks: [], countries: [], referrer_hosts: [], referrers: [] });

  /**
   * A link detail page with range buttons and an API whose answers the test
   * releases one by one, in the order it chooses.
   */
  function detail(opts: { renderTimeline?: () => void } = {}) {
    const p = page();
    const buttons = RANGES.map((range) => ({ className: "timeline-range-btn", getAttribute: () => range }));
    const pending: { path: string; answer: (res: unknown) => void; fail: (err: unknown) => void }[] = [];
    const api = (path: string) =>
      new Promise((answer, fail) => {
        pending.push({ path, answer, fail });
      });
    // Follows the handler's promise chain to its last link, whatever shape
    // the chain has, so a test can see how the handler's work ended.
    let last: Promise<unknown> = Promise.resolve();
    const follow = (promise: Promise<unknown>) => {
      last = promise;
      // Observed here, so a rejection waits for the test to read it instead
      // of failing the run as unhandled.
      promise.catch(() => {});
      return {
        then: (ok?: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => follow(promise.then(ok, fail)),
        catch: (fail: (e: unknown) => unknown) => follow(promise.catch(fail)),
      };
    };
    const h = load(["loadAnalytics"], {
      ...p.globals,
      Promise: { all: (list: Promise<unknown>[]) => follow(Promise.all(list)), reject: (e: unknown) => Promise.reject(e) },
      document: { ...p.globals.document, querySelectorAll: (sel: string) => (sel === ".timeline-range-btn" ? buttons : []) },
      api,
      _tlData: null,
      ACCESS_METHOD_OPTIONS: [],
      fmtNum: (n: unknown) => String(n),
      fmtAvgPerDay: () => "0",
      sumCounts: () => 0,
      countryName: () => "",
      linkModeIcon: () => "",
      deviceIcon: () => "",
      osIcon: () => "",
      fillMissingOptions: (x: unknown) => x,
      renderTimeline: opts.renderTimeline ?? (() => {}),
      renderStatCard: () => {},
      setupStatPager: () => {},
      updateCount: () => {},
    });
    /** Answers every open request for `range`: 200 with `total` clicks, or the given status. */
    const answer = async (range: string, total: number, status = 200) => {
      for (const req of pending.filter((r) => r.path.includes(`range=${range}`))) {
        req.answer(response(status, status === 200 ? statsOf(total) : { error: "failed" }));
      }
      await settle();
    };
    return {
      load: h.loadAnalytics,
      answer,
      toasts: p.toasts,
      outcome: () => last,
      hero: () => p.element("hero-total-clicks").textContent,
      highlighted: () => buttons.filter((b) => b.className.includes("active")).map((b) => b.getAttribute()),
    };
  }

  // A poll for the old range is still in flight when the user picks a new
  // one. Whichever answer lands last used to win, so the old range's numbers
  // could sit under the new range's highlighted button.
  it("ignores an answer for a range the user has since left", async () => {
    const d = detail();
    d.load(7, "30d");
    d.load(7, "7d", true);
    await d.answer("7d", 7);
    await d.answer("30d", 30);
    expect(d.hero()).toBe("7");
    expect(d.highlighted()).toEqual(["7d"]);
  });

  it("highlights the picked range at once, before the answer arrives", async () => {
    const d = detail();
    d.load(7, "7d", true);
    expect(d.highlighted()).toEqual(["7d"]);
  });

  // The numbers on screen still belong to the old range, so the highlight
  // goes back to it and the user is told.
  it("returns the highlight to the range on screen when a switch fails, and says so", async () => {
    const d = detail();
    d.load(7, "30d");
    await d.answer("30d", 30);
    d.load(7, "7d", true);
    await d.answer("7d", 0, 500);
    expect(d.hero()).toBe("30");
    expect(d.highlighted()).toEqual(["30d"]);
    expect(d.toasts).toEqual([{ message: "client.loadError", level: "error" }]);
  });

  it("stays quiet when a background poll fails", async () => {
    const d = detail();
    d.load(7, "30d");
    await d.answer("30d", 30);
    d.load(7, "30d");
    await d.answer("30d", 0, 500);
    expect(d.hero()).toBe("30");
    expect(d.highlighted()).toEqual(["30d"]);
    expect(d.toasts).toEqual([]);
  });

  // A script error while painting is a defect, not a failed load. Swallowed,
  // it leaves stale numbers on a page whose console looks clean.
  it("does not swallow an error thrown while painting", async () => {
    const d = detail({
      renderTimeline: () => {
        throw new TypeError("paint failed");
      },
    });
    d.load(7, "30d");
    await d.answer("30d", 30);
    // The end of the handler's own promise chain: what the browser would
    // report as an unhandled rejection.
    await expect(d.outcome()).rejects.toThrow("paint failed");
  });
});

describe("downloading the QR code as a PNG", () => {
  // The link was deleted in another tab, so the QR endpoint answers 404 and
  // the image never loads. The button used to do nothing and say nothing.
  it("tells the user when the QR image cannot be loaded", () => {
    const p = page();
    const images: { onerror?: () => void; src?: string }[] = [];
    class FakeImage {
      onerror?: () => void;
      src?: string;
      constructor() {
        images.push(this);
      }
    }
    const h = load(["downloadQrPng"], { ...p.globals, Image: FakeImage, _qrSrc: "/qr", _qrSlug: "abc", URL: {} });
    h.downloadQrPng();
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe("/qr");
    expect(typeof images[0].onerror).toBe("function");
    images[0].onerror!();
    expect(p.toasts).toEqual([{ message: "client.loadError", level: "error" }]);
  });
});

describe("paging a breakdown panel", () => {
  async function next(api: () => Promise<unknown>) {
    const pager = { page: 1, total: 30, loading: false, kind: "links", id: 7, dimension: "countries", range: "30d", color: "orange", opts: {}, denom: 1 };
    const rendered: unknown[] = [];
    const h = load(["statPageGo"], {
      api,
      _statPagers: { card: pager },
      STAT_PAGE_SIZE: 10,
      renderStatPagerFooter: () => {},
      renderStatCard: (_id: string, items: unknown) => void rendered.push(items),
    });
    h.statPageGo("card", 1);
    await settle();
    return { pager, rendered };
  }

  it("stays on the current page, showing what it showed, when the API answers an error", async () => {
    const { pager, rendered } = await next(async () => response(500, { error: "Internal server error" }));
    expect(pager.page).toBe(1);
    expect(rendered).toEqual([]);
    expect(pager.loading).toBe(false);
  });

  it("stays on the current page when the network fails, and can be tried again", async () => {
    const { pager, rendered } = await next(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(pager.page).toBe(1);
    expect(rendered).toEqual([]);
    expect(pager.loading).toBe(false);
  });

  it("moves to the next page and shows its rows when the API answers", async () => {
    const items = [{ name: "SE", count: 3 }];
    const { pager, rendered } = await next(async () => response(200, { items, total: 30 }));
    expect(pager.page).toBe(2);
    expect(rendered).toEqual([items]);
  });
});

describe("downloading a QR code", () => {
  async function download(answer: ReturnType<typeof response>) {
    const p = page();
    const saved: string[] = [];
    const h = load(["downloadQrSvg"], {
      ...p.globals,
      _qrSrc: "/_/admin/api/links/7/qr",
      _qrSlug: "promo",
      fetch: async () => answer,
      URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
      document: {
        createElement: () => {
          const a = { download: "", href: "", click: () => void saved.push(a.download) };
          return a;
        },
      },
    });
    h.downloadQrSvg();
    await settle();
    return { saved, toasts: p.toasts };
  }

  it("saves the SVG under the slug's name", async () => {
    const { saved, toasts } = await download(response(200, "<svg/>"));
    expect(saved).toEqual(["promo-qr.svg"]);
    expect(toasts).toEqual([]);
  });

  // The error is JSON. Saved under an .svg name it is a file nothing opens.
  it("saves no file and tells the user when the server answers an error", async () => {
    const { saved, toasts } = await download(response(404, { error: "Slug not found" }));
    expect(saved).toEqual([]);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].level).toBe("error");
  });
});

describe("toasts say what happened", () => {
  it("an empty slug asks for a slug, and no request is sent", () => {
    const p = page({ "m-new-slug": "   " });
    let requests = 0;
    load(["doAddSlug"], { ...p.globals, api: () => (requests++, Promise.resolve(response(201, {}))) }).doAddSlug(7);
    expect(p.toasts).toEqual([{ message: "client.slugRequired", level: "error" }]);
    expect(requests).toBe(0);
  });

  it.each(["doCreateBundle", "doUpdateBundle"])("%s with an empty name asks for a name, and no request is sent", (handler) => {
    const p = page({ "bundle-name": "  " });
    let requests = 0;
    load([handler], { ...p.globals, api: () => (requests++, Promise.resolve(response(201, {}))) })[handler](3);
    expect(p.toasts).toEqual([{ message: "client.bundles.nameRequired", level: "error" }]);
    expect(requests).toBe(0);
  });

  it("a new primary slug is announced as a primary slug change", async () => {
    const p = page();
    load(["doSetPrimary"], { ...p.globals, api: async () => response(200, {}) }).doSetPrimary(7, "promo");
    await settle();
    expect(p.toasts).toEqual([{ message: "client.primaryUpdated", level: undefined }]);
    expect(p.reloads()).toBe(1);
  });

  it("a refused primary slug change shows the server's sentence", async () => {
    const p = page();
    const refusal = response(403, { error: "Only the link owner can change the primary slug" });
    load(["doSetPrimary"], { ...p.globals, api: async () => refusal }).doSetPrimary(7, "promo");
    await settle();
    expect(p.toasts).toEqual([{ message: "Only the link owner can change the primary slug", level: "error" }]);
    expect(p.reloads()).toBe(0);
  });

  it.each([
    ["the change-primary modal", "showChangePrimaryModal", [7]],
    ["the bundle's link picker", "showAddLinkToBundlePicker", [3, []]],
    ["the add-to-bundle modal", "showAddToBundleModal", [7]],
  ] as const)("%s reports a failed load as a failed load and opens nothing", async (_name, handler, args) => {
    const p = page();
    const h = load([handler], { ...p.globals, api: async () => response(500, { error: "Internal server error" }) });
    h[handler](...args);
    await settle();
    expect(p.toasts).toEqual([{ message: "client.loadError", level: "error" }]);
    expect(p.modals).toEqual([]);
  });

  it("the add-to-bundle modal opens nothing when only one of its two requests fails", async () => {
    const p = page();
    const api = async (path: string) => (path.startsWith("/bundles") ? response(200, []) : response(404, { error: "Link not found" }));
    load(["showAddToBundleModal"], { ...p.globals, api }).showAddToBundleModal(7);
    await settle();
    expect(p.toasts).toEqual([{ message: "client.loadError", level: "error" }]);
    expect(p.modals).toEqual([]);
  });
});

describe("the strings those toasts show", () => {
  const NEW_KEYS = [
    "client.slugRequired",
    "client.bundles.nameRequired",
    "client.primaryUpdated",
    "client.loadError",
    "keys.deleteKey",
  ] as const;

  it("the English copy names the right thing", () => {
    expect(en["client.slugRequired"]).toMatch(/slug/i);
    expect(en["client.slugRequired"]).not.toMatch(/url/i);
    expect(en["client.bundles.nameRequired"]).toMatch(/name/i);
    expect(en["client.bundles.nameRequired"]).not.toMatch(/url/i);
    expect(en["client.primaryUpdated"]).toMatch(/primary/i);
    expect(en["client.primaryUpdated"]).not.toMatch(/label/i);
    expect(en["client.loadError"]).toMatch(/load/i);
    expect(en["client.loadError"]).not.toMatch(/create/i);
    expect(en["keys.deleteKey"]).toMatch(/delete/i);
  });

  it.each([
    ["id", id],
    ["sv", sv],
    ["zh", zh],
  ] as const)("%s carries its own translation of each, not the English text", (_lang, table) => {
    for (const key of NEW_KEYS) {
      expect(table[key], key).toBeTruthy();
      expect(table[key], key).not.toBe(en[key]);
    }
  });

  it("no string is reused for two different outcomes within a language", () => {
    for (const table of [en, id, sv, zh]) {
      const distinct = new Set([
        table["client.urlRequired"],
        table["client.slugRequired"],
        table["client.bundles.nameRequired"],
      ]);
      expect(distinct.size).toBe(3);
      expect(table["client.primaryUpdated"]).not.toBe(table["client.labelUpdated"]);
      expect(table["client.loadError"]).not.toBe(table["client.createLinkError"]);
    }
  });
});

describe("the change-primary modal", () => {
  async function open() {
    const p = page();
    const link = {
      id: 7,
      slugs: [
        { slug: "abc", is_primary: 0 },
        { slug: "promo", is_primary: 1 },
        { slug: "spring", is_primary: 0 },
      ],
    };
    load(["showChangePrimaryModal"], { ...p.globals, api: async () => response(200, link) }).showChangePrimaryModal(7);
    await settle();
    expect(p.modals).toHaveLength(1);
    const tags = p.modals[0].match(/<button\b[^>]*>/g) ?? [];
    return { html: p.modals[0], choices: tags.filter((tag) => tag.includes("doSetPrimary(")) };
  }

  it("offers one button per slug", async () => {
    const { choices, html } = await open();
    expect(choices).toHaveLength(3);
    for (const slug of ["abc", "promo", "spring"]) expect(html).toContain(`/${slug}`);
  });

  // A tag that repeats an attribute keeps the first and drops the rest. The
  // primary row carried two style attributes and lost its layout that way.
  it("no button repeats an attribute", async () => {
    const { choices } = await open();
    for (const tag of choices) {
      const names = [...tag.matchAll(/\s([a-z-]+)=/g)].map((m) => m[1]);
      expect(new Set(names).size, tag).toBe(names.length);
    }
  });

  it("marks the current primary slug, and only that one, apart from the others", async () => {
    const { choices } = await open();
    const shape = (tag: string) => tag.replace(/doSetPrimary\([^)]*\)/, "doSetPrimary()");
    const [abc, promo, spring] = choices.map(shape);
    expect(abc).toBe(spring);
    expect(promo).not.toBe(abc);
  });
});
