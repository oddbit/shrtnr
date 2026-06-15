import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, SlugRepository } from "../../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("SlugRepository.findByValue", () => {
  it("returns slug with url and expires_at for a known slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const found = await SlugRepository.findByValue(env.DB, "abc");
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("abc");
    expect(found!.url).toBe("https://example.com");
    expect(found!.link_id).toBe(link.id);
    expect(found!.expires_at).toBeNull();
  });

  it("returns null for a non-existent slug", async () => {
    expect(await SlugRepository.findByValue(env.DB, "nope")).toBeNull();
  });

  it("includes expires_at from the parent link", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "exp", expiresAt: future });
    const found = await SlugRepository.findByValue(env.DB, "exp");
    expect(found!.expires_at).toBe(future);
  });
});

describe("SlugRepository.findForRedirect", () => {
  it("returns url, disabled_at, and expires_at for a known slug", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const found = await SlugRepository.findForRedirect(env.DB, "abc");
    expect(found).not.toBeNull();
    expect(found!.url).toBe("https://example.com");
    expect(found!.disabled_at).toBeNull();
    expect(found!.expires_at).toBeNull();
  });

  it("returns null for a non-existent slug", async () => {
    expect(await SlugRepository.findForRedirect(env.DB, "nope")).toBeNull();
  });

  it("includes expires_at from the parent link", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "exp", expiresAt: future });
    const found = await SlugRepository.findForRedirect(env.DB, "exp");
    expect(found!.expires_at).toBe(future);
  });

  it("includes disabled_at when slug is disabled", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, "my-custom");
    const found = await SlugRepository.findForRedirect(env.DB, "my-custom");
    expect(found!.disabled_at).toBeGreaterThan(0);
  });

  it("does not include click_count", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const found = await SlugRepository.findForRedirect(env.DB, "abc");
    expect(found).not.toHaveProperty("click_count");
  });
});

describe("SlugRepository.exists", () => {
  it("returns true for a slug that exists", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(await SlugRepository.exists(env.DB, "abc")).toBe(true);
  });

  it("returns false for a slug that does not exist", async () => {
    expect(await SlugRepository.exists(env.DB, "nonexistent")).toBe(false);
  });
});

describe("SlugRepository.addCustom", () => {
  it("inserts a custom slug with is_custom = 1", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.is_custom).toBe(1);
    expect(custom.slug).toBe("my-custom");
    expect(custom.link_id).toBe(link.id);
  });

  it("returns the newly inserted slug row", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.slug).toBe("my-custom");
    expect(custom.click_count).toBe(0);
  });

  it("sets first custom slug as primary automatically", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    expect(custom.is_primary).toBe(1);
    // random slug should no longer be primary
    const updated = await LinkRepository.getById(env.DB, link.id);
    const random = updated!.slugs.find((s) => !s.is_custom);
    expect(random!.is_primary).toBe(0);
  });

  it("does not change primary when adding second custom slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const first = await SlugRepository.addCustom(env.DB, link.id, "first-custom");
    await SlugRepository.addCustom(env.DB, link.id, "second-custom");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("first-custom");
  });

  it("allows multiple custom slugs on the same link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom-1");
    await SlugRepository.addCustom(env.DB, link.id, "custom-2");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const vanities = updated!.slugs.filter((s) => s.is_custom);
    expect(vanities).toHaveLength(2);
  });
});

describe("SlugRepository.setPrimary", () => {
  it("sets the specified slug as primary and clears others", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "custom-1");
    await SlugRepository.addCustom(env.DB, link.id, "custom-2");
    const updated = await LinkRepository.getById(env.DB, link.id);
    const second = updated!.slugs.find((s) => s.slug === "custom-2")!;
    await SlugRepository.setPrimary(env.DB, link.id, second.slug);
    const final = await LinkRepository.getById(env.DB, link.id);
    expect(final!.slugs.find((s) => s.slug === "custom-2")!.is_primary).toBe(1);
    expect(final!.slugs.find((s) => s.slug === "custom-1")!.is_primary).toBe(0);
    expect(final!.slugs.find((s) => s.slug === "abc")!.is_primary).toBe(0);
  });

  it("leaves primary flags unchanged when the slug does not belong to the link", async () => {
    const linkA = await LinkRepository.create(env.DB, { url: "https://example.com/a", slug: "aaa" });
    const linkB = await LinkRepository.create(env.DB, { url: "https://example.com/b", slug: "bbb" });

    await SlugRepository.setPrimary(env.DB, linkA.id, "bbb");

    const a = await LinkRepository.getById(env.DB, linkA.id);
    const b = await LinkRepository.getById(env.DB, linkB.id);
    expect(a!.slugs.find((s) => s.slug === "aaa")!.is_primary).toBe(1);
    expect(b!.slugs.find((s) => s.slug === "bbb")!.is_primary).toBe(1);
  });

  it("leaves primary flags unchanged when the slug does not exist at all", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });

    await SlugRepository.setPrimary(env.DB, link.id, "ghost");

    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs.find((s) => s.slug === "abc")!.is_primary).toBe(1);
  });
});

