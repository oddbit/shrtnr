// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { ShrtnrConfig } from "./types";
import { ShrtnrError } from "./errors";

export class ShrtnrBaseClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: ShrtnrConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.headers = {
      Authorization: `Bearer ${config.auth.apiKey}`,
      "X-Client": "sdk",
    };
  }

  protected async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method,
      headers: { ...this.headers },
    };

    if (body !== undefined) {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${path}`, init);

    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = null;
      }
      throw new ShrtnrError(res.status, parsed);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  protected async requestText(method: string, path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { ...this.headers },
    });

    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = null;
      }
      throw new ShrtnrError(res.status, parsed);
    }

    return res.text();
  }
}
