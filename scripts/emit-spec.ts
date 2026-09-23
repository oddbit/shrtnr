#!/usr/bin/env tsx
// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Emit the canonical OpenAPI document for the public API.
 *
 * Imports apiRouter and its OpenAPI config, then serializes the OpenAPI 3.1
 * document with sorted keys and no whitespace, ready for hashing or comparison.
 *
 * Usage:
 *   yarn emit-spec          -> prints to stdout
 *   yarn emit-spec > out.json
 */

import { apiRouter, openApiConfig } from "../src/api/router";

// The info block is the router's own, so the served document and the hashed
// document cannot drift apart.
const doc = apiRouter.getOpenAPI31Document(openApiConfig);
process.stdout.write(canonicalize(doc) + "\n");

function canonicalize(value: unknown): string {
  if (value === undefined) {
    throw new Error("canonicalize encountered undefined; this would corrupt the spec hash silently");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalize(v)).join(",") + "}";
}
