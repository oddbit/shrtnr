// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  createLink,
  disableLink,
  getLink,
  getLinkBySlug,
  listLinks,
  updateLink,
} from "../services/link-management";
import { json, fromServiceResult } from "./response";

export async function handleListLinks(env: Env): Promise<Response> {
  return fromServiceResult(await listLinks(env));
}

export async function handleGetLink(env: Env, id: number): Promise<Response> {
  return fromServiceResult(await getLink(env, id));
}

export async function handleGetLinkBySlug(env: Env, slug: string): Promise<Response> {
  return fromServiceResult(await getLinkBySlug(env, slug));
}

export async function handleCreateLink(request: Request, env: Env, createdVia?: string, createdBy?: string): Promise<Response> {
  let body: {
    url?: string;
    label?: string;
    slug_length?: number;
    vanity_slug?: string;
    expires_at?: number;
    allow_duplicate?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await createLink(env, { ...body, created_via: createdVia, created_by: createdBy }));
}

export async function handleUpdateLink(request: Request, env: Env, id: number): Promise<Response> {
  let body: { url?: string; label?: string | null; expires_at?: number | null };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  return fromServiceResult(await updateLink(env, id, body));
}

export async function handleDisableLink(env: Env, id: number): Promise<Response> {
  return fromServiceResult(await disableLink(env, id));
}
