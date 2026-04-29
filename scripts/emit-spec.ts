#!/usr/bin/env tsx
// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Emit the canonical OpenAPI document for the public API.
 *
 * Imports apiRouter and serializes its OpenAPI 3.1 document with sorted keys
 * and no whitespace, ready for hashing or comparison.
 *
 * Usage:
 *   yarn emit-spec          -> prints to stdout
 *   yarn emit-spec > out.json
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { apiRouter } from "../src/api/router";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(join(__dirname, "../package.json")) as { version: string };

const config = {
  openapi: "3.1.0" as const,
  info: {
    title: "shrtnr API",
    version: pkg.version,
    description:
      "Public link-management API for shrtnr, a self-hosted URL shortener on Cloudflare Workers. " +
      "Authenticate with an API key issued from the admin dashboard. " +
      "Built and maintained by Oddbit (https://oddbit.id).",
    contact: { name: "Oddbit", url: "https://oddbit.id" },
    license: { name: "Apache 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  servers: [{ url: "/" }],
  security: [{ bearerAuth: [] }],
};

const doc = apiRouter.getOpenAPI31Document(config);
process.stdout.write((canonicalize(doc) ?? "{}") + "\n");

function canonicalize(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
      .join(",") +
    "}"
  );
}
