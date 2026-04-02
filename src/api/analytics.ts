// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { Env } from "../types";
import {
  getDashboardStats,
  getLinkAnalytics,
} from "../services/link-management";
import { fromServiceResult } from "./response";

export async function handleDashboardStats(env: Env): Promise<Response> {
  return fromServiceResult(await getDashboardStats(env));
}

export async function handleLinkAnalytics(env: Env, linkId: number): Promise<Response> {
  return fromServiceResult(await getLinkAnalytics(env, linkId));
}
