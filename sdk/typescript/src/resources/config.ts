// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { HttpClient } from "../internal/http";
import { Config } from "../models";

export class ConfigResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Read the origin this deployment hands short URLs out on.
   *
   * A client that composes `${shortOrigin}/${slug}` itself agrees with the
   * copy button, the QR code and the redirects on a deployment that answers
   * on several domains. Link responses carry the same value per link.
   */
  get(): Promise<Config> {
    return this.http.request("GET", "/_/api/config");
  }
}
