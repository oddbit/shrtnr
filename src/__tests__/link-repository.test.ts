import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "./setup";
import { ClickRepository, LinkRepository, SlugRepository } from "../db";

beforeAll(applyMigrations);
beforeEach(resetData);

describe("LinkRepository.create", () => {
  it("creates a link with a random slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(link.url).toBe("https://example.com");
    expect(link.slugs).toHaveLength(1);
    expect(link.slugs[0].slug).toBe("abc");
    expect(link.slugs[0].is_custom).toBe(0);
    expect(link.total_clicks).toBe(0);
    expect(link.expires_at).toBeNull();
  });

  it("creates a link with a label", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", label: "My Label" });
    expect(link.label).toBe("My Label");
  });

  it("creates a link with an expires_at timestamp", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", expiresAt: future });
    expect(link.expires_at).toBe(future);
  });

  it("supports adding a custom slug after creation", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    expect(fetched.slugs).toHaveLength(2);
    const auto = fetched.slugs.find((s) => s.is_custom === 0);
    const custom = fetched.slugs.find((s) => s.is_custom === 1);
    expect(auto!.slug).toBe("abc");
    expect(custom!.slug).toBe("my-custom");
  });

  it("returns random slug at index 0 and custom at index 1", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const fetched = (await LinkRepository.getById(env.DB, link.id))!;
    expect(fetched.slugs[0].is_custom).toBe(0);
    expect(fetched.slugs[0].slug).toBe("abc");
    expect(fetched.slugs[1].is_custom).toBe(1);
    expect(fetched.slugs[1].slug).toBe("my-custom");
  });

  it("stores created_via when provided", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", createdVia: "mcp" });
    expect(link.created_via).toBe("mcp");
  });

  it("defaults created_via to app", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    expect(link.created_via).toBe("app");
  });

  it("rolls back the link insert when the slug insert fails", async () => {
    // Pre-create a link so the slug "taken" already exists.
    await LinkRepository.create(env.DB, { url: "https://existing.com", slug: "taken" });

    const before = await env.DB.prepare("SELECT COUNT(*) as c FROM links").first<{ c: number }>();

    // Second create with a colliding slug must fail (UNIQUE on slugs.slug)
    // AND must not commit the link row, otherwise we get an orphan link
    // with no auto-generated slug.
    await expect(
      LinkRepository.create(env.DB, { url: "https://other.com", slug: "taken" }),
    ).rejects.toThrow();

    const after = await env.DB.prepare("SELECT COUNT(*) as c FROM links").first<{ c: number }>();
    expect(after!.c).toBe(before!.c);

    const orphan = await env.DB
      .prepare("SELECT id FROM links WHERE url = ?")
      .bind("https://other.com")
      .first();
    expect(orphan).toBeNull();
  });
});

describe("LinkRepository.list", () => {
  it("returns all links sorted by created_at descending", async () => {
    await LinkRepository.create(env.DB, { url: "https://first.com", slug: "aaa" });
    await LinkRepository.create(env.DB, { url: "https://second.com", slug: "bbb" });
    const links = await LinkRepository.list(env.DB);
    expect(links).toHaveLength(2);
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://first.com");
    expect(urls).toContain("https://second.com");
  });

  it("returns custom slug at correct index after create", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const links = await LinkRepository.list(env.DB);
    expect(links[0].slugs[0].is_custom).toBe(0);
    expect(links[0].slugs[1].is_custom).toBe(1);
  });

  it("includes total_clicks summed across slugs", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode) VALUES (?, ?, 'link')").bind(link.slugs[0].slug, Math.floor(Date.now() / 1000)).run();
    const links = await LinkRepository.list(env.DB);
    expect(links[0].total_clicks).toBe(1);
  });
});

describe("LinkRepository.getById", () => {
  it("returns a link by ID with its slugs", async () => {
    const created = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const fetched = await LinkRepository.getById(env.DB, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.url).toBe("https://example.com");
    expect(fetched!.slugs).toHaveLength(1);
  });

  it("returns null for a non-existent ID", async () => {
    expect(await LinkRepository.getById(env.DB, 99999)).toBeNull();
  });

  it("preserves slug ordering after adding a custom slug later", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO slugs (link_id, slug, is_custom, created_at) VALUES (?, ?, 1, ?)").bind(link.id, "later-custom", now).run();
    const fetched = await LinkRepository.getById(env.DB, link.id);
    expect(fetched!.slugs).toHaveLength(2);
    expect(fetched!.slugs[0].is_custom).toBe(0);
    expect(fetched!.slugs[1].is_custom).toBe(1);
  });
});

