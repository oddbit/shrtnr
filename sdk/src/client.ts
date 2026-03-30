// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  ShrtnrConfig,
  Link,
  Slug,
  ClickStats,
  DashboardStats,
  ApiKey,
  CreatedApiKey,
  Settings,
  HealthStatus,
  CreateLinkOptions,
  UpdateLinkOptions,
  CreateApiKeyOptions,
} from "./types";
import { ShrtnrError } from "./errors";

export class ShrtnrClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: ShrtnrConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.headers = {};
    if ("apiKey" in config.auth) {
      this.headers["Authorization"] = `Bearer ${config.auth.apiKey}`;
    } else {
      this.headers["Cf-Access-Jwt-Assertion"] = config.auth.accessToken;
    }
  }

  // ---- Scoped: public ----

  async health(): Promise<HealthStatus> {
    return this.request("GET", "/_/health");
  }

  // ---- Scoped: create ----

  async createLink(options: CreateLinkOptions): Promise<Link> {
    return this.request("POST", "/_/api/links", options);
  }

  // ---- Scoped: read ----

  async listLinks(): Promise<Link[]> {
    return this.request("GET", "/_/api/links");
  }

  async getLinkAnalytics(linkId: number): Promise<ClickStats> {
    return this.request("GET", `/_/api/links/${linkId}/analytics`);
  }

  // ---- Admin only ----

  async getLink(id: number): Promise<Link> {
    return this.request("GET", `/_/api/links/${id}`);
  }

  async updateLink(id: number, options: UpdateLinkOptions): Promise<Link> {
    return this.request("PUT", `/_/api/links/${id}`, options);
  }

  async disableLink(id: number): Promise<Link> {
    return this.request("POST", `/_/api/links/${id}/disable`);
  }

  async addVanitySlug(linkId: number, slug: string): Promise<Slug> {
    return this.request("POST", `/_/api/links/${linkId}/slugs`, { slug });
  }

  async getDashboard(): Promise<DashboardStats> {
    return this.request("GET", "/_/api/dashboard");
  }

  async getSettings(): Promise<Settings> {
    return this.request("GET", "/_/api/settings");
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    return this.request("PUT", "/_/api/settings", settings);
  }

  async getPreferences(): Promise<Record<string, string>> {
    return this.request("GET", "/_/api/preferences");
  }

  async updatePreferences(prefs: Record<string, string>): Promise<Record<string, string>> {
    return this.request("PUT", "/_/api/preferences", prefs);
  }

  async listApiKeys(): Promise<ApiKey[]> {
    return this.request("GET", "/_/api/keys");
  }

  async createApiKey(options: CreateApiKeyOptions): Promise<CreatedApiKey> {
    return this.request("POST", "/_/api/keys", options);
  }

  async deleteApiKey(id: number): Promise<void> {
    await this.request("DELETE", `/_/api/keys/${id}`);
  }

  // ---- Internal ----

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
}
