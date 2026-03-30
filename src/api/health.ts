// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { APP_VERSION } from "../version";

export function handleHealth(): Response {
  return new Response(JSON.stringify({ status: "ok", version: APP_VERSION, timestamp: Date.now() }), {
    headers: { "Content-Type": "application/json" },
  });
}