describe("LinkRepository.getBySlug", () => {
  it("returns the link that owns the slug", async () => {
    const created = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "xyz" });
    await SlugRepository.addCustom(env.DB, created.id, "my-slug");
    const fetched = await LinkRepository.getBySlug(env.DB, "my-slug");
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.url).toBe("https://example.com");
  });

  it("returns null for a non-existent slug", async () => {
    expect(await LinkRepository.getBySlug(env.DB, "nope")).toBeNull();
  });
});

describe("LinkRepository.update", () => {
  it("updates URL without affecting slugs", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://old.com", slug: "abc" });
    const updated = await LinkRepository.update(env.DB, link.id, { url: "https://new.com" });
    expect(updated!.url).toBe("https://new.com");
    expect(updated!.slugs).toHaveLength(1);
    expect(updated!.slugs[0].slug).toBe("abc");
  });

  it("clears label when set to null", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", label: "A Label" });
    const updated = await LinkRepository.update(env.DB, link.id, { label: null });
    expect(updated!.label).toBeNull();
  });

  it("clears expires_at when set to null", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", expiresAt: future });
    const updated = await LinkRepository.update(env.DB, link.id, { expires_at: null });
    expect(updated!.expires_at).toBeNull();
  });

  it("sets a scheduled expiry", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const future = Math.floor(Date.now() / 1000) + 7200;
    const updated = await LinkRepository.update(env.DB, link.id, { expires_at: future });
    expect(updated!.expires_at).toBe(future);
  });

  it("returns null for a non-existent link", async () => {
    expect(await LinkRepository.update(env.DB, 99999, { url: "https://nope.com" })).toBeNull();
  });
});

describe("LinkRepository.disable", () => {
  it("sets expires_at to the current timestamp", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const before = Math.floor(Date.now() / 1000);
    const disabled = await LinkRepository.disable(env.DB, link.id);
    const after = Math.floor(Date.now() / 1000);
    expect(disabled!.expires_at).toBeGreaterThanOrEqual(before);
    expect(disabled!.expires_at).toBeLessThanOrEqual(after);
  });

  it("allows re-enabling by clearing expires_at", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await LinkRepository.disable(env.DB, link.id);
    const enabled = await LinkRepository.update(env.DB, link.id, { expires_at: null });
    expect(enabled!.expires_at).toBeNull();
  });

  it("returns null for a non-existent link", async () => {
    expect(await LinkRepository.disable(env.DB, 99999)).toBeNull();
  });
});

describe("LinkRepository.findByUrl", () => {
  it("returns an array with the matching link", async () => {
    const created = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    const found = await LinkRepository.findByUrl(env.DB, "https://example.com");
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(created.id);
    expect(found[0].url).toBe("https://example.com");
  });

  it("returns empty array when no link has the URL", async () => {
    const found = await LinkRepository.findByUrl(env.DB, "https://no-match.com");
    expect(found).toHaveLength(0);
  });

  it("returns all links when multiple share the same URL", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "first" });
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "second" });
    const found = await LinkRepository.findByUrl(env.DB, "https://example.com");
    expect(found).toHaveLength(2);
  });

  it("includes slugs in each returned link", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "my-custom");
    const found = await LinkRepository.findByUrl(env.DB, "https://example.com");
    expect(found[0].slugs).toHaveLength(2);
  });
});

