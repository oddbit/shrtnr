// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import { createApiKey, getApiKeysByEmail, deleteApiKey } from "../db";

const VALID_SCOPES = ["create", "read", "create,read"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleListKeys(env: Env, email: string): Promise<Response> {
  const keys = await getApiKeysByEmail(env.DB, email);
  // Strip key_hash from response
  const safe = keys.map(({ key_hash, ...rest }) => rest);
  return json(safe);
}

export async function handleCreateKey(request: Request, env: Env, email: string): Promise<Response> {
  let body: { title?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return json({ error: "Title is required" }, 400);
  }
  if (!body.scope || !VALID_SCOPES.includes(body.scope)) {
    return json({ error: "Scope must be one of: " + VALID_SCOPES.join(", ") }, 400);
  }

  const { key, rawKey } = await createApiKey(env.DB, email, body.title.trim(), body.scope);
  const { key_hash, ...safeKey } = key;
  return json({ key: safeKey, raw_key: rawKey }, 201);
}

export async function handleDeleteKey(env: Env, email: string, id: number): Promise<Response> {
  const deleted = await deleteApiKey(env.DB, id, email);
  if (!deleted) return json({ error: "Key not found" }, 404);
  return json({ ok: true });
}
