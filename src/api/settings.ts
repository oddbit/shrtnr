// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  getAppSettings,
  updateAppSettings,
} from "../services/admin-management";
import { json, fromServiceResult } from "./response";

export async function handleGetSettings(env: Env, identity: string): Promise<Response> {
  return fromServiceResult(await getAppSettings(env, identity));
}

export async function handleUpdateSettings(request: Request, env: Env, identity: string): Promise<Response> {
  let body: { slug_default_length?: number; theme?: string; lang?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await updateAppSettings(env, identity, body));
}
