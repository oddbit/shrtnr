// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Verification suite for the documented authorization model.
//
// Every case here answers one question: what does the service layer actually
// do when an owner, a non-owner, or a click history meets a mutation? The
// assertions pin the observed behavior, including the places where the code
// is more permissive than the surrounding prose suggests. Nothing here
// changes behavior; it records it so the README and the OpenAPI text can be
// written from evidence.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { LinkRepository, BundleRepository } from "../../db";
import {
  addCustomSlugToLink,
  createLink,
  deleteLink,
  disableLink,
  disableSlug,
  enableLink,
  enableSlug,
  getLink,
  getLinkAnalytics,
  getLinkTimeline,
  listLinks,
  removeSlug,
  setSlugPrimary,
  updateLink,
} from "../../services/link-management";
import {
  addLinkToBundle,
  archiveBundle,
  createBundle,
  deleteBundle,
  getBundle,
  getBundleAnalytics,
  listBundleLinks,
  listBundles,
  listBundlesForLink,
  removeLinkFromBundle,
  unarchiveBundle,
  updateBundle,
} from "../../services/bundle-management";

beforeAll(applyMigrations);
beforeEach(async () => {
  await resetData();
  await env.DB.exec("DELETE FROM bundle_links");
  await env.DB.exec("DELETE FROM bundles");
});

const OWNER = "owner@example.com";
const OTHER = "other@example.com";

async function newLink(owner = OWNER, url = "https://example.com/owned") {
  const result = await createLink(env as never, { url, created_by: owner, allow_duplicate: true });
  if (!result.ok) throw new Error(`link setup failed: ${result.error}`);
  return result.data;
}

async function newBundle(owner = OWNER, name = "Owned bundle") {
  const result = await createBundle(env as never, { name }, owner);
  if (!result.ok) throw new Error(`bundle setup failed: ${result.error}`);
  return result.data;
}

/** Record one non-bot click against a slug, the way the redirect handler does. */
async function seedClick(slug: string) {
  await env.DB
    .prepare(
      "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 0, 0)",
    )
    .bind(slug, Math.floor(Date.now() / 1000))
    .run();
}

/** Primary (system-generated) slug of a freshly created link. */
function systemSlug(link: { slugs: { slug: string; is_custom: number }[] }): string {
  return link.slugs.find((s) => s.is_custom === 0)!.slug;
}

// ===================================================================
// Claim 1 + 2: link ownership, and delete only while unclicked.
// ===================================================================

