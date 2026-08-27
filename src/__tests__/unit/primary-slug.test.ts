// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { pickPrimarySlug } from "../../slugs";
import type { Slug } from "../../types";

function slug(over: Partial<Slug> & { slug: string }): Slug {
  return { link_id: 1, is_custom: 0, is_primary: 0, click_count: 0, created_at: 0, disabled_at: null, ...over };
}

describe("pickPrimarySlug", () => {
  it("returns the slug flagged is_primary wherever it sits in the list", () => {
    const slugs = [slug({ slug: "auto" }), slug({ slug: "promo", is_custom: 1, is_primary: 1 })];
    expect(pickPrimarySlug(slugs)?.slug).toBe("promo");
  });

  it("falls back to the first custom slug when nothing is flagged primary", () => {
    // Slug loaders order auto slugs first, so "first in list" would hand back
    // the random slug. A custom slug is the one the owner chose to publish, so
    // it names the link ahead of the auto one on every surface.
    const slugs = [slug({ slug: "auto" }), slug({ slug: "promo", is_custom: 1 }), slug({ slug: "promo2", is_custom: 1 })];
    expect(pickPrimarySlug(slugs)?.slug).toBe("promo");
  });

  it("falls back to the first slug when nothing is flagged and none is custom", () => {
    const slugs = [slug({ slug: "auto1" }), slug({ slug: "auto2" })];
    expect(pickPrimarySlug(slugs)?.slug).toBe("auto1");
  });

  it("returns undefined for a link with no slugs", () => {
    expect(pickPrimarySlug([])).toBeUndefined();
  });
});
