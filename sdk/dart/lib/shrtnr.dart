// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/// Dart client for the shrtnr URL shortener API.
///
/// ```dart
/// import 'package:shrtnr/shrtnr.dart';
///
/// final client = ShrtnrClient(
///   baseUrl: 'https://your-shrtnr.example.com',
///   auth: const ApiKeyAuth(apiKey: 'sk_...'),
/// );
///
/// final link = await client.createLink(
///   const CreateLinkOptions(url: 'https://example.com'),
/// );
/// ```
library;

export 'src/auth.dart' show ApiKeyAuth, ShrtnrAuth;
export 'src/client.dart' show ShrtnrClient;
export 'src/errors.dart' show ShrtnrException;
export 'src/models.dart'
    show
        ClickStats,
        CreateLinkOptions,
        DateCount,
        HealthStatus,
        Link,
        NameCount,
        Slug,
        SlugCount,
        UpdateLinkOptions;
