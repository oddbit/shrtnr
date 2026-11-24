// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  getAppSettings,
  updateAppSettings,
} from "../services/admin-management";
import { fromServiceResult, readJsonObject } from "./response";

export async function handleGetSettings(env: Env, identity: string): Promise<Response> {
  return fromServiceResult(await getAppSettings(env, identity));
}

export async function handleUpdateSettings(request: Request, env: Env, identity: string): Promise<Response> {
  // The service validates every field; the type is its parameter type.
  const parsed = await readJsonObject<Parameters<typeof updateAppSettings>[2]>(request);
  if (!parsed.ok) return parsed.response;

  return fromServiceResult(await updateAppSettings(env, identity, parsed.body));
}
