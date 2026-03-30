// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  createApiKey,
  deleteApiKey,
  getApiKeysByEmail,
  getSetting,
  getUserPreferences,
  setSetting,
  setUserPreference,
} from "../db";
import { validateSlugLength } from "../slugs";
import { Env } from "../types";

type ServiceResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

const VALID_SCOPES = ["create", "read", "create,read"];
const VALID_THEMES = ["oddbit", "dark", "light"];

function ok<T>(data: T, status = 200): ServiceResult<T> {
  return { ok: true, status, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

export type AdminServiceResult<T> = ServiceResult<T>;

export async function listApiKeysForUser(env: Env, email: string): Promise<AdminServiceResult<unknown[]>> {
  const keys = await getApiKeysByEmail(env.DB, email);
  const safe = keys.map(({ key_hash, ...rest }) => rest);
  return ok(safe);
}

export async function createApiKeyForUser(
  env: Env,
  email: string,
  body: { title?: string; scope?: string }
): Promise<AdminServiceResult<{ key: unknown; raw_key: string }>> {
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return fail(400, "Title is required");
  }
  if (!body.scope || !VALID_SCOPES.includes(body.scope)) {
    return fail(400, "Scope must be one of: " + VALID_SCOPES.join(", "));
  }

  const { key, rawKey } = await createApiKey(env.DB, email, body.title.trim(), body.scope);
  const { key_hash, ...safeKey } = key;
  return ok({ key: safeKey, raw_key: rawKey }, 201);
}

export async function deleteApiKeyForUser(env: Env, email: string, id: number): Promise<AdminServiceResult<{ ok: true }>> {
  const deleted = await deleteApiKey(env.DB, id, email);
  if (!deleted) return fail(404, "Key not found");
  return ok({ ok: true });
}

export async function getAppSettings(env: Env): Promise<AdminServiceResult<{ slug_default_length: number }>> {
  const slugLength = await getSetting(env.DB, "slug_default_length");
  return ok({ slug_default_length: parseInt(slugLength ?? env.SLUG_DEFAULT_LENGTH, 10) });
}

export async function updateAppSettings(
  env: Env,
  body: { slug_default_length?: number }
): Promise<AdminServiceResult<{ slug_default_length: number }>> {
  if (body.slug_default_length !== undefined) {
    const err = validateSlugLength(body.slug_default_length);
    if (err) return fail(400, err);
    await setSetting(env.DB, "slug_default_length", String(body.slug_default_length));
  }

  return getAppSettings(env);
}

export async function getUserPreferencesForUser(
  env: Env,
  email: string
): Promise<AdminServiceResult<Record<string, string>>> {
  return ok(await getUserPreferences(env.DB, email));
}

export async function updateUserPreferences(
  env: Env,
  email: string,
  body: { theme?: string }
): Promise<AdminServiceResult<Record<string, string>>> {
  if (body.theme !== undefined) {
    if (!VALID_THEMES.includes(body.theme)) {
      return fail(400, "Invalid theme. Must be one of: " + VALID_THEMES.join(", "));
    }
    await setUserPreference(env.DB, email, "theme", body.theme);
  }

  return getUserPreferencesForUser(env, email);
}