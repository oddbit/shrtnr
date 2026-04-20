// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:shrtnr/shrtnr.dart';
import 'package:test/test.dart';

void main() {
  group('public SDK surface', () {
    test('exposes the expected public classes', () {
      // The constructors must exist and accept the documented arguments.
      // Instantiating them here is enough to catch accidental public-API
      // breakage at test time.
      const ApiKeyAuth(apiKey: 'sk_abc');
      const CreateLinkOptions(url: 'https://example.com');
      const UpdateLinkOptions();
      expect(ShrtnrClient, isNotNull);
      expect(ShrtnrException, isNotNull);
      expect(Link, isNotNull);
      expect(Slug, isNotNull);
      expect(ClickStats, isNotNull);
      expect(NameCount, isNotNull);
      expect(DateCount, isNotNull);
      expect(SlugCount, isNotNull);
      expect(HealthStatus, isNotNull);
    });
  });
}
