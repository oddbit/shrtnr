// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  dbCreateApiKey,
  dbDeleteApiKey,
  dbGetAllApiKeys,
  dbGetSetting,
  dbSetSetting,
} from "../db";
import { DEFAULT_SLUG_LENGTH } from "../constants";
import { validateSlugLength } from "../slugs";
import { Env } from "../types";
import { ServiceResult } from "../api/response";

const VALID_SCOPES = ["create", "read", "create,read"];
const VALID_SETTING_KEYS = ["slug_default_length", "theme", "lang"] as const;
type SettingKey = typeof VALID_SETTING_KEYS[number];

function ok<T>(data: T, status = 200): ServiceResult<T> {
  return { ok: true, status, data };
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

export async function listAllApiKeys(env: Env, identity: string): Promise<ServiceResult<unknown[]>> {
  const keys = await dbGetAllApiKeys(env.DB, identity);
  const safe = keys.map(({ key_hash, identity: _id, ...rest }) => rest);
  return ok(safe);
}

export async function createNewApiKey(
  env: Env,
  identity: string,
  body: { title?: string; scope?: string }
): Promise<ServiceResult<{ key: unknown; raw_key: string }>> {
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return fail(400, "Title is required");
  }
  if (!body.scope || !VALID_SCOPES.includes(body.scope)) {
    return fail(400, "Scope must be one of: " + VALID_SCOPES.join(", "));
  }

  const { key, rawKey } = await dbCreateApiKey(env.DB, identity, body.title.trim(), body.scope);
  const { key_hash, identity: _id, ...safeKey } = key;
  return ok({ key: safeKey, raw_key: rawKey }, 201);
}

export async function deleteApiKeyById(env: Env, identity: string, id: number): Promise<ServiceResult<{ ok: true }>> {
  const deleted = await dbDeleteApiKey(env.DB, identity, id);
  if (!deleted) return fail(404, "Key not found");
  return ok({ ok: true });
}

export async function getAppSettings(
  env: Env,
  identity: string,
): Promise<ServiceResult<{ slug_default_length: number; theme: string | null; lang: string | null }>> {
  const [slugLength, theme, lang] = await Promise.all([
    dbGetSetting(env.DB, identity, "slug_default_length"),
    dbGetSetting(env.DB, identity, "theme"),
    dbGetSetting(env.DB, identity, "lang"),
  ]);
  return ok({
    slug_default_length: parseInt(slugLength ?? String(DEFAULT_SLUG_LENGTH), 10),
    theme: theme ?? null,
    lang: lang ?? null,
  });
}

export async function updateAppSettings(
  env: Env,
  identity: string,
  body: { slug_default_length?: number; theme?: string; lang?: string }
): Promise<ServiceResult<{ slug_default_length: number; theme: string | null; lang: string | null }>> {
  if (body.slug_default_length !== undefined) {
    const err = validateSlugLength(body.slug_default_length);
    if (err) return fail(400, err);
    await dbSetSetting(env.DB, identity, "slug_default_length", String(body.slug_default_length));
  }
  if (body.theme !== undefined && typeof body.theme === "string") {
    await dbSetSetting(env.DB, identity, "theme", body.theme);
  }
  if (body.lang !== undefined && typeof body.lang === "string") {
    await dbSetSetting(env.DB, identity, "lang", body.lang);
  }

  return getAppSettings(env, identity);
}
