// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// End-to-end tests run by scripts/test-sdks-e2e.sh against a live
// `wrangler dev` instance. Requires:
//   SHRTNR_TEST_URL        base URL of the running dev server
//   SHRTNR_TEST_API_KEY    a create+read API key minted by the harness
//
// Skipped from the default test run via the `e2e` tag. Invoke with
// `dart test --tags e2e`.

@Tags(['e2e'])
library;

import 'dart:io';

import 'package:shrtnr/shrtnr.dart';
import 'package:test/test.dart';

void main() {
  final baseUrl = Platform.environment['SHRTNR_TEST_URL'];
  final apiKey = Platform.environment['SHRTNR_TEST_API_KEY'];

  if (baseUrl == null || apiKey == null) {
    // Fail hard rather than skip. This file is excluded from default
    // `dart test` via --exclude-tags e2e; when it runs we are inside the
    // scripts/test-sdks-e2e.sh harness, which must export both env vars.
    // A silent skip would hide a broken harness behind a green CI check.
    test('e2e env vars must be set', () {
      fail(
        'SHRTNR_TEST_URL and SHRTNR_TEST_API_KEY must be set. '
        'Run e2e tests via scripts/test-sdks-e2e.sh from the repo root, not directly.',
      );
    });
    return;
  }

  final client = ShrtnrClient(baseUrl: baseUrl, apiKey: apiKey);

  group('Dart SDK e2e — live wrangler dev', () {
    test('link lifecycle — create, get, delete', () async {
      final link = await client.links.create(
        url: 'https://example.com/dart-e2e',
        label: 'dart-e2e',
      );
      expect(link.url, 'https://example.com/dart-e2e');
      final fetched = await client.links.get(link.id);
      expect(fetched.id, link.id);
      final result = await client.links.delete(link.id);
      expect(result.deleted, isTrue);
    });

    test('slug mutations work against public routes', () async {
      final link = await client.links.create(
        url: 'https://example.com/dart-slugs',
      );
      try {
        await client.slugs.add(link.id, 'dart-e2e-slug');
        final disabled = await client.slugs.disable(link.id, 'dart-e2e-slug');
        expect(disabled.disabledAt, isNotNull);
        final enabled = await client.slugs.enable(link.id, 'dart-e2e-slug');
        expect(enabled.disabledAt, isNull);
        final removed = await client.slugs.remove(link.id, 'dart-e2e-slug');
        expect(removed.removed, isTrue);
      } finally {
        await client.links.delete(link.id);
      }
    });

    test('bundle create/delete against live server', () async {
      final bundle = await client.bundles.create(name: 'dart e2e bundle');
      expect(bundle.name, 'dart e2e bundle');
      final result = await client.bundles.delete(bundle.id);
      expect(result.deleted, isTrue);
    });
  });
}
