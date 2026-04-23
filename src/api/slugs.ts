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
  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.slug) return json({ error: "slug is required" }, 400);
  return fromServiceResult(await setSlugPrimary(env, linkId, body.slug));
}

export async function handleDisableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<Response> {
  return fromServiceResult(await disableSlug(env, linkId, slug, identity));
}

export async function handleEnableSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<Response> {
  return fromServiceResult(await enableSlug(env, linkId, slug, identity));
}

export async function handleRemoveSlug(
  env: Env,
  linkId: number,
  slug: string,
  identity: string,
): Promise<Response> {
  return fromServiceResult(await removeSlug(env, linkId, slug, identity));
}
