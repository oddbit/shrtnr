// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  createApiKey,
  deleteApiKey,
  getAllApiKeys,
  getSetting,
  setSetting,
} from "../db";
import { DEFAULT_SLUG_LENGTH } from "../constants";
import { validateSlugLength } from "../slugs";
import { Env } from "../types";
import { ServiceResult } from "../api/response";

const VALID_SCOPES = ["create", "read", "create,read"];

function ok<T>(data: T, status = 200): ServiceResult<T> {
  return { ok: true, status, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

export async function listAllApiKeys(env: Env): Promise<ServiceResult<unknown[]>> {
  const keys = await getAllApiKeys(env.DB);
  const safe = keys.map(({ key_hash, ...rest }) => rest);
  return ok(safe);
}

export async function createNewApiKey(
  env: Env,
  body: { title?: string; scope?: string }
): Promise<ServiceResult<{ key: unknown; raw_key: string }>> {
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return fail(400, "Title is required");
  }
  if (!body.scope || !VALID_SCOPES.includes(body.scope)) {
    return fail(400, "Scope must be one of: " + VALID_SCOPES.join(", "));
  }

  const { key, rawKey } = await createApiKey(env.DB, body.title.trim(), body.scope);
  const { key_hash, ...safeKey } = key;
  return ok({ key: safeKey, raw_key: rawKey }, 201);
}

export async function deleteApiKeyById(env: Env, id: number): Promise<ServiceResult<{ ok: true }>> {
  const deleted = await deleteApiKey(env.DB, id);
  if (!deleted) return fail(404, "Key not found");
  return ok({ ok: true });
}

export async function getAppSettings(env: Env): Promise<ServiceResult<{ slug_default_length: number }>> {
  const slugLength = await getSetting(env.DB, "slug_default_length");
  return ok({ slug_default_length: parseInt(slugLength ?? String(DEFAULT_SLUG_LENGTH), 10) });
}

export async function updateAppSettings(
  env: Env,
  body: { slug_default_length?: number }
): Promise<ServiceResult<{ slug_default_length: number }>> {
  if (body.slug_default_length !== undefined) {
    const err = validateSlugLength(body.slug_default_length);
    if (err) return fail(400, err);
    await setSetting(env.DB, "slug_default_length", String(body.slug_default_length));
  }

  return getAppSettings(env);
}
