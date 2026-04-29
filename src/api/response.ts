// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { z } from "zod";

export type { ServiceResult } from "../services/result";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function fromServiceResult<T>(result: import("../services/result").ServiceResult<T>): Response {
  if (!result.ok) return json({ error: result.error }, result.status);
  if (result.meta && typeof result.data === "object" && result.data !== null) {
    return json({ ...result.data, ...result.meta }, result.status);
  }
  return json(result.data, result.status);
}

export function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "Invalid request";
  if (first.code === "unrecognized_keys") {
    return first.keys.length > 0 ? `Unknown field "${first.keys[0]}"` : "Unknown field";
  }
  const path = first.path.length > 0 ? first.path.join(".") : "request";
  return `${path}: ${first.message}`;
}
