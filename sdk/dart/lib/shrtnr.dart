// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/// Dart client for the shrtnr URL shortener API.
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
library;

export 'src/client.dart' show ShrtnrClient, LinksResource, SlugsResource, BundlesResource;
export 'src/errors.dart' show ShrtnrError;
export 'src/models.dart'
    show
        AddedResult,
        Bundle,
        BundleTopLink,
        BundleWithSummary,
        ClickStats,
        DateClickCount,
        DeletedResult,
        Link,
        NameCount,
        RemovedResult,
        Slug,
        SlugClickCount,
        TimelineBucket,
        TimelineData,
        TimelineSummary;
