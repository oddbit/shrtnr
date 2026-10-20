// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE, BASE_URL, PORT, SHORT_ORIGIN, UNPINNED_PORT, UNPINNED_URL } from "./e2e/env";

// The second server exists for default-origin.spec.ts alone. `yarn perf` runs
// one spec against the pinned server and sets E2E_PINNED_ONLY so it does not
// pay for a second migration and wrangler boot, or fail on a busy :8798.
const PINNED_ONLY = !!process.env.E2E_PINNED_ONLY;

/**
 * Browser e2e suite: the app as a user meets it, driven through a real
 * browser against `wrangler dev`. The vitest suite proves the server emits
 * the right HTML and SQL; this suite proves the page in front of the user
 * responds when clicked.
 *
 * `yarn e2e` runs it. The `setup` project signs in through /_/dev/login and
 * seeds the catalog every spec reads; the browser projects depend on it and
 * reuse its cookie through storageState.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // Every run boots its own servers. A reused one carries whatever
  // environment it was started with: a server left running from before
  // SHORT_ORIGIN was pinned failed the origin specs for a reason no test named.
  // A port already in use now fails the run up front instead.
  webServer: [
    {
      command: "bash scripts/e2e-server.sh",
      url: `${BASE_URL}/_/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { E2E_PORT: String(PORT), E2E_SHORT_ORIGIN: SHORT_ORIGIN },
    },
    ...(PINNED_ONLY
      ? []
      : [
          {
            // SHORT_ORIGIN unset, the default most deployments run with.
            command: "bash scripts/e2e-server.sh",
            url: `${UNPINNED_URL}/_/health`,
            timeout: 120_000,
            reuseExistingServer: false,
            env: { E2E_PORT: String(UNPINNED_PORT), E2E_STATE: ".wrangler/e2e-state-unpinned" },
          },
        ]),
  ],
  projects: [
    { name: "setup", testMatch: /setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
      testIgnore: [/setup\.ts$/, /authorization\.spec\.ts$/, /default-origin\.spec\.ts$/],
    },
    ...(PINNED_ONLY
      ? []
      : [
          {
            // Against the server with SHORT_ORIGIN unset. It signs in and creates
            // its own link there, so it needs neither the setup project nor its seed.
            name: "default-origin",
            testMatch: /default-origin\.spec\.ts$/,
            use: { ...devices["Desktop Chrome"], baseURL: UNPINNED_URL },
          },
        ]),
    {
      // Runs after the counting specs: it signs in a second identity and
      // adds slugs and bundle memberships to seeded links, which the listing
      // spec's exact counts and chip assertions must never observe mid-flight.
      name: "authorization",
      testMatch: /authorization\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["chromium"],
    },
  ],
});
