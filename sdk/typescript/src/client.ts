// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from "./internal/http";
import { LinksResource } from "./resources/links";
import { SlugsResource } from "./resources/slugs";
import { BundlesResource } from "./resources/bundles";

export interface ShrtnrClientConfig {
  /** Base URL of your shrtnr deployment, e.g. "https://s.example.com". */
  baseUrl: string;
  /** API key from the admin dashboard (sk_...). */
  apiKey: string;
  /** Custom fetch implementation. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export class ShrtnrClient {
  readonly links: LinksResource;
  readonly slugs: SlugsResource;
  readonly bundles: BundlesResource;

  constructor(config: ShrtnrClientConfig) {
    const http = new HttpClient(config);
    this.links = new LinksResource(http);
    this.slugs = new SlugsResource(http);
    this.bundles = new BundlesResource(http);
  }
}
