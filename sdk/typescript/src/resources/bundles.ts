// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from "../internal/http";
import {
  AddedResult,
  Bundle,
  BundleWithSummary,
  ClickStats,
  CreateBundleBody,
  DeletedResult,
  Link,
  RemovedResult,
  TimelineRange,
  UpdateBundleBody,
} from "../models";

export class BundlesResource {
  constructor(private readonly http: HttpClient) {}

  /** Get a bundle by ID with aggregated click summary. */
  get(id: number, options: { range?: TimelineRange } = {}): Promise<BundleWithSummary> {
    return this.http.request("GET", `/_/api/bundles/${id}`, {
      query: { range: options.range },
    });
  }

  /** List bundles. Filter by archived status and click-count range. */
  list(
    options: { archived?: "1" | "true" | "only" | "all"; range?: TimelineRange } = {},
  ): Promise<BundleWithSummary[]> {
    return this.http.request("GET", "/_/api/bundles", {
      query: { archived: options.archived, range: options.range },
    });
  }

  /** Create a new bundle. */
  create(body: CreateBundleBody): Promise<Bundle> {
    return this.http.request("POST", "/_/api/bundles", { body });
  }

  /** Update a bundle's name, description, icon, or accent. */
  update(id: number, body: UpdateBundleBody): Promise<Bundle> {
    return this.http.request("PUT", `/_/api/bundles/${id}`, { body });
  }

  /** Permanently delete a bundle. */
  delete(id: number): Promise<DeletedResult> {
    return this.http.request("DELETE", `/_/api/bundles/${id}`);
  }

  /** Archive a bundle. */
  archive(id: number): Promise<Bundle> {
    return this.http.request("POST", `/_/api/bundles/${id}/archive`);
  }

  /** Unarchive a bundle. */
  unarchive(id: number): Promise<Bundle> {
    return this.http.request("POST", `/_/api/bundles/${id}/unarchive`);
  }

  /** Get click analytics for a bundle. */
  analytics(id: number, options: { range?: TimelineRange } = {}): Promise<ClickStats> {
    return this.http.request("GET", `/_/api/bundles/${id}/analytics`, {
      query: { range: options.range },
    });
  }

  /** List links in a bundle. */
  links(id: number): Promise<Link[]> {
    return this.http.request("GET", `/_/api/bundles/${id}/links`);
  }

  /** Add a link to a bundle. */
  addLink(id: number, linkId: number): Promise<AddedResult> {
    return this.http.request("POST", `/_/api/bundles/${id}/links`, { body: { linkId } });
  }

  /** Remove a link from a bundle. */
  removeLink(id: number, linkId: number): Promise<RemovedResult> {
    return this.http.request("DELETE", `/_/api/bundles/${id}/links/${linkId}`);
  }
}
