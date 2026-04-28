// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import {
  Bundle,
  BundleStats,
  BundleWithSummary,
  ClickStats,
  CreateBundleOptions,
  CreateLinkOptions,
  HealthStatus,
  Link,
  ListBundlesOptions,
  Slug,
  ShrtnrConfig,
  TimelineRange,
  UpdateBundleOptions,
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

  async enableLink(id: number): Promise<Link> {
    return this.request("POST", `/_/api/links/${id}/enable`);
  }

  async deleteLink(id: number): Promise<{ deleted: boolean }> {
    return this.request("DELETE", `/_/api/links/${id}`);
  }

  async listLinksByOwner(owner: string): Promise<Link[]> {
    return this.request("GET", `/_/api/links?owner=${encodeURIComponent(owner)}`);
  }

  async addCustomSlug(linkId: number, slug: string): Promise<Slug> {
    return this.request("POST", `/_/api/links/${linkId}/slugs`, { slug });
  }

  async disableSlug(linkId: number, slug: string): Promise<Slug> {
    return this.request("POST", `/_/api/links/${linkId}/slugs/${encodeURIComponent(slug)}/disable`);
  }

  async enableSlug(linkId: number, slug: string): Promise<Slug> {
    return this.request("POST", `/_/api/links/${linkId}/slugs/${encodeURIComponent(slug)}/enable`);
  }

  async removeSlug(linkId: number, slug: string): Promise<{ removed: boolean }> {
    return this.request("DELETE", `/_/api/links/${linkId}/slugs/${encodeURIComponent(slug)}`);
  }

  async getLinkBySlug(slug: string): Promise<Link> {
    return this.request("GET", `/_/api/slugs/${encodeURIComponent(slug)}`);
  }

  async getLinkAnalytics(linkId: number, range: TimelineRange = "all"): Promise<ClickStats> {
    return this.request("GET", `/_/api/links/${linkId}/analytics?range=${range}`);
  }

  async getLinkQR(linkId: number, slug?: string): Promise<string> {
    const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
    return this.requestText("GET", `/_/api/links/${linkId}/qr${qs}`);
  }

  // ---- Bundles ----

  async createBundle(options: CreateBundleOptions): Promise<Bundle> {
    return this.request("POST", "/_/api/bundles", options);
  }

  async listBundles(options: ListBundlesOptions = {}): Promise<BundleWithSummary[]> {
    const params = new URLSearchParams();
    if (options.archived !== undefined) params.set("archived", options.archived ? "all" : "false");
    const qs = params.toString();
    return this.request("GET", `/_/api/bundles${qs ? "?" + qs : ""}`);
  }

  async getBundle(id: number): Promise<Bundle> {
    return this.request("GET", `/_/api/bundles/${id}`);
  }

  async updateBundle(id: number, options: UpdateBundleOptions): Promise<Bundle> {
    return this.request("PUT", `/_/api/bundles/${id}`, options);
  }

  async deleteBundle(id: number): Promise<{ deleted: boolean }> {
    return this.request("DELETE", `/_/api/bundles/${id}`);
  }

  async archiveBundle(id: number): Promise<Bundle> {
    return this.request("POST", `/_/api/bundles/${id}/archive`);
  }

  async unarchiveBundle(id: number): Promise<Bundle> {
    return this.request("POST", `/_/api/bundles/${id}/unarchive`);
  }

  async getBundleAnalytics(id: number, range: TimelineRange = "all"): Promise<BundleStats> {
    return this.request("GET", `/_/api/bundles/${id}/analytics?range=${range}`);
  }

  async listBundleLinks(id: number): Promise<Link[]> {
    return this.request("GET", `/_/api/bundles/${id}/links`);
  }

  async addLinkToBundle(bundleId: number, linkId: number): Promise<{ added: boolean }> {
    return this.request("POST", `/_/api/bundles/${bundleId}/links`, { link_id: linkId });
  }

  async removeLinkFromBundle(bundleId: number, linkId: number): Promise<{ removed: boolean }> {
    return this.request("DELETE", `/_/api/bundles/${bundleId}/links/${linkId}`);
  }

  async listBundlesForLink(linkId: number): Promise<Bundle[]> {
    return this.request("GET", `/_/api/links/${linkId}/bundles`);
  }
}
