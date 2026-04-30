// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Extension-internal error categories. Distinct from ShrtnrError (the
// SDK's HTTP error). The popup branches on ErrorCategory to render the
// correct message and recovery affordances.

export type ErrorCategory =
  | "internal-page"
  | "unparseable-url"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "server"
  | "validation";

export class ExtensionError extends Error {
  constructor(
    public readonly category: ErrorCategory,
    public readonly serverMessage?: string,
    public readonly status?: number,
  ) {
    super(`extension error (${category}${status != null ? ` / HTTP ${status}` : ""})`);
    this.name = "ExtensionError";
  }
}

export function categorizeStatus(status: number): ErrorCategory {
  if (status === 0) return "network";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "server";
}

export function logError(category: ErrorCategory, status: number | undefined): void {
  const tag = status != null ? `[${category}/${status}]` : `[${category}]`;
  console.warn(`shrtnr-extension ${tag}`);
}
