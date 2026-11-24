// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from "../internal/http";
import { slugSegment } from "../internal/path";
import { Link, RemovedResult, Slug } from "../models";

// The slug-in-path methods are async so an invalid slug rejects the returned
// promise, like every other failure, instead of throwing before one exists.
export class SlugsResource {
  constructor(private readonly http: HttpClient) {}

  /** Look up a link by its slug. */
  async lookup(slug: string): Promise<Link> {
    return this.http.requestLink<Link>("GET", `/_/api/slugs/${slugSegment(slug)}`);
  }

  /** Add a custom slug to a link. */
  add(linkId: number, slug: string): Promise<Slug> {
    return this.http.request("POST", `/_/api/links/${linkId}/slugs`, { body: { slug } });
  }

  /** Disable a specific slug on a link. */
  async disable(linkId: number, slug: string): Promise<Slug> {
    return this.http.request("POST", `/_/api/links/${linkId}/slugs/${slugSegment(slug)}/disable`);
  }

  /** Re-enable a disabled slug on a link. */
  async enable(linkId: number, slug: string): Promise<Slug> {
    return this.http.request("POST", `/_/api/links/${linkId}/slugs/${slugSegment(slug)}/enable`);
  }

  /** Remove a custom slug from a link. */
  async remove(linkId: number, slug: string): Promise<RemovedResult> {
    return this.http.request("DELETE", `/_/api/links/${linkId}/slugs/${slugSegment(slug)}`);
  }
}
