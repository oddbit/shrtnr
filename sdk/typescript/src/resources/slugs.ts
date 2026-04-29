// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from "../internal/http";
import { Link, Slug } from "../models";

export class SlugsResource {
  constructor(private readonly http: HttpClient) {}

  /** Look up a link by its slug. */
  lookup(slug: string): Promise<Link> {
    return this.http.request("GET", `/_/api/slugs/${encodeURIComponent(slug)}`);
  }

  /** Add a custom slug to a link. */
  add(linkId: number, slug: string): Promise<Slug> {
    return this.http.request("POST", `/_/api/links/${linkId}/slugs`, { body: { slug } });
  }

  /** Disable a specific slug on a link. */
  disable(linkId: number, slug: string): Promise<Slug> {
    return this.http.request(
      "POST",
      `/_/api/links/${linkId}/slugs/${encodeURIComponent(slug)}/disable`,
    );
  }

  /** Re-enable a disabled slug on a link. */
  enable(linkId: number, slug: string): Promise<Slug> {
    return this.http.request(
      "POST",
      `/_/api/links/${linkId}/slugs/${encodeURIComponent(slug)}/enable`,
    );
  }

  /** Remove a custom slug from a link. */
  remove(linkId: number, slug: string): Promise<{ removed: boolean }> {
    return this.http.request(
      "DELETE",
      `/_/api/links/${linkId}/slugs/${encodeURIComponent(slug)}`,
    );
  }
}
