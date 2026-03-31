// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { createMcpHandler } from "agents/mcp";
import type { Env } from "../types";
import { createMcpServer } from "./server";

export async function handleMcpRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const server = createMcpServer(env);
  const handler = createMcpHandler(server, {
    route: "/_/mcp",
    enableJsonResponse: true,
  });
  return handler(request, env, ctx);
}
