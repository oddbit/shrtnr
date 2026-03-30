// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  AdminServiceResult,
  getUserPreferencesForUser,
  updateUserPreferences,
} from "../services/admin-management";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fromServiceResult<T>(result: AdminServiceResult<T>): Response {
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(result.data, result.status);
}

export async function handleGetPreferences(env: Env, email: string): Promise<Response> {
  return fromServiceResult(await getUserPreferencesForUser(env, email));
}

export async function handleUpdatePreferences(request: Request, env: Env, email: string): Promise<Response> {
  let body: { theme?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await updateUserPreferences(env, email, body));
}
