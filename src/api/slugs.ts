// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  addCustomSlugToLink,
  setSlugPrimary,
  disableSlug,
  enableSlug,
  removeSlug,
} from "../services/link-management";
import { json, fromServiceResult } from "./response";

export async function handleAddCustomSlug(
  request: Request,
  env: Env,
  linkId: number
): Promise<Response> {
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await addCustomSlugToLink(env, linkId, body));
}


export async function handleSetPrimarySlug(
  request: Request,
  env: Env,
  linkId: number,
): Promise<Response> {
  let body: { slug_id?: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.slug_id) return json({ error: "slug_id is required" }, 400);
  return fromServiceResult(await setSlugPrimary(env, linkId, body.slug_id));
}

export async function handleDisableSlug(
  env: Env,
  linkId: number,
  slugId: number,
): Promise<Response> {
  return fromServiceResult(await disableSlug(env, linkId, slugId));
}

export async function handleEnableSlug(
  env: Env,
  linkId: number,
  slugId: number,
): Promise<Response> {
  return fromServiceResult(await enableSlug(env, linkId, slugId));
}

export async function handleRemoveSlug(
  env: Env,
  linkId: number,
  slugId: number,
): Promise<Response> {
  return fromServiceResult(await removeSlug(env, linkId, slugId));
}
