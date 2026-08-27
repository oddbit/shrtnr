// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE, BASE_URL, PORT } from "./e2e/env";

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
  webServer: {
    command: "bash scripts/e2e-server.sh",
    url: `${BASE_URL}/_/health`,
    timeout: 120_000,
    // Locally a running server (from a previous `yarn e2e`) is reused. CI
    // always boots its own so the seed lands on a fresh database.
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(PORT) },
  },
  projects: [
    { name: "setup", testMatch: /setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_STATE },
      dependencies: ["setup"],
      testIgnore: /setup\.ts$/,
    },
  ],
});
