// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shrtnr/shrtnr.dart';
import 'package:test/test.dart';

const _base = 'https://shrtnr.test';

/// Holds state for a single test invocation so request assertions can run
/// after the client method completes.
class _Capture {
  http.Request? request;
}

/// Builds a client wired to a [MockClient] that returns a canned response.
/// The captured request is exposed for post-call assertions.
({ShrtnrClient client, _Capture capture}) _mockClient({
  required int status,
  Object? body,
  String contentType = 'application/json',
}) {
  final capture = _Capture();
  final mock = MockClient((request) async {
    capture.request = request;
    final bodyString = body == null ? '' : jsonEncode(body);
    return http.Response(
      bodyString,
      status,
      headers: <String, String>{'content-type': contentType},
    );
  });
  final client = ShrtnrClient(
    baseUrl: _base,
    auth: const ApiKeyAuth(apiKey: 'sk_abc'),
    httpClient: mock,
  );
  return (client: client, capture: capture);
}

void main() {
  group('Auth headers', () {
    test('sends Bearer header for API key auth', () async {
      final m = _mockClient(status: 200, body: <dynamic>[]);
      await m.client.listLinks();
      expect(m.capture.request!.headers['Authorization'], 'Bearer sk_abc');
      expect(m.capture.request!.headers['X-Client'], 'sdk');
    });
  });

  group('Error handling', () {
    test('throws ShrtnrException on non-2xx response', () async {
      final m = _mockClient(
        status: 404,
        body: <String, dynamic>{'error': 'Link not found'},
      );
      expect(() => m.client.getLink(999), throwsA(isA<ShrtnrException>()));
    });

    test('includes status and message from error response', () async {
      final m = _mockClient(
        status: 409,
        body: <String, dynamic>{'error': 'Slug already exists'},
      );
      try {
        await m.client.addCustomSlug(1, 'taken');
        fail('should have thrown');
      } on ShrtnrException catch (e) {
        expect(e.statusCode, 409);
        expect(e.message, 'Slug already exists');
      }
    });

    test('throws ShrtnrException on 401 unauthorized', () async {
      final m = _mockClient(
        status: 401,
        body: <String, dynamic>{'error': 'Unauthorized'},
      );
      expect(() => m.client.listLinks(), throwsA(isA<ShrtnrException>()));
    });
  });

  group('health', () {
    test('returns health status from /_/health', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{
          'status': 'ok',
          'version': '0.2.0',
          'timestamp': 1000,
        },
      );
      final result = await m.client.health();
      expect(result.status, 'ok');
      expect(result.version, '0.2.0');
      expect(m.capture.request!.url.toString(), '$_base/_/health');
      expect(m.capture.request!.method, 'GET');
    });
  });

  final linkJson = <String, dynamic>{
    'id': 1,
    'url': 'https://example.com',
    'slugs': <dynamic>[],
    'total_clicks': 0,
    'created_at': 1000,
    'expires_at': null,
    'created_via': null,
    'created_by': 'user@example.com',
    'label': null,
  };

  group('createLink', () {
    test('POSTs to /_/api/links with body', () async {
      final m = _mockClient(status: 201, body: linkJson);
      final result = await m.client.createLink(
        const CreateLinkOptions(url: 'https://example.com', label: 'Test'),
      );
      expect(result.id, 1);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links');
      expect(m.capture.request!.method, 'POST');
      expect(
        jsonDecode(m.capture.request!.body),
        <String, dynamic>{'url': 'https://example.com', 'label': 'Test'},
      );
    });
  });

  group('listLinks', () {
    test('GETs /_/api/links', () async {
      final m = _mockClient(status: 200, body: <dynamic>[]);
      final result = await m.client.listLinks();
      expect(result, isEmpty);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links');
      expect(m.capture.request!.method, 'GET');
    });
  });

  group('getLinkAnalytics', () {
    test('GETs /_/api/links/:id/analytics', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{
          'total_clicks': 42,
          'countries': <dynamic>[],
          'referrers': <dynamic>[],
          'devices': <dynamic>[],
          'browsers': <dynamic>[],
          'clicks_over_time': <dynamic>[],
        },
      );
      final result = await m.client.getLinkAnalytics(5);
      expect(result.totalClicks, 42);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/analytics',
      );
    });
  });

  group('getLink', () {
    test('GETs /_/api/links/:id', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{...linkJson, 'id': 3},
      );
      final result = await m.client.getLink(3);
      expect(result.id, 3);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/3');
    });
  });

  group('updateLink', () {
    test('PUTs /_/api/links/:id with url field', () async {
      final m = _mockClient(status: 200, body: linkJson);
      await m.client.updateLink(
        1,
        const UpdateLinkOptions(url: 'https://new.com'),
      );
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
      expect(m.capture.request!.method, 'PUT');
      expect(
        jsonDecode(m.capture.request!.body),
        <String, dynamic>{'url': 'https://new.com'},
      );
    });

    test('clears label when clearLabel is true', () async {
      final m = _mockClient(status: 200, body: linkJson);
      await m.client.updateLink(1, const UpdateLinkOptions(clearLabel: true));
      expect(
        jsonDecode(m.capture.request!.body),
        <String, dynamic>{'label': null},
      );
    });
  });

  group('disableLink', () {
    test('POSTs /_/api/links/:id/disable', () async {
      final m = _mockClient(status: 200, body: linkJson);
      await m.client.disableLink(1);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/disable',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  group('addCustomSlug', () {
    test('POSTs /_/api/links/:id/slugs', () async {
      final m = _mockClient(
        status: 201,
        body: <String, dynamic>{
          'link_id': 1,
          'slug': 'custom',
          'is_custom': 1,
          'is_primary': 0,
          'disabled_at': null,
          'click_count': 0,
          'created_at': 1000,
        },
      );
      final result = await m.client.addCustomSlug(1, 'custom');
      expect(result.slug, 'custom');
      expect(result.isCustom, isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/slugs');
      expect(
        jsonDecode(m.capture.request!.body),
        <String, dynamic>{'slug': 'custom'},
      );
    });
  });

  group('getLinkBySlug', () {
    test('GETs /_/api/slugs/:slug', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{
          ...linkJson,
          'id': 7,
          'slugs': <dynamic>[
            <String, dynamic>{
              'link_id': 7,
              'slug': 'find-me',
              'is_custom': 1,
              'is_primary': 0,
              'disabled_at': null,
              'click_count': 0,
              'created_at': 1000,
            },
          ],
        },
      );
      final result = await m.client.getLinkBySlug('find-me');
      expect(result.id, 7);
      expect(m.capture.request!.url.toString(), '$_base/_/api/slugs/find-me');
      expect(m.capture.request!.method, 'GET');
    });

    test('encodes slug in URL', () async {
      final m = _mockClient(status: 200, body: linkJson);
      await m.client.getLinkBySlug('foo/bar');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/slugs/foo%2Fbar',
      );
    });
  });

  group('enableLink', () {
    test('POSTs /_/api/links/:id/enable', () async {
      final m = _mockClient(status: 200, body: linkJson);
      await m.client.enableLink(1);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/enable',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  group('deleteLink', () {
    test('DELETEs /_/api/links/:id', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{'deleted': true},
      );
      final ok = await m.client.deleteLink(1);
      expect(ok, isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  group('listLinksByOwner', () {
    test('GETs /_/api/links?owner=... with encoded owner', () async {
      final m = _mockClient(status: 200, body: <dynamic>[]);
      final result = await m.client.listLinksByOwner('user@example.com');
      expect(result, isEmpty);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links?owner=user%40example.com',
      );
      expect(m.capture.request!.method, 'GET');
    });
  });

  group('disableSlug', () {
    test('POSTs /_/api/links/:linkId/slugs/:slug/disable', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{
          'link_id': 1,
          'slug': 'abc',
          'is_custom': 1,
          'is_primary': 0,
          'disabled_at': 1000,
          'click_count': 0,
          'created_at': 1000,
        },
      );
      await m.client.disableSlug(1, 'abc');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs/abc/disable',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  group('enableSlug', () {
    test('POSTs /_/api/links/:linkId/slugs/:slug/enable', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{
          'link_id': 1,
          'slug': 'abc',
          'is_custom': 1,
          'is_primary': 0,
          'disabled_at': null,
          'click_count': 0,
          'created_at': 1000,
        },
      );
      await m.client.enableSlug(1, 'abc');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs/abc/enable',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  group('removeSlug', () {
    test('DELETEs /_/api/links/:linkId/slugs/:slug', () async {
      final m = _mockClient(
        status: 200,
        body: <String, dynamic>{'removed': true},
      );
      final ok = await m.client.removeSlug(1, 'abc');
      expect(ok, isTrue);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs/abc',
      );
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  group('Base URL normalization', () {
    test('strips trailing slash from baseUrl', () async {
      final capture = _Capture();
      final mock = MockClient((request) async {
        capture.request = request;
        return http.Response(
          jsonEncode(<dynamic>[]),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final client = ShrtnrClient(
        baseUrl: '$_base/',
        auth: const ApiKeyAuth(apiKey: 'sk_abc'),
        httpClient: mock,
      );
      await client.listLinks();
      expect(capture.request!.url.toString(), '$_base/_/api/links');
    });
  });

  group('getLinkQR', () {
    test('returns SVG text and optionally encodes slug', () async {
      final capture = _Capture();
      final mock = MockClient((request) async {
        capture.request = request;
        return http.Response(
          '<svg></svg>',
          200,
          headers: <String, String>{'content-type': 'image/svg+xml'},
        );
      });
      final client = ShrtnrClient(
        baseUrl: _base,
        auth: const ApiKeyAuth(apiKey: 'sk_abc'),
        httpClient: mock,
      );
      final svg = await client.getLinkQR(1, slug: 'my/slug');
      expect(svg, '<svg></svg>');
      expect(
        capture.request!.url.toString(),
        '$_base/_/api/links/1/qr?slug=my%2Fslug',
      );
    });
  });
}
