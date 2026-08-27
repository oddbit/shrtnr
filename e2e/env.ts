// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

export const PORT = Number(process.env.E2E_PORT ?? 8797);
export const BASE_URL = `http://localhost:${PORT}`;

/** The identity every spec acts as. Owner-gated writes check against it. */
export const IDENTITY = "e2e@example.com";

/** Written by the setup project, read by every spec. Lives with the server's own throwaway state. */
const STATE_DIR = path.resolve(process.cwd(), ".wrangler/e2e-state");
export const AUTH_STATE = path.join(STATE_DIR, "auth.json");
export const SEED_FILE = path.join(STATE_DIR, "seed.json");

export interface SeededLink {
  id: number;
  slug: string;
  label: string;
  url: string;
}

/** The catalog the setup project creates. Counts are exact; specs assert them. */
export interface Seed {
  identity: string;
  /** Every link, in creation order (oldest first). */
  links: SeededLink[];
  active: number;
  disabled: number;
  /** Links with clicks, most clicked first, with their click counts. */
  popular: { link: SeededLink; clicks: number }[];
  /** The link created last, which the recent sort lists first. */
  newest: SeededLink;
  disabledLinks: SeededLink[];
}