describe("links: delete is owner-only and only while the link has no clicks", () => {
  it("owner deletes a zero-click link", async () => {
    const link = await newLink();
    const result = await deleteLink(env as never, link.id, OWNER);
    expect(result.ok).toBe(true);
    expect(await LinkRepository.getById(env.DB, link.id)).toBeNull();
  });

  it("owner deleting a clicked link is refused with 400 and the exact disable hint", async () => {
    const link = await newLink();
    await seedClick(systemSlug(link));

    const result = await deleteLink(env as never, link.id, OWNER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toBe("Cannot delete a link with clicks, disable it instead");
    // The refusal is not a partial delete: the row survives intact.
    expect(await LinkRepository.getById(env.DB, link.id)).not.toBeNull();
  });

  it("owner disables the clicked link instead, and that succeeds", async () => {
    const link = await newLink();
    await seedClick(systemSlug(link));

    const result = await disableLink(env as never, link.id, OWNER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.expires_at).toBeGreaterThan(0);
  });

  it("a single bot click is enough to block delete", async () => {
    // The guard counts lifetime clicks with no filtering, so traffic the
    // dashboard hides still pins the link in place.
    const link = await newLink();
    await env.DB
      .prepare(
        "INSERT INTO clicks (slug, clicked_at, link_mode, is_bot, is_self_referrer) VALUES (?, ?, 'link', 1, 0)",
      )
      .bind(systemSlug(link), Math.floor(Date.now() / 1000))
      .run();

    const result = await deleteLink(env as never, link.id, OWNER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("ownership outranks the click rule: a non-owner gets 403, not the 400 click refusal", async () => {
    const link = await newLink();
    await seedClick(systemSlug(link));

    const result = await deleteLink(env as never, link.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("Only the link owner can delete this link");
    }
  });
});

describe("links: non-owner mutations are refused with 403, missing links with 404", () => {
  const table: {
    name: string;
    call: (linkId: number, identity: string) => Promise<{ ok: boolean; status: number; error?: string }>;
    message: string;
  }[] = [
    {
      name: "delete",
      call: (id, who) => deleteLink(env as never, id, who),
      message: "Only the link owner can delete this link",
    },
    {
      name: "update",
      call: (id, who) => updateLink(env as never, id, { url: "https://evil.example" }, who),
      message: "Only the link owner can update this link",
    },
    {
      name: "disable",
      call: (id, who) => disableLink(env as never, id, who),
      message: "Only the link owner can disable this link",
    },
    {
      name: "enable",
      call: (id, who) => enableLink(env as never, id, who),
      message: "Only the link owner can enable this link",
    },
  ];

  for (const row of table) {
    it(`${row.name} by a non-owner returns 403`, async () => {
      const link = await newLink();
      const result = await row.call(link.id, OTHER);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
        expect(result.error).toBe(row.message);
      }
    });

    it(`${row.name} on a link that does not exist returns 404, distinct from 403`, async () => {
      const result = await row.call(999999, OTHER);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(404);
    });
  }

  it("a rejected update leaves the destination untouched", async () => {
    const link = await newLink();
    await updateLink(env as never, link.id, { url: "https://evil.example" }, OTHER);
    const after = await LinkRepository.getById(env.DB, link.id);
    expect(after!.url).toBe("https://example.com/owned");
  });
});

// ===================================================================
// Claim 3: read is shared across owners.
// ===================================================================

describe("links: any authenticated caller reads any link and its analytics", () => {
  it("a non-owner reads another user's link by id", async () => {
    const link = await newLink();
    const result = await getLink(env as never, link.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.created_by).toBe(OWNER);
  });

  it("the link listing is not scoped to the caller", async () => {
    await newLink(OWNER, "https://example.com/a");
    await newLink(OTHER, "https://example.com/b");
    const result = await listLinks(env as never);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((l) => l.created_by).sort()).toEqual([OTHER, OWNER]);
    }
  });

  it("a non-owner reads another user's link analytics and timeline", async () => {
    const link = await newLink();
    await seedClick(systemSlug(link));

    const analytics = await getLinkAnalytics(env as never, link.id, "all");
    expect(analytics.ok).toBe(true);
    if (analytics.ok) expect(analytics.data.total_clicks).toBe(1);

    const timeline = await getLinkTimeline(env as never, link.id, "all");
    expect(timeline.ok).toBe(true);
  });

  it("read functions take no identity argument at all, so there is nothing to scope on", () => {
    // Pinned as a signature fact: getLink, getLinkAnalytics and getLinkTimeline
    // accept (env, id, ...) with no caller. Open read is structural here, not a
    // check that happens to pass.
    expect(getLink.length).toBeLessThanOrEqual(3);
    expect(getLinkAnalytics.length).toBeLessThanOrEqual(4);
  });
});

// ===================================================================
// Slugs: same owner gate, same click rule, plus system-slug protection.
// ===================================================================

describe("slugs: removal is owner-only, custom-only, and only while unclicked", () => {
  it("owner removes a zero-click custom slug", async () => {
    const link = await newLink();
    await addCustomSlugToLink(env as never, link.id, { slug: "zero-click" });
    const result = await removeSlug(env as never, link.id, "zero-click", OWNER);
    expect(result.ok).toBe(true);
  });

  it("owner removing a clicked custom slug is refused with 400 and the disable hint", async () => {
    const link = await newLink();
    await addCustomSlugToLink(env as never, link.id, { slug: "clicked-slug" });
    await seedClick("clicked-slug");

    const result = await removeSlug(env as never, link.id, "clicked-slug", OWNER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("Cannot remove a slug with clicks, disable it instead");
    }
  });

  it("owner disables the clicked slug instead, and that succeeds", async () => {
    const link = await newLink();
    await addCustomSlugToLink(env as never, link.id, { slug: "clicked-slug" });
    await seedClick("clicked-slug");

    const result = await disableSlug(env as never, link.id, "clicked-slug", OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.disabled_at).toBeGreaterThan(0);
  });

  it("the system-generated slug can be neither removed nor disabled, even by the owner", async () => {
    const link = await newLink();
    const slug = systemSlug(link);

    const removed = await removeSlug(env as never, link.id, slug, OWNER);
    expect(removed.ok).toBe(false);
    if (!removed.ok) {
      expect(removed.status).toBe(400);
      expect(removed.error).toBe("Cannot remove the system-generated slug; only custom slugs can be removed.");
    }

    const disabled = await disableSlug(env as never, link.id, slug, OWNER);
    expect(disabled.ok).toBe(false);
    if (!disabled.ok) {
      expect(disabled.status).toBe(400);
      expect(disabled.error).toContain("Cannot disable the system-generated slug");
    }
  });
});

describe("slugs: non-owner mutations are refused with 403", () => {
  it("disable, enable, remove and set-primary all return 403 for a non-owner", async () => {
    const link = await newLink();
    await addCustomSlugToLink(env as never, link.id, { slug: "guarded" });

    const results = [
      await disableSlug(env as never, link.id, "guarded", OTHER),
      await enableSlug(env as never, link.id, "guarded", OTHER),
      await removeSlug(env as never, link.id, "guarded", OTHER),
      await setSlugPrimary(env as never, link.id, "guarded", OTHER),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(403);
    }
  });

  it("GAP: adding a custom slug to another user's link is NOT owner-gated and succeeds", async () => {
    // addCustomSlugToLink takes no identity argument, so there is no owner
    // check to apply. Any authenticated caller can mint a new public URL that
    // points at someone else's destination. Recorded, not patched.
    const link = await newLink();
    const result = await addCustomSlugToLink(env as never, link.id, { slug: "added-by-stranger" });
    expect(result.ok).toBe(true);

    const after = await LinkRepository.getById(env.DB, link.id);
    expect(after!.slugs.map((s) => s.slug)).toContain("added-by-stranger");
    expect(after!.created_by).toBe(OWNER);
  });
});

// ===================================================================
// Claim 4: bundles.
// ===================================================================

describe("bundles: create and read", () => {
  it("any authenticated caller creates a bundle and owns it", async () => {
    const result = await createBundle(env as never, { name: "Mine" }, OTHER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.created_by).toBe(OTHER);
  });

  it("a non-owner reads another user's bundle, its links, and its analytics", async () => {
    const bundle = await newBundle();
    const link = await newLink();
    await addLinkToBundle(env as never, bundle.id, link.id, OWNER);
    await seedClick(systemSlug(link));

    const read = await getBundle(env as never, bundle.id, OTHER);
    expect(read.ok).toBe(true);

    const links = await listBundleLinks(env as never, bundle.id, OTHER);
    expect(links.ok).toBe(true);
    if (links.ok) expect(links.data).toHaveLength(1);

    const stats = await getBundleAnalytics(env as never, bundle.id, "all", OTHER);
    expect(stats.ok).toBe(true);

    const memberships = await listBundlesForLink(env as never, link.id, OTHER);
    expect(memberships.ok).toBe(true);
    if (memberships.ok) expect(memberships.data).toHaveLength(1);
  });

  it("the bundle listing is not scoped to the caller", async () => {
    await newBundle(OWNER, "Owner bundle");
    await newBundle(OTHER, "Other bundle");
    const result = await listBundles(env as never, OWNER, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });
});

describe("bundles: update, archive, unarchive and delete are owner-only", () => {
  const table: {
    name: string;
    call: (bundleId: number, identity: string) => Promise<{ ok: boolean; status: number; error?: string }>;
    message: string;
  }[] = [
    {
      name: "update",
      call: (id, who) => updateBundle(env as never, id, { name: "Renamed" }, who),
      message: "Only the bundle owner can update this bundle",
    },
    {
      name: "archive",
      call: (id, who) => archiveBundle(env as never, id, who),
      message: "Only the bundle owner can archive this bundle",
    },
    {
      name: "unarchive",
      call: (id, who) => unarchiveBundle(env as never, id, who),
      message: "Only the bundle owner can unarchive this bundle",
    },
    {
      name: "delete",
      call: (id, who) => deleteBundle(env as never, id, who),
      message: "Only the bundle owner can delete this bundle",
    },
    {
      name: "remove link",
      call: (id, who) => removeLinkFromBundle(env as never, id, 1, who),
      message: "Only the bundle owner can remove links from this bundle",
    },
  ];

  for (const row of table) {
    it(`${row.name} by the owner succeeds`, async () => {
      const bundle = await newBundle();
      const result = await row.call(bundle.id, OWNER);
      expect(result.ok).toBe(true);
    });

    it(`${row.name} by a non-owner returns 403`, async () => {
      const bundle = await newBundle();
      const result = await row.call(bundle.id, OTHER);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
        expect(result.error).toBe(row.message);
      }
    });

    it(`${row.name} on a bundle that does not exist returns 404, distinct from 403`, async () => {
      const result = await row.call(999999, OTHER);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(404);
    });
  }
});

describe("bundles: archive is reversible hiding, delete has no click rule", () => {
  it("archive hides the bundle from the default listing and unarchive restores it", async () => {
    const bundle = await newBundle();
    await archiveBundle(env as never, bundle.id, OWNER);

    const defaultList = await listBundles(env as never, OWNER, {});
    expect(defaultList.ok).toBe(true);
    if (defaultList.ok) expect(defaultList.data).toHaveLength(0);

    const archivedList = await listBundles(env as never, OWNER, { archivedOnly: true });
    expect(archivedList.ok).toBe(true);
    if (archivedList.ok) expect(archivedList.data).toHaveLength(1);

    await unarchiveBundle(env as never, bundle.id, OWNER);
    const restored = await listBundles(env as never, OWNER, {});
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.data).toHaveLength(1);
  });

  it("a bundle whose links have clicks is still deletable: the zero-click rule does not apply to bundles", async () => {
    const bundle = await newBundle();
    const link = await newLink();
    await addLinkToBundle(env as never, bundle.id, link.id, OWNER);
    await seedClick(systemSlug(link));

    const result = await deleteBundle(env as never, bundle.id, OWNER);
    expect(result.ok).toBe(true);
    expect(await BundleRepository.getById(env.DB, bundle.id)).toBeNull();
    // Only the membership goes; the clicked link itself survives.
    expect(await LinkRepository.getById(env.DB, link.id)).not.toBeNull();
  });
});

