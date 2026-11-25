// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The Version card on the settings page. A deployment that follows `main`
// runs commits no release holds yet, so the card names the build (date and
// short commit) beside the version and says when that build is past the
// latest release. Each test runs the card's script against a stand-in page
// and GitHub, and asserts on the text a viewer reads.

import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import { sanitizeBuildInfo } from "../../build-info";
import en from "../../i18n/en";
import id from "../../i18n/id";
import sv from "../../i18n/sv";
import zh from "../../i18n/zh";
import { extractTopLevelChunk } from "../client-script";

const COMMIT = "432b90a1c0ffee0000000000000000000000beef";
const BUILD = { commit: COMMIT, date: "2026-11-24T08:15:00Z" };
const RELEASES = "https://api.github.com/repos/oddbit/shrtnr/releases/latest";
const COMPARE = `https://api.github.com/repos/oddbit/shrtnr/compare/app-v0.43.2...${COMMIT}`;

type Answer = { status: number; body?: unknown };

/** Runs the version check and returns the card's text, tags stripped. */
async function card(build: { commit: string | null; date: string | null } | undefined, github: Record<string, Answer>) {
  const script = adminClientScript("0.43.2", en, build);
  const chunk = (name: string) => extractTopLevelChunk(script, new RegExp(`^function ${name}\\(`));
  const el = { innerHTML: "" };
  const asked: string[] = [];
  const globals: Record<string, unknown> = {
    APP_VERSION: "0.43.2",
    BUILD_COMMIT: build?.commit ?? null,
    BUILD_DATE: build?.date ?? null,
    REPO_URL: "https://example.com/repo",
    UI_LANG: "en",
    esc: (s: unknown) => String(s),
    // t() answers the key and its parameters, so an assertion names the string chosen.
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key),
    document: { getElementById: () => el },
    fetch: async (url: string) => {
      asked.push(url);
      const answer = github[url];
      if (!answer) throw new Error("network down");
      return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body };
    },
  };
  const keys = Object.keys(globals);
  const body = `${["compareVersions", "versionLabel", "checkForUpdates"].map(chunk).join("\n")}\ncheckForUpdates();`;
  new Function(...keys, body)(...keys.map((k) => globals[k]));
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const text = el.innerHTML.replace(/<[^>]*>/g, " ").replace(/&rarr;/g, "→").replace(/\s+/g, " ").trim();
  return { text, asked };
}

const released = (tag: string): Answer => ({ status: 200, body: { tag_name: tag, html_url: "https://example.com/release" } });

