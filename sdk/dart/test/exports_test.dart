// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:shrtnr/shrtnr.dart';
import 'package:test/test.dart';

void main() {
  group('Public SDK surface', () {
    test('exposes the expected public types', () {
      // Referencing each type confirms they are exported from the library.
      expect(ShrtnrClient, isNotNull);
      expect(ShrtnrError, isNotNull);
      expect(Link, isNotNull);
      expect(Slug, isNotNull);
      expect(Bundle, isNotNull);
      expect(BundleWithSummary, isNotNull);
      expect(BundleTopLink, isNotNull);
      expect(ClickStats, isNotNull);
      expect(NameCount, isNotNull);
      expect(DateClickCount, isNotNull);
      expect(SlugClickCount, isNotNull);
      expect(TimelineData, isNotNull);
      expect(TimelineBucket, isNotNull);
      expect(TimelineSummary, isNotNull);
      expect(DeletedResult, isNotNull);
      expect(AddedResult, isNotNull);
      expect(RemovedResult, isNotNull);
    });

    test('ShrtnrClient accepts baseUrl and apiKey in constructor', () {
      // Constructing with a real-looking URL and key must not throw.
      final client = ShrtnrClient(
        baseUrl: 'https://s.example.com',
        apiKey: 'sk_test',
      );
      expect(client.links, isA<LinksResource>());
      expect(client.slugs, isA<SlugsResource>());
      expect(client.bundles, isA<BundlesResource>());
      client.close();
    });

    test('ShrtnrError carries status and serverMessage', () {
      const err = ShrtnrError(404, 'not found');
      expect(err.status, 404);
      expect(err.serverMessage, 'not found');
      expect(err.toString(), contains('404'));
      expect(err.toString(), contains('not found'));
    });
  });
}
