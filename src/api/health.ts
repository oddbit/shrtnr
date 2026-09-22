// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import pkg from "../../package.json";
import type { Env } from "../types";
import { ensureSchema, schemaStatus } from "../db/migrate";
import { SCHEMA_VERSION } from "../db/migrations.generated";

/**
 * Liveness plus schema state, so a deploy whose database never received its
 * schema is telling from the outside. The check goes through the same
 * once-per-isolate guard as every other request, so the first probe after
 * a deploy is also what creates the schema; a failure answers 503 with the
 * error instead of the guard's HTML page, since a monitor reads JSON.
 */
export async function handleHealth(env: Env): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  try {
    await ensureSchema(env);
    const status = await schemaStatus(env);
    const applied = status.applied.length > 0 ? status.applied[status.applied.length - 1].name : null;
    return new Response(
      JSON.stringify({
        status: "ok",
        version: pkg.version,
        timestamp: Date.now(),
        schema: { version: SCHEMA_VERSION, applied, ready: status.ready },
      }),
      { headers },
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        status: "degraded",
        version: pkg.version,
        timestamp: Date.now(),
        schema: { version: SCHEMA_VERSION, applied: null, ready: false, error: reason },
      }),
      { status: 503, headers },
    );
  }
}