describe("SlugRepository.disable", () => {
  it("sets disabled_at on the slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const disabled = await SlugRepository.disable(env.DB, custom.slug);
    expect(disabled!.disabled_at).toBeGreaterThan(0);
  });

  it("falls back primary to random slug when disabling the primary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, custom.slug);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("abc");
    expect(primary!.is_custom).toBe(0);
  });

  it("does not promote the random slug when the disabled slug stopped being primary before the batch", async () => {
    // The pre-read sees the custom slug as primary, but a concurrent setPrimary
    // moves primary to a different custom slug before the batch runs. The
    // handover must re-check current primary status, or it promotes the random
    // slug alongside the new primary and leaves the link with two primaries.
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "dsprim" });
    await SlugRepository.addCustom(env.DB, link.id, "dsprim-c"); // first custom slug becomes primary
    await SlugRepository.addCustom(env.DB, link.id, "dsprim-c2");
    await SlugRepository.setPrimary(env.DB, link.id, "dsprim-c2"); // primary moves off dsprim-c

    // Stale pre-read: dsprim-c still looks primary even though it no longer is.
    const stale = { ...(await SlugRepository.findByValue(env.DB, "dsprim-c"))!, is_primary: 1 };
    const spy = vi.spyOn(SlugRepository, "findByValue").mockResolvedValueOnce(stale);
    try {
      const result = await SlugRepository.disable(env.DB, "dsprim-c");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
    } finally {
      spy.mockRestore();
    }

    const updated = await LinkRepository.getById(env.DB, link.id);
    const primaries = updated!.slugs.filter((s) => s.is_primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].slug).toBe("dsprim-c2");
  });
});

describe("SlugRepository.enable", () => {
  it("clears disabled_at on the slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.disable(env.DB, custom.slug);
    const enabled = await SlugRepository.enable(env.DB, custom.slug);
    expect(enabled!.disabled_at).toBeNull();
  });
});

describe("SlugRepository.remove", () => {
  it("deletes a custom slug with zero clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const removed = await SlugRepository.remove(env.DB, custom.slug);
    expect(removed).toBe(true);
    const updated = await LinkRepository.getById(env.DB, link.id);
    expect(updated!.slugs).toHaveLength(1);
  });

  it("refuses to delete a slug with clicks", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode) VALUES (?, ?, 'link')").bind(custom.slug, Math.floor(Date.now() / 1000)).run();
    const removed = await SlugRepository.remove(env.DB, custom.slug);
    expect(removed).toBe(false);
  });

  it("refuses to delete a random (non-custom) slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const random = link.slugs.find((s) => !s.is_custom)!;
    const removed = await SlugRepository.remove(env.DB, random.slug);
    expect(removed).toBe(false);
  });

  it("falls back primary to random slug when removing the primary", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const custom = await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    await SlugRepository.remove(env.DB, custom.slug);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primary = updated!.slugs.find((s) => s.is_primary);
    expect(primary!.slug).toBe("abc");
  });

  it("guard holds when a click lands between the pre-read and the batch delete", async () => {
    // The pre-read reports click_count = 0, but a click record exists in the
    // DB by the time the DELETE runs. The NOT EXISTS guard inside the batch
    // must block the delete so the click record is not orphaned.
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "rmrace" });
    await SlugRepository.addCustom(env.DB, link.id, "rmrace-c");
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode) VALUES (?, ?, 'link')")
      .bind("rmrace-c", Math.floor(Date.now() / 1000)).run();

    // Capture the real row (click_count > 0) BEFORE installing the spy, so this
    // read is not itself counted against the mock. The spy then forces the one
    // pre-read inside remove to report click_count = 0, simulating a click that
    // lands after the pre-read but before the batch DELETE.
    const realRow = (await SlugRepository.findByValue(env.DB, "rmrace-c"))!;
    expect(realRow.click_count).toBeGreaterThan(0);
    const spy = vi
      .spyOn(SlugRepository, "findByValue")
      .mockResolvedValueOnce({ ...realRow, click_count: 0 });
    // The pre-read goes through the spy exactly once and sees click_count = 0,
    // so a false result proves the batch NOT EXISTS guard blocked the delete
    // rather than an early return on the click count. The call-count check runs
    // before mockRestore, which clears the recorded calls.
    let removed = false;
    try {
      removed = await SlugRepository.remove(env.DB, "rmrace-c");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
    expect(removed).toBe(false);
    const clickRow = await env.DB.prepare("SELECT 1 FROM clicks WHERE slug = 'rmrace-c'").first();
    const slugRow = await env.DB.prepare("SELECT 1 FROM slugs WHERE slug = 'rmrace-c'").first();
    expect(clickRow).not.toBeNull();
    expect(slugRow).not.toBeNull();

    // The blocked delete must leave the primary set untouched. The custom slug
    // was primary; the handover UPDATE must not run when the delete is guarded,
    // or the link ends up with two primaries.
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primaries = updated!.slugs.filter((s) => s.is_primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].slug).toBe("rmrace-c");
  });

  it("does not promote the random slug when the removed slug stopped being primary before the batch", async () => {
    // The pre-read sees the custom slug as primary, but a concurrent setPrimary
    // moves primary to a different custom slug before the batch runs. The
    // handover must re-check current primary status, or it promotes the random
    // slug alongside the new primary and leaves the link with two primaries.
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "rmprim" });
    await SlugRepository.addCustom(env.DB, link.id, "rmprim-c"); // first custom slug becomes primary
    await SlugRepository.addCustom(env.DB, link.id, "rmprim-c2");
    await SlugRepository.setPrimary(env.DB, link.id, "rmprim-c2"); // primary moves off rmprim-c

    // Stale pre-read: rmprim-c still looks primary even though it no longer is.
    const stale = { ...(await SlugRepository.findByValue(env.DB, "rmprim-c"))!, is_primary: 1 };
    const spy = vi.spyOn(SlugRepository, "findByValue").mockResolvedValueOnce(stale);
    let removed = false;
    try {
      removed = await SlugRepository.remove(env.DB, "rmprim-c");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }

    // rmprim-c has no clicks, so the delete fires; the handover must not run.
    expect(removed).toBe(true);
    const updated = await LinkRepository.getById(env.DB, link.id);
    const primaries = updated!.slugs.filter((s) => s.is_primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].slug).toBe("rmprim-c2");
  });
});
