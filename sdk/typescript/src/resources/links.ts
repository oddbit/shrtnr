// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from "../internal/http";
import {
  Bundle,
  ClickStats,
  CreateLinkBody,
  Link,
  TimelineData,
  TimelineRange,
  UpdateLinkBody,
} from "../models";

export class LinksResource {
  constructor(private readonly http: HttpClient) {}

  /** Get a link by ID. Optional range controls the click-count window. */
  get(id: number, options: { range?: TimelineRange } = {}): Promise<Link> {
    return this.http.request("GET", `/_/api/links/${id}`, {
      query: { range: options.range },
    });
  }

  /** List all links. Filter by owner or click-count range. */
  list(options: { owner?: string; range?: TimelineRange } = {}): Promise<Link[]> {
    return this.http.request("GET", "/_/api/links", {
      query: { owner: options.owner, range: options.range },
    });
  }

  /** Create a new short link. */
  create(body: CreateLinkBody): Promise<Link> {
    return this.http.request("POST", "/_/api/links", { body });
  }

  /** Update a link's URL, label, or expiry. */
  update(id: number, body: UpdateLinkBody): Promise<Link> {
    return this.http.request("PUT", `/_/api/links/${id}`, { body });
  }

  /** Disable a link (stops redirecting). */
  disable(id: number): Promise<Link> {
    return this.http.request("POST", `/_/api/links/${id}/disable`);
  }

  /** Re-enable a disabled link. */
  enable(id: number): Promise<Link> {
    return this.http.request("POST", `/_/api/links/${id}/enable`);
  }

  /** Permanently delete a link. */
  delete(id: number): Promise<{ deleted: boolean }> {
    return this.http.request("DELETE", `/_/api/links/${id}`);
  }

  /** Get click analytics for a link. */
  analytics(id: number, options: { range?: TimelineRange } = {}): Promise<ClickStats> {
    return this.http.request("GET", `/_/api/links/${id}/analytics`, {
      query: { range: options.range },
    });
  }

  /** Get click timeline for a link. */
  timeline(id: number, options: { range?: TimelineRange } = {}): Promise<TimelineData> {
    return this.http.request("GET", `/_/api/links/${id}/timeline`, {
      query: { range: options.range },
    });
  }

  /** Get QR code SVG for a link. Returns the SVG string. */
  qr(id: number, options: { slug?: string; size?: string } = {}): Promise<string> {
    return this.http.requestText("GET", `/_/api/links/${id}/qr`, {
      slug: options.slug,
      size: options.size,
    });
  }

  /** List bundles that contain this link. */
  bundles(id: number): Promise<Bundle[]> {
    return this.http.request("GET", `/_/api/links/${id}/bundles`);
  }
}
