// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  CreateLinkOptions,
  HealthStatus,
  Link,
  Slug,
  ClickStats,
  ShrtnrConfig,
  UpdateLinkOptions,
} from "./types";
import { ShrtnrBaseClient } from "./base-client";

export class ShrtnrClient extends ShrtnrBaseClient {
  constructor(config: ShrtnrConfig) {
    super(config);
  }

  async health(): Promise<HealthStatus> {
    return this.request("GET", "/_/health");
  }

  async createLink(options: CreateLinkOptions): Promise<Link> {
    return this.request("POST", "/_/api/links", options);
  }

  async listLinks(): Promise<Link[]> {
    return this.request("GET", "/_/api/links");
  }

  async getLink(id: number): Promise<Link> {
    return this.request("GET", `/_/api/links/${id}`);
  }

  async updateLink(id: number, options: UpdateLinkOptions): Promise<Link> {
    return this.request("PUT", `/_/api/links/${id}`, options);
  }

  async disableLink(id: number): Promise<Link> {
    return this.request("POST", `/_/api/links/${id}/disable`);
  }

  async addCustomSlug(linkId: number, slug: string): Promise<Slug> {
    return this.request("POST", `/_/api/links/${linkId}/slugs`, { slug });
  }

  async getLinkBySlug(slug: string): Promise<Link> {
    return this.request("GET", `/_/api/slugs/${encodeURIComponent(slug)}`);
  }

  async getLinkAnalytics(linkId: number): Promise<ClickStats> {
    return this.request("GET", `/_/api/links/${linkId}/analytics`);
  }

  async getLinkQR(linkId: number, slug?: string): Promise<string> {
    const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
    return this.requestText("GET", `/_/api/links/${linkId}/qr${qs}`);
  }
}