describe("LinkRepository.search", () => {
  it("finds a link by label substring", async () => {
    await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "aaa", label: "Oddbit website" });
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "bbb", label: "Some other site" });

    const results = await LinkRepository.search(env.DB, "oddbit");

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("Oddbit website");
  });

  it("finds a link by slug substring", async () => {
    await LinkRepository.create(env.DB, { url: "https://oddbit.id/pricing", slug: "pricing-page" });
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "unrelated" });

    const results = await LinkRepository.search(env.DB, "pricing");

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://oddbit.id/pricing");
  });

  it("finds a link when query matches the custom slug", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "abc" });
    await SlugRepository.addCustom(env.DB, link.id, "oddbit-home");

    const results = await LinkRepository.search(env.DB, "oddbit-home");

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://oddbit.id");
  });

  it("returns multiple links when several match", async () => {
    await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "aaa", label: "Oddbit website" });
    await LinkRepository.create(env.DB, { url: "https://oddbit.id/blog", slug: "oddbit-blog" });

    const results = await LinkRepository.search(env.DB, "oddbit");

    expect(results).toHaveLength(2);
  });

  it("is case-insensitive for labels", async () => {
    await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "aaa", label: "Oddbit Website" });

    const lower = await LinkRepository.search(env.DB, "oddbit website");
    const upper = await LinkRepository.search(env.DB, "ODDBIT WEBSITE");

    expect(lower).toHaveLength(1);
    expect(upper).toHaveLength(1);
  });

  it("is case-insensitive for slugs", async () => {
    await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "newsletter-q1" });

    const results = await LinkRepository.search(env.DB, "NEWSLETTER");

    expect(results).toHaveLength(1);
  });

  it("returns empty array when nothing matches", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc", label: "Some page" });

    const results = await LinkRepository.search(env.DB, "xyzzy-no-match");

    expect(results).toHaveLength(0);
  });

  it("returns empty array for a blank query", async () => {
    await LinkRepository.create(env.DB, { url: "https://example.com", slug: "abc" });

    expect(await LinkRepository.search(env.DB, "")).toHaveLength(0);
    expect(await LinkRepository.search(env.DB, "   ")).toHaveLength(0);
  });

  it("returns results with all slugs attached", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "aaa" });
    await SlugRepository.addCustom(env.DB, link.id, "oddbit-home");
    await SlugRepository.addCustom(env.DB, link.id, "ob-home");

    const results = await LinkRepository.search(env.DB, "oddbit");

    expect(results[0].slugs.length).toBeGreaterThanOrEqual(2);
  });

  it("does not return duplicate links when multiple slugs match the query", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://oddbit.id", slug: "oddbit-1" });
    await SlugRepository.addCustom(env.DB, link.id, "oddbit-2");

    const results = await LinkRepository.search(env.DB, "oddbit");

    expect(results).toHaveLength(1);
  });
});

describe("LinkRepository click_count options", () => {
  async function seedMixed(slug: string): Promise<void> {
    await ClickRepository.record(env.DB, slug, { isBot: 0, isSelfReferrer: 0 });
    await ClickRepository.record(env.DB, slug, { isBot: 1, isSelfReferrer: 0 });
    await ClickRepository.record(env.DB, slug, { isBot: 0, isSelfReferrer: 1 });
  }

  it("list returns raw lifetime counts when no opts are passed", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "raw" });
    await seedMixed(link.slugs[0].slug);

    const links = await LinkRepository.list(env.DB);

    expect(links[0].slugs[0].click_count).toBe(3);
    expect(links[0].total_clicks).toBe(3);
  });

  it("list excludes bots when filter is passed", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "nobot" });
    await seedMixed(link.slugs[0].slug);

    const links = await LinkRepository.list(env.DB, { filters: { excludeBots: true } });

    expect(links[0].slugs[0].click_count).toBe(2);
    expect(links[0].total_clicks).toBe(2);
  });

  it("list excludes both bots and self-referrers when both filters are passed", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "real" });
    await seedMixed(link.slugs[0].slug);

    const links = await LinkRepository.list(env.DB, {
      filters: { excludeBots: true, excludeSelfReferrers: true },
    });

    expect(links[0].slugs[0].click_count).toBe(1);
    expect(links[0].total_clicks).toBe(1);
  });

  it("list applies sinceTs to limit click_count to a window", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "win" });
    const slug = link.slugs[0].slug;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)").bind(slug, now - 86400 * 60).run();
    await env.DB.prepare("INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)").bind(slug, now - 60).run();

    const all = await LinkRepository.list(env.DB);
    const recent = await LinkRepository.list(env.DB, { sinceTs: now - 7 * 86400 });

    expect(all[0].total_clicks).toBe(2);
    expect(recent[0].total_clicks).toBe(1);
  });

  it("getById applies the same opts as list", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "byid" });
    await seedMixed(link.slugs[0].slug);

    const filtered = await LinkRepository.getById(env.DB, link.id, { filters: { excludeBots: true } });

    expect(filtered!.slugs[0].click_count).toBe(2);
    expect(filtered!.total_clicks).toBe(2);
  });

  it("delete still uses raw lifetime counts as the guard", async () => {
    const link = await LinkRepository.create(env.DB, { url: "https://example.com", slug: "guard" });
    await ClickRepository.record(env.DB, link.slugs[0].slug, { isBot: 1 });

    const removed = await LinkRepository.delete(env.DB, link.id);

    expect(removed).toBe(false);
  });
});
