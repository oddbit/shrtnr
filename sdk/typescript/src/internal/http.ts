// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { ShrtnrError } from "../errors";
import { keysToCamel, keysToSnake } from "./case";

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authHeader = `Bearer ${config.apiKey}`;
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string | undefined> } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    const init: RequestInit = { method, headers };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(keysToSnake(options.body));
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, init);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ShrtnrError(0, msg);
    }

    if (!res.ok) {
      let serverMessage = `HTTP ${res.status}`;
      try {
        const json = (await res.json()) as { error?: string };
        if (typeof json.error === "string") serverMessage = json.error;
      } catch {
        // ignore parse failure; keep default message
      }
      throw new ShrtnrError(res.status, serverMessage);
    }

    if (res.status === 204) return undefined as T;

    const json: unknown = await res.json();
    return keysToCamel(json) as T;
  }

  async requestText(
    method: string,
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<string> {
    const url = this.buildUrl(path, query);
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    let res: Response;
    try {
      res = await this.fetchFn(url, { method, headers });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ShrtnrError(0, msg);
    }

    if (!res.ok) {
      let serverMessage = `HTTP ${res.status}`;
      try {
        const json = (await res.json()) as { error?: string };
        if (typeof json.error === "string") serverMessage = json.error;
      } catch {
        // ignore parse failure; keep default message
      }
      throw new ShrtnrError(res.status, serverMessage);
    }

    return res.text();
  }

  private buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const base = `${this.baseUrl}${path}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
}
