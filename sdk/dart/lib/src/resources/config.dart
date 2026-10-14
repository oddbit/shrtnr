// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import '../base_client.dart';
import '../models.dart';

/// Methods for the `/api/config` endpoint.
class ConfigResource {
  /// Creates a config resource backed by [_http].
  ConfigResource(this._http);

  final ShrtnrBaseClient _http;

  /// Get the origin this deployment hands short URLs out on.
  ///
  /// On a deployment that answers on several domains, build short URLs as
  /// `${shortOrigin}/${slug}` so they match the copy button, the QR code and
  /// the redirects. Link responses carry the same value per link.
  Future<Config> get() async {
    final json = await _http.requestJson('GET', '/_/api/config');
    return Config.fromJson(json! as Map<String, dynamic>);
  }
}
