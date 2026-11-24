// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// What the owner did last must hold, whatever else was in flight.
//
// Every test here stages a real overlap and then asks the question a user
// would ask: does my label still say what I typed, does the link I disabled
// still answer 404, did my link get created. Nothing is mocked below the
// service: the competing write goes through the same repositories, and the
// slug collision is a genuine UNIQUE violation raised by D1.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, interleaveDb, resetData } from "../setup";
import { LinkRepository } from "../../db";
import { RANDOM_CHARSET } from "../../slugs";
import { autoLabelLink, createLink, disableLink, getLink, updateLink } from "../../services/link-management";
import type { Env } from "../../types";

const OWNER = "owner@example.com";
const e = env as unknown as Env;
const LINK_WRITE = /^\s*UPDATE\s+links\b/i;
const SLUG_INSERT = /^\s*INSERT\s+INTO\s+slugs\b/i;

beforeAll(applyMigrations);
beforeEach(resetData);
afterEach(() => vi.restoreAllMocks());

async function newLink(): Promise<{ id: number; slug: string }> {
  const created = await createLink(e, { url: "https://example.com/page", created_by: OWNER });
  if (!created.ok) throw new Error(created.error);
  return { id: created.data.id, slug: created.data.slugs[0].slug };
}

async function redirectStatus(slug: string): Promise<number> {
  const res = await SELF.fetch(new Request(`https://shrtnr.test/${slug}`, { redirect: "manual" }));
  return res.status;
}

describe("the background title fetch and what the owner does meanwhile", () => {
  it("keeps a label the owner typed while the title was being fetched", async () => {
    const { id } = await newLink();
    await autoLabelLink(env.DB, id, "https://example.com/page", async () => {
      expect((await updateLink(e, id, { label: "Typed by the owner" }, OWNER)).ok).toBe(true);
      return "Fetched page title";
    });
    const link = await getLink(e, id);
    expect(link.ok && link.data.label).toBe("Typed by the owner");
  });

  it("still labels a link nobody touched", async () => {
    const { id } = await newLink();
    await autoLabelLink(env.DB, id, "https://example.com/page", async () => "Fetched page title");
    const link = await getLink(e, id);
    expect(link.ok && link.data.label).toBe("Fetched page title");
  });

  it("does not undo a retarget made while the title was being fetched", async () => {
    const { id } = await newLink();
    await autoLabelLink(env.DB, id, "https://example.com/page", async () => {
      expect((await updateLink(e, id, { url: "https://example.org/moved" }, OWNER)).ok).toBe(true);
      return "Fetched page title";
    });
    const link = await getLink(e, id);
    expect(link.ok && link.data.url).toBe("https://example.org/moved");
  });

  // The narrow window: the owner disables the link at the very moment the
  // fetched title is being written. The link must stay dead for visitors.
  it("does not bring back a link disabled at the moment the title is written", async () => {
    const { id, slug } = await newLink();
    const racing = interleaveDb(LINK_WRITE, async () => {
      expect((await disableLink(e, id, OWNER)).ok).toBe(true);
    });

    await autoLabelLink(racing, id, "https://example.com/page", async () => "Fetched page title");

    const link = await getLink(e, id);
    expect(link.ok && link.data.expires_at).not.toBeNull();
    expect(await redirectStatus(slug)).toBe(404);
  });
});

describe("an edit and a disable that overlap", () => {
  it("a label edit racing a disable leaves the link disabled, for the owner and for visitors", async () => {
    const { id, slug } = await newLink();
    expect(await redirectStatus(slug)).toBe(301);

    const racing = interleaveDb(LINK_WRITE, async () => {
      expect((await disableLink(e, id, OWNER)).ok).toBe(true);
    });
    const edited = await updateLink({ ...e, DB: racing }, id, { label: "Renamed" }, OWNER);

    expect(edited.ok).toBe(true);
    const link = await getLink(e, id);
    expect(link.ok && link.data.label).toBe("Renamed");
    expect(link.ok && link.data.expires_at).not.toBeNull();
    // The redirect reads the cache the two writes left behind.
    expect(await redirectStatus(slug)).toBe(404);
  });
});

describe("createLink when the slug it picked is taken a moment later", () => {
  // The service checks that a random slug is free and inserts it in a later
  // statement. Another request can claim the same slug in between. That is a
  // lost race, not a server fault: the caller still gets their link.
  //
  // The random source is pinned so the test knows which slug is coming, and a
  // rival link claims exactly that slug just before the insert reaches D1.
  function pinRandomSlugs(): (n: number) => string {
    let call = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(call++);
      return array;
    });
    return (n: number) => RANDOM_CHARSET[n].repeat(3);
  }

  it("creates the link under another slug and leaves the rival's link alone", async () => {
    const nth = pinRandomSlugs();
    const racing = interleaveDb(SLUG_INSERT, () =>
      LinkRepository.create(env.DB, { url: "https://rival.example", slug: nth(0), createdBy: "rival@example.com" }),
    );

    const created = await createLink({ ...e, DB: racing }, {
      url: "https://example.com/mine",
      slug_length: 3,
      created_by: OWNER,
    });

    expect(created).toMatchObject({ ok: true, status: 201 });
    if (!created.ok) return;
    expect(created.data.url).toBe("https://example.com/mine");
    expect(created.data.created_by).toBe(OWNER);
    expect(created.data.slugs.map((s) => s.slug)).toEqual([nth(1)]);

    // The contested slug still leads to the rival, the new one to the caller.
    const rival = await LinkRepository.getBySlug(env.DB, nth(0));
    expect(rival?.url).toBe("https://rival.example");
    const mine = await LinkRepository.getBySlug(env.DB, nth(1));
    expect(mine?.url).toBe("https://example.com/mine");
    // The lost attempt left no half-created link behind.
    expect(await LinkRepository.count(env.DB)).toBe(2);
    expect(await redirectStatus(nth(1))).toBe(301);
  });

  it("answers a 500 result, not an exception, when every attempt loses, and stores no link", async () => {
    const nth = pinRandomSlugs();
    let rivals = 0;
    const racing = interleaveDb(
      SLUG_INSERT,
      () => LinkRepository.create(env.DB, { url: `https://rival.example/${rivals}`, slug: nth(rivals++) }),
      { every: true },
    );

    const created = await createLink({ ...e, DB: racing }, {
      url: "https://example.com/unlucky",
      slug_length: 3,
      created_by: OWNER,
    });

    expect(created).toMatchObject({ ok: false, status: 500 });
    expect(rivals).toBeGreaterThan(1);
    expect(await LinkRepository.findByUrl(env.DB, "https://example.com/unlucky")).toEqual([]);
    expect(await LinkRepository.count(env.DB)).toBe(rivals);
  });

  it("does not swallow a database failure that is not a slug collision", async () => {
    const broken = interleaveDb(SLUG_INSERT, async () => {
      throw new Error("D1_ERROR: database is locked");
    });
    await expect(
      createLink({ ...e, DB: broken }, { url: "https://example.com/broken", created_by: OWNER }),
    ).rejects.toThrow("database is locked");
    expect(await LinkRepository.count(env.DB)).toBe(0);
  });
});
