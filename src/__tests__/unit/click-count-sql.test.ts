// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { linkClickCountSql, slugClickCountSql } from "../../db/filters";

const OPTS = {
  filters: { excludeBots: true, excludeSelfReferrers: true },
  sinceTs: 1_700_000_000.7,
};

describe("click-count SQL fragments", () => {
  it("closes both fragments with the identical filter and window tail", () => {
    // Popular ordering ranks links by linkClickCountSql while each row renders
    // a slugClickCountSql total. A tail that drifts between the two ranks by
    // one number and prints another, so pin them to the same literal.
    const tail = " AND c.is_bot = 0 AND c.is_self_referrer = 0 AND c.clicked_at >= 1700000000)";
    expect(slugClickCountSql(OPTS)).toContain(tail);
    expect(linkClickCountSql(OPTS)).toContain(tail);
  });

  it("emits no tail when neither filters nor a window are asked for", () => {
    expect(slugClickCountSql()).toBe("(SELECT COUNT(*) FROM clicks c WHERE c.slug = s.slug) AS click_count");
    expect(linkClickCountSql()).toBe(
      "(SELECT COUNT(*) FROM clicks c JOIN slugs cs ON c.slug = cs.slug WHERE cs.link_id = l.id)",
    );
  });

  it("keeps the link fragment correlated to the alias the caller gave the links table", () => {
    expect(linkClickCountSql(undefined, "lk")).toContain("cs.link_id = lk.id");
  });
});
