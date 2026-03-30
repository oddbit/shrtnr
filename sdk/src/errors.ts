// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export class ShrtnrError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, body: unknown) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: string }).error)
        : `HTTP ${status}`;
    super(message);
    this.name = "ShrtnrError";
    this.status = status;
    this.body = body;
  }
}
