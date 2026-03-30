// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import pkg from "../../package.json";

export function handleHealth(): Response {
  return new Response(JSON.stringify({ status: "ok", version: pkg.version, timestamp: Date.now() }), {
    headers: { "Content-Type": "application/json" },
  });
}