// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:http/http.dart' as http;

import 'base_client.dart';
import 'resources/bundles.dart';
import 'resources/config.dart';
import 'resources/links.dart';
import 'resources/slugs.dart';

export 'resources/bundles.dart' show BundlesResource;
export 'resources/config.dart' show ConfigResource;
export 'resources/links.dart' show LinksResource;
export 'resources/slugs.dart' show SlugsResource;

/// Top-level client for the shrtnr URL shortener API.
///
/// ```dart
/// import 'package:shrtnr/shrtnr.dart';
///
/// final client = ShrtnrClient(
///   baseUrl: 'https://your-shrtnr.example.com',
///   apiKey: 'sk_...',
/// );
///
/// final link = await client.links.create(url: 'https://example.com');
/// await client.bundles.archive(7);
/// client.close();
/// ```
class ShrtnrClient {
  /// Creates a client.
  ///
  /// - [baseUrl]: root URL of your shrtnr deployment, e.g. `https://s.example.com`.
  ///   Trailing slashes are stripped.
  /// - [apiKey]: API key from the admin dashboard (`sk_...`).
  /// - [httpClient]: optional injected `http.Client`. Useful for testing. When
  ///   omitted, a new `http.Client` is created and closed by [close].
  ShrtnrClient({
    required String baseUrl,
    required String apiKey,
    http.Client? httpClient,
  }) : _base = ShrtnrBaseClient(
          baseUrl: baseUrl,
          apiKey: apiKey,
          httpClient: httpClient,
        ) {
    links = LinksResource(_base);
    slugs = SlugsResource(_base);
    bundles = BundlesResource(_base);
    config = ConfigResource(_base);
  }

  final ShrtnrBaseClient _base;

  /// Link management and analytics methods.
  late final LinksResource links;

  /// Slug lookup and management methods.
  late final SlugsResource slugs;

  /// Bundle management and analytics methods.
  late final BundlesResource bundles;

  /// Deployment settings, including the origin short URLs are handed out on.
  late final ConfigResource config;

  /// Closes the underlying HTTP client.
  ///
  /// Safe to call multiple times. Has no effect when an external [httpClient]
  /// was injected via the constructor.
  void close() => _base.close();
}
