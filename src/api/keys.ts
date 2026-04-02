// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  createNewApiKey,
  deleteApiKeyById,
  listAllApiKeys,
} from "../services/admin-management";
import { json, fromServiceResult } from "./response";

export async function handleListKeys(env: Env, identity: string): Promise<Response> {
  return fromServiceResult(await listAllApiKeys(env, identity));
}

export async function handleCreateKey(request: Request, env: Env, identity: string): Promise<Response> {
  let body: { title?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await createNewApiKey(env, identity, body));
}

export async function handleDeleteKey(env: Env, identity: string, id: number): Promise<Response> {
  return fromServiceResult(await deleteApiKeyById(env, identity, id));
}
