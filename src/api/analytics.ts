// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  getManagedDashboardStats,
  getManagedLinkAnalytics,
  ServiceResult,
} from "../services/link-management";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fromServiceResult<T>(result: ServiceResult<T>): Response {
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(result.data, result.status);
}

export async function handleDashboardStats(env: Env): Promise<Response> {
  return fromServiceResult(await getManagedDashboardStats(env));
}

export async function handleLinkAnalytics(env: Env, linkId: number): Promise<Response> {
  return fromServiceResult(await getManagedLinkAnalytics(env, linkId));
}
