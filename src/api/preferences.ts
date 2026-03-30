// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  getUserPreferencesForUser,
  updateUserPreferences,
} from "../services/admin-management";
import { json, fromServiceResult } from "./response";

export async function handleGetPreferences(env: Env, email: string): Promise<Response> {
  return fromServiceResult(await getUserPreferencesForUser(env, email));
}

export async function handleUpdatePreferences(request: Request, env: Env, email: string): Promise<Response> {
  let body: { theme?: string; language?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await updateUserPreferences(env, email, body));
}
