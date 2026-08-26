// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { ShrtnrError } from "../errors";
import { keysToCamel, keysToSnake } from "./case";

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

// Browsers brand-check fetch's receiver, so the global implementation stays
// bound to globalThis. Environments without one (Node 17 and older, legacy
// browsers) get a ShrtnrError pointing at the `fetch` config option rather than
// a raw TypeError from `.bind`.
function resolveGlobalFetch(): typeof fetch {
  const globalFetch = globalThis.fetch;
  if (typeof globalFetch !== "function") {
    throw new ShrtnrError(
      0,
      "This environment has no global fetch; pass a fetch implementation via the client's `fetch` option",
    );
  }
  return globalFetch.bind(globalThis);
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authHeader = `Bearer ${config.apiKey}`;
    // A caller-supplied fetch needs the same globalThis binding as the
    // default: it's typically a bare reference like `window.fetch` (see the
    // README's custom-fetch example), and Function.prototype.bind on an
    // already-bound function ignores the new receiver, so this is a no-op
    // for implementations that don't care about `this`.
    this.fetchFn = config.fetch ? config.fetch.bind(globalThis) : resolveGlobalFetch();
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
      // Read and parse in separate steps, same as the success path below: a
      // connection reset while streaming an error body is a transport
      // failure (status 0), not the server's declared HTTP status.
      const text = await this.readBody(res);
      let serverMessage = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(text) as { error?: string };
        if (typeof json.error === "string") serverMessage = json.error;
      } catch {
        // ignore parse failure; keep default message
      }
      throw new ShrtnrError(res.status, serverMessage);
    }

    if (res.status === 204) return undefined as T;

    // fetch settles once headers arrive; the body streams afterward, so a
    // connection reset mid-transfer fails here rather than at the call
    // above. Read and parse in separate steps to keep the two apart: a
    // transport failure reports status 0 like every other network error,
    // and only a body that arrived intact but isn't JSON carries the
    // response status.
    const text = await this.readBody(res);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ShrtnrError(res.status, `Invalid JSON response: ${msg}`);
    }
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
      // Read and parse in separate steps, same as the success path below: a
      // connection reset while streaming an error body is a transport
      // failure (status 0), not the server's declared HTTP status.
      const text = await this.readBody(res);
      let serverMessage = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(text) as { error?: string };
        if (typeof json.error === "string") serverMessage = json.error;
      } catch {
        // ignore parse failure; keep default message
      }
      throw new ShrtnrError(res.status, serverMessage);
    }

    return this.readBody(res);
  }

  private async readBody(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ShrtnrError(0, msg);
    }
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
