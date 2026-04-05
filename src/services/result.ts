// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export type ServiceResult<T> =
  | { ok: true; status: number; data: T; meta?: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export function ok<T>(data: T, status = 200, meta?: Record<string, unknown>): ServiceResult<T> {
  return { ok: true, status, data, meta };
}

export function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}
