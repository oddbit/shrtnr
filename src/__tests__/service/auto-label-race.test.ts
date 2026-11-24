// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// autoLabelLink() runs after the create response, and its title fetch can take
// seconds. Whatever the owner does to the link in that window must survive.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, resetData } from "../setup";
import { autoLabelLink, createLink, disableLink, getLink, updateLink } from "../../services/link-management";
import type { Env } from "../../types";

const OWNER = "owner@example.com";
const e = env as unknown as Env;

beforeAll(applyMigrations);
beforeEach(resetData);

async function newLink(): Promise<number> {
  const created = await createLink(e, { url: "https://example.com/page", created_by: OWNER });
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

describe("autoLabelLink and a concurrent owner edit", () => {
  it("keeps a label the owner typed while the title was being fetched", async () => {
    const id = await newLink();
    await autoLabelLink(env.DB, id, "https://example.com/page", async () => {
      const edited = await updateLink(e, id, { label: "Typed by the owner" }, OWNER);
      expect(edited.ok).toBe(true);
      return "Fetched page title";
    });
    const link = await getLink(e, id);
    expect(link.ok && link.data.label).toBe("Typed by the owner");
  });

  it("does not switch a link back on that was disabled while the title was being fetched", async () => {
    const id = await newLink();
    await autoLabelLink(env.DB, id, "https://example.com/page", async () => {
      const disabled = await disableLink(e, id, OWNER);
      expect(disabled.ok).toBe(true);
      return "Fetched page title";
    });
    const link = await getLink(e, id);
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.data.expires_at).not.toBeNull();
    expect(link.data.label).toBe("Fetched page title");
  });

  it("does not undo a retarget made while the title was being fetched", async () => {
    const id = await newLink();
    await autoLabelLink(env.DB, id, "https://example.com/page", async () => {
      const moved = await updateLink(e, id, { url: "https://example.org/moved" }, OWNER);
      expect(moved.ok).toBe(true);
      return "Fetched page title";
    });
    const link = await getLink(e, id);
    expect(link.ok && link.data.url).toBe("https://example.org/moved");
  });
});
