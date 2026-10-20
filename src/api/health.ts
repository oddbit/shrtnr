// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import pkg from "../../package.json";
import type { Env } from "../types";
import { lastSchemaFailure, schemaStatus } from "../db/migrate";
import { SCHEMA_VERSION } from "../db/migrations.generated";

/**
 * Liveness plus schema state, so a deploy whose database never received its
 * schema is telling from the outside. Read-only: a probe changes nothing,
 * the first real request (or POST /_/setup) creates the schema. A database
 * nobody has hit yet reports ready: false with 200, since nothing is wrong
 * with it; a remembered migration failure in this isolate reports
 * "degraded" with 503 and the error, since a monitor reads JSON, not the
 * guard's HTML page.
 */
export async function handleHealth(env: Env): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const base = { version: pkg.version, timestamp: Date.now() };
  let applied: string | null = null;
  let ready = false;
  let error: string | null = lastSchemaFailure()?.message ?? null;
  try {
    const status = await schemaStatus(env);
    applied = status.applied.length > 0 ? status.applied[status.applied.length - 1].name : null;
    ready = status.ready;
    // A live read that finds every migration applied is direct proof the
    // schema is fine right now, even on an isolate that still remembers an
    // earlier attempt failing (its own, or one it never repeated because
    // health is exempt from ensureSchema()).
    if (ready) error = null;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  if (error) {
    return new Response(
      JSON.stringify({ status: "degraded", ...base, schema: { version: SCHEMA_VERSION, applied, ready: false, error } }),
      { status: 503, headers },
    );
  }
  return new Response(JSON.stringify({ status: "ok", ...base, schema: { version: SCHEMA_VERSION, applied, ready } }), { headers });
}
