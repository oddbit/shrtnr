// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export class ShrtnrError extends Error {
  constructor(
    public readonly status: number,
    public readonly serverMessage: string,
  ) {
    super(`shrtnr API error (HTTP ${status}): ${serverMessage}`);
    this.name = "ShrtnrError";
  }
}
