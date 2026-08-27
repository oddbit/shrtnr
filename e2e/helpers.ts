// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { SEED_FILE, type Seed } from "./env";

export function loadSeed(): Seed {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as Seed;
}

/**
 * Collects uncaught exceptions and console errors for the life of a page.
 * Call `assertClean()` at the end of a test: a page can render its shell
 * while a script throws on load, and only the console knows.
 */
export function watchErrors(page: Page): { assertClean: () => void } {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return {
    assertClean: () => expect(errors, "page must not log errors").toEqual([]),
  };
}

/** The query string of the current URL as a map, for asserting navigation state. */
export function query(page: Page): Record<string, string> {
  return Object.fromEntries(new URL(page.url()).searchParams.entries());
}