describe("settings Version card", () => {
  it("names the build date and short commit in parentheses after the version", async () => {
    const { text } = await card(BUILD, { [RELEASES]: released("app-v0.43.2"), [COMPARE]: { status: 200, body: { status: "identical", ahead_by: 0 } } });
    expect(text).toContain("0.43.2 (Nov 24, 2026 · 432b90a)");
    expect(text).toContain("client.upToDate");
    expect(text).not.toContain("client.unreleased");
  });

  it("says the build is unreleased when it holds commits the latest release does not", async () => {
    const { text } = await card(BUILD, { [RELEASES]: released("app-v0.43.2"), [COMPARE]: { status: 200, body: { status: "ahead", ahead_by: 3 } } });
    expect(text).toContain("0.43.2 (Nov 24, 2026 · 432b90a)");
    expect(text).toContain('client.unreleasedMany{"count":3}');
    expect(text).not.toContain("client.upToDate");
  });

  // One phrase, with the version named once: "0.43.2 (...) Unreleased: 3
  // commits ahead". A single commit takes the singular.
  it("says one commit in the singular", async () => {
    const { text } = await card(BUILD, { [RELEASES]: released("app-v0.43.2"), [COMPARE]: { status: 200, body: { status: "ahead", ahead_by: 1 } } });
    expect(text).toContain("client.unreleasedOne");
    expect(text).not.toContain("client.unreleasedMany");
  });

  it("counts a build on a diverged branch as unreleased", async () => {
    const { text } = await card(BUILD, { [RELEASES]: released("app-v0.43.2"), [COMPARE]: { status: 200, body: { status: "diverged", ahead_by: 2, behind_by: 1 } } });
    expect(text).toContain('client.unreleasedMany{"count":2}');
  });

  // A fork's commits are unknown to the upstream repository, and GitHub rate
  // limits anonymous callers. Neither may cost the viewer the version line.
  it("falls back to the version comparison when GitHub cannot compare the commit", async () => {
    for (const compare of [{ status: 404 }, { status: 403 }, undefined]) {
      const github: Record<string, Answer> = { [RELEASES]: released("app-v0.43.2") };
      if (compare) github[COMPARE] = compare;
      const { text } = await card(BUILD, github);
      expect(text).toContain("0.43.2 (Nov 24, 2026 · 432b90a)");
      expect(text).toContain("client.upToDate");
    }
  });

  it("shows the version alone, and asks GitHub for no comparison, when the build is unknown", async () => {
    for (const build of [undefined, { commit: null, date: null }]) {
      const { text, asked } = await card(build, { [RELEASES]: released("app-v0.43.2") });
      expect(text).toContain("0.43.2");
      expect(text).not.toContain("(");
      expect(text).toContain("client.upToDate");
      expect(asked).toEqual([RELEASES]);
    }
  });

  it("shows the commit without a date when the build carries none", async () => {
    const { text } = await card({ commit: COMMIT, date: null }, { [RELEASES]: released("app-v0.43.2") });
    expect(text).toContain("0.43.2 (432b90a)");
  });

  // The app's releases are tagged app-v<version>. The tag prefix is not part
  // of the version: shown raw it reads "app-v0.44.0", and compared raw its
  // major number is not a number, so a 1.x release never counted as newer.
  it("reads the version out of an app-v release tag", async () => {
    const { text } = await card(undefined, { [RELEASES]: released("app-v0.44.0") });
    expect(text).toContain("0.43.2 → 0.44.0 client.updateAvailable");
    expect(text).not.toContain("app-v");

    const major = await card(undefined, { [RELEASES]: released("app-v1.0.0") });
    expect(major.text).toContain("0.43.2 → 1.0.0 client.updateAvailable");

    const plain = await card(undefined, { [RELEASES]: released("v0.44.0") });
    expect(plain.text).toContain("0.43.2 → 0.44.0 client.updateAvailable");
  });

  it("keeps the build beside the version when a newer release exists", async () => {
    const { text, asked } = await card(BUILD, { [RELEASES]: released("app-v0.44.0") });
    expect(text).toContain("0.43.2 (Nov 24, 2026 · 432b90a)");
    expect(text).toContain("0.44.0");
    expect(text).toContain("client.updateAvailable");
    expect(asked).toEqual([RELEASES]);
  });

  it("keeps the build beside the version when the update check fails", async () => {
    const { text } = await card(BUILD, {});
    expect(text).toContain("0.43.2 (Nov 24, 2026 · 432b90a)");
    expect(text).toContain("client.updateCheckFailed");
  });

  it("has the unreleased strings in every language", () => {
    for (const lang of [en, id, sv, zh]) {
      expect(lang["client.unreleasedOne"]).toContain("1");
      expect(lang["client.unreleasedMany"]).toContain("{count}");
    }
  });
});

describe("build info recorded at build time", () => {
  it("keeps a full commit hash and its date", () => {
    expect(sanitizeBuildInfo({ commit: COMMIT, date: "2026-11-24T08:15:00Z" })).toEqual({ commit: COMMIT, date: "2026-11-24T08:15:00Z" });
  });

  // The values come from the build environment and end up inside the admin
  // script, so anything that is not a commit hash or a date is dropped.
  it("drops a commit that is not a hash, and the date with it", () => {
    for (const commit of ["", "main", "432b90a'; alert(1); '", "XYZ1234", null, undefined, 42]) {
      expect(sanitizeBuildInfo({ commit, date: "2026-11-24T08:15:00Z" })).toEqual({ commit: null, date: null });
    }
  });

  it("drops a date that does not parse and keeps the commit", () => {
    for (const date of ["", "yesterday", null, undefined, 42]) {
      expect(sanitizeBuildInfo({ commit: COMMIT, date })).toEqual({ commit: COMMIT, date: null });
    }
  });

  it("reads no build from a value that is not an object", () => {
    expect(sanitizeBuildInfo(null)).toEqual({ commit: null, date: null });
    expect(sanitizeBuildInfo("432b90a")).toEqual({ commit: null, date: null });
  });
});