describe("bundles: membership across owners", () => {
  it("the bundle owner adds a link owned by someone else", async () => {
    const bundle = await newBundle(OWNER);
    const foreignLink = await newLink(OTHER, "https://example.com/theirs");
    const result = await addLinkToBundle(env as never, bundle.id, foreignLink.id, OWNER);
    expect(result.ok).toBe(true);
  });

  it("the bundle owner removes a link owned by someone else from their own bundle", async () => {
    const bundle = await newBundle(OWNER);
    const foreignLink = await newLink(OTHER, "https://example.com/theirs");
    await addLinkToBundle(env as never, bundle.id, foreignLink.id, OWNER);

    const result = await removeLinkFromBundle(env as never, bundle.id, foreignLink.id, OWNER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.removed).toBe(true);
  });

  it("owning the link does not let you pull it out of someone else's bundle", async () => {
    const bundle = await newBundle(OWNER);
    const foreignLink = await newLink(OTHER, "https://example.com/theirs");
    await addLinkToBundle(env as never, bundle.id, foreignLink.id, OWNER);

    const result = await removeLinkFromBundle(env as never, bundle.id, foreignLink.id, OTHER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("GAP: adding a link to a bundle is NOT owner-gated on either side", async () => {
    // addLinkToBundle names its identity parameter `_identity` and never reads
    // it. A stranger can file anyone's link into anyone's bundle, which shifts
    // that bundle's headline numbers. Recorded, not patched.
    const bundle = await newBundle(OWNER);
    const foreignLink = await newLink(OTHER, "https://example.com/theirs");

    const result = await addLinkToBundle(env as never, bundle.id, foreignLink.id, "stranger@example.com");
    expect(result.ok).toBe(true);

    const links = await listBundleLinks(env as never, bundle.id, OWNER);
    expect(links.ok).toBe(true);
    if (links.ok) expect(links.data).toHaveLength(1);
  });
});

// ===================================================================
// Edge case: the "anonymous" owner bucket.
// ===================================================================

describe("links created without an identity", () => {
  it("fall back to the literal owner 'anonymous', which is a shared bucket, not an unowned link", async () => {
    // LinkRepository.create writes `createdBy ?? "anonymous"`, and
    // extractIdentity returns the same string when a request carries no
    // identity at all. The two meet: in a deployment where Access is not
    // configured, every unidentified caller is the owner of every
    // unidentified link, so the owner gate passes for all of them.
    const created = await createLink(env as never, { url: "https://example.com/ownerless" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.created_by).toBe("anonymous");

    // A named identity is still locked out.
    const byNamed = await disableLink(env as never, created.data.id, OWNER);
    expect(byNamed.ok).toBe(false);
    if (!byNamed.ok) expect(byNamed.status).toBe(403);

    // Anyone arriving as "anonymous" owns it.
    const byAnonymous = await disableLink(env as never, created.data.id, "anonymous");
    expect(byAnonymous.ok).toBe(true);
  });
});
