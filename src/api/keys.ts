// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  createNewApiKey,
  deleteApiKeyById,
  listAllApiKeys,
} from "../services/admin-management";
import { fromServiceResult, readJsonObject } from "./response";

export async function handleListKeys(env: Env, identity: string): Promise<Response> {
  return fromServiceResult(await listAllApiKeys(env, identity));
}

export async function handleCreateKey(request: Request, env: Env, identity: string): Promise<Response> {
  const parsed = await readJsonObject<{ title?: string; scope?: string }>(request);
  if (!parsed.ok) return parsed.response;

  return fromServiceResult(await createNewApiKey(env, identity, parsed.body));
}

export async function handleDeleteKey(env: Env, identity: string, id: number): Promise<Response> {
  return fromServiceResult(await deleteApiKeyById(env, identity, id));
}
