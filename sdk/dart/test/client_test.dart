// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Canonical SDK unit test layout — MUST stay structurally identical to
// sdk/typescript/src/__tests__/client.test.ts and
// sdk/python/tests/test_client.py: same describe/group blocks, same
// order, same test count, same names. When adding a new public method,
// add a matching test here AND in the other two SDKs. See CLAUDE.md
// "SDK parity".

import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shrtnr/shrtnr.dart';
import 'package:test/test.dart';

const _base = 'https://shrtnr.test';
const _apiKey = 'sk_abc';

class _Capture {
  http.Request? request;
}

({ShrtnrClient client, _Capture capture}) _mock({
  required int status,
  Object? body,
  String contentType = 'application/json',
}) {
  final capture = _Capture();
  final mock = MockClient((request) async {
    capture.request = request;
    final bodyString = body == null
        ? ''
        : (contentType.startsWith('application/json') ? jsonEncode(body) : body as String);
    return http.Response(
      bodyString,
      status,
      headers: <String, String>{'content-type': contentType},
    );
  });
  final client = ShrtnrClient(
    baseUrl: _base,
    auth: const ApiKeyAuth(apiKey: _apiKey),
    httpClient: mock,
  );
  return (client: client, capture: capture);
}

Map<String, Object?> _linkDict({
  int id = 1,
  String url = 'https://example.com',
  int totalClicks = 0,
  List<Map<String, Object?>> slugs = const [],
  int? expiresAt,
}) => {
      'id': id,
      'url': url,
      'label': null,
      'created_at': 1,
      'expires_at': expiresAt,
      'created_via': 'sdk',
      'created_by': 'owner@example.com',
      'slugs': slugs,
      'total_clicks': totalClicks,
    };

Map<String, Object?> _slugDict({
  int linkId = 1,
  String slug = 'custom',
  int isCustom = 1,
  int? disabledAt,
}) => {
      'link_id': linkId,
      'slug': slug,
      'is_custom': isCustom,
      'is_primary': 0,
      'click_count': 0,
      'created_at': 1,
      'disabled_at': disabledAt,
    };

Map<String, Object?> _bundleDict({
  int id = 42,
  String name = 'B',
  String accent = 'orange',
  int? archivedAt,
  String? description,
}) => {
      'id': id,
      'name': name,
      'description': description,
      'icon': null,
      'accent': accent,
      'archived_at': archivedAt,
      'created_via': 'sdk',
      'created_by': 'owner@example.com',
      'created_at': 1,
      'updated_at': 1,
    };

void main() {
  // ---- 1. Auth headers ----

  group('Auth headers', () {
    test('sends Bearer + X-Client: sdk on every request', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listLinks();
      expect(m.capture.request!.headers['Authorization'], 'Bearer $_apiKey');
      expect(m.capture.request!.headers['X-Client'], 'sdk');
    });
  });

  // ---- 2. Error handling ----

  group('Error handling', () {
    test('throws ShrtnrException on non-2xx response', () async {
      final m = _mock(status: 404, body: {'error': 'Link not found'});
      expect(() => m.client.getLink(999), throwsA(isA<ShrtnrException>()));
    });

    test('includes status and message from error body', () async {
      final m = _mock(status: 409, body: {'error': 'Slug already exists'});
      try {
        await m.client.addCustomSlug(1, 'taken');
        fail('expected ShrtnrException');
      } on ShrtnrException catch (e) {
        expect(e.statusCode, 409);
        expect(e.message, 'Slug already exists');
      }
    });

    test('throws ShrtnrException on 401 unauthorized', () async {
      final m = _mock(status: 401, body: {'error': 'Unauthorized'});
      expect(() => m.client.listLinks(), throwsA(isA<ShrtnrException>()));
    });
  });

  // ---- 3. health ----

  group('health', () {
    test('GETs /_/health', () async {
      final m = _mock(
        status: 200,
        body: {'status': 'ok', 'version': '0.1.0', 'timestamp': 1},
      );
      final h = await m.client.health();
      expect(h.status, 'ok');
      expect(m.capture.request!.url.toString(), '$_base/_/health');
    });
  });

  // ---- 4. createLink ----

  group('createLink', () {
    test('POSTs /_/api/links with body', () async {
      final m = _mock(status: 201, body: _linkDict(url: 'https://example.com'));
      await m.client.createLink(
        const CreateLinkOptions(url: 'https://example.com', label: 'L'),
      );
      final req = m.capture.request!;
      expect(req.url.toString(), '$_base/_/api/links');
      expect(req.method, 'POST');
      final body = jsonDecode(req.body) as Map<String, Object?>;
      expect(body['url'], 'https://example.com');
      expect(body['label'], 'L');
    });
  });

  // ---- 5. listLinks ----

  group('listLinks', () {
    test('GETs /_/api/links', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listLinks();
      expect(m.capture.request!.url.toString(), '$_base/_/api/links');
      expect(m.capture.request!.method, 'GET');
    });
  });

  // ---- 6. getLink ----

  group('getLink', () {
    test('GETs /_/api/links/:id', () async {
      final m = _mock(status: 200, body: _linkDict(id: 3));
      await m.client.getLink(3);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/3');
    });
  });

  // ---- 7. updateLink ----

  group('updateLink', () {
    test('PUTs /_/api/links/:id with patch body', () async {
      final m = _mock(status: 200, body: _linkDict(url: 'https://new.com'));
      await m.client.updateLink(1, const UpdateLinkOptions(url: 'https://new.com'));
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
      expect(m.capture.request!.method, 'PUT');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body['url'], 'https://new.com');
    });
  });

  // ---- 8. disableLink ----

  group('disableLink', () {
    test('POSTs /_/api/links/:id/disable', () async {
      final m = _mock(status: 200, body: _linkDict(expiresAt: 1));
      await m.client.disableLink(1);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/disable');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 9. enableLink ----

  group('enableLink', () {
    test('POSTs /_/api/links/:id/enable', () async {
      final m = _mock(status: 200, body: _linkDict());
      await m.client.enableLink(1);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/enable');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 10. deleteLink ----

  group('deleteLink', () {
    test('DELETEs /_/api/links/:id', () async {
      final m = _mock(status: 200, body: {'deleted': true});
      expect(await m.client.deleteLink(1), isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 11. listLinksByOwner ----

  group('listLinksByOwner', () {
    test('GETs /_/api/links?owner=... with URL-encoded owner', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listLinksByOwner('user@example.com');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links?owner=user%40example.com',
      );
    });
  });

  // ---- 12. addCustomSlug ----

  group('addCustomSlug', () {
    test('POSTs /_/api/links/:id/slugs', () async {
      final m = _mock(status: 201, body: _slugDict(slug: 'custom'));
      await m.client.addCustomSlug(1, 'custom');
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/slugs');
      expect(m.capture.request!.method, 'POST');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body, {'slug': 'custom'});
    });
  });

  // ---- 13. disableSlug ----

  group('disableSlug', () {
    test('POSTs /_/api/links/:id/slugs/:slug/disable', () async {
      final m = _mock(status: 200, body: _slugDict(slug: 'abc', disabledAt: 1));
      await m.client.disableSlug(1, 'abc');
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/slugs/abc/disable');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 14. enableSlug ----

  group('enableSlug', () {
    test('POSTs /_/api/links/:id/slugs/:slug/enable', () async {
      final m = _mock(status: 200, body: _slugDict(slug: 'abc'));
      await m.client.enableSlug(1, 'abc');
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/slugs/abc/enable');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 15. removeSlug ----

  group('removeSlug', () {
    test('DELETEs /_/api/links/:id/slugs/:slug', () async {
      final m = _mock(status: 200, body: {'removed': true});
      expect(await m.client.removeSlug(1, 'abc'), isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/slugs/abc');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 16. getLinkBySlug ----

  group('getLinkBySlug', () {
    test('GETs /_/api/slugs/:slug', () async {
      final m = _mock(status: 200, body: _linkDict(id: 7));
      await m.client.getLinkBySlug('find-me');
      expect(m.capture.request!.url.toString(), '$_base/_/api/slugs/find-me');
    });

    test('URL-encodes slugs with reserved characters', () async {
      final m = _mock(status: 200, body: _linkDict());
      await m.client.getLinkBySlug('foo/bar');
      expect(m.capture.request!.url.toString(), '$_base/_/api/slugs/foo%2Fbar');
    });
  });

  // ---- 17. getLinkAnalytics ----

  group('getLinkAnalytics', () {
    test('GETs /_/api/links/:id/analytics', () async {
      final m = _mock(status: 200, body: {
        'total_clicks': 42,
        'countries': <dynamic>[],
        'referrers': <dynamic>[],
        'referrer_hosts': <dynamic>[],
        'devices': <dynamic>[],
        'os': <dynamic>[],
        'browsers': <dynamic>[],
        'link_modes': <dynamic>[],
        'channels': <dynamic>[],
        'clicks_over_time': <dynamic>[],
        'slug_clicks': <dynamic>[],
      });
      final stats = await m.client.getLinkAnalytics(5);
      expect(stats.totalClicks, 42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/5/analytics');
    });
  });

  // ---- 18. getLinkQR ----

  group('getLinkQR', () {
    test('GETs /_/api/links/:id/qr and returns the SVG body', () async {
      final m = _mock(status: 200, body: '<svg/>', contentType: 'image/svg+xml');
      final svg = await m.client.getLinkQR(5);
      expect(svg, contains('<svg'));
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/5/qr');
    });

    test('URL-encodes the optional slug query param', () async {
      final m = _mock(status: 200, body: '<svg/>', contentType: 'image/svg+xml');
      await m.client.getLinkQR(5, slug: 'foo/bar');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/qr?slug=foo%2Fbar',
      );
    });
  });

  // ---- 19. createBundle ----

  group('createBundle', () {
    test('POSTs /_/api/bundles with body', () async {
      final m = _mock(status: 201, body: _bundleDict(name: 'B', accent: 'blue'));
      await m.client.createBundle(
        const CreateBundleOptions(name: 'B', accent: 'blue'),
      );
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles');
      expect(m.capture.request!.method, 'POST');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body['name'], 'B');
      expect(body['accent'], 'blue');
    });
  });

  // ---- 20. listBundles ----

  group('listBundles', () {
    test('GETs /_/api/bundles by default', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listBundles();
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles');
    });

    test('adds ?archived=all when archived: true', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listBundles(archived: true);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles?archived=all');
    });
  });

  // ---- 21. getBundle ----

  group('getBundle', () {
    test('GETs /_/api/bundles/:id', () async {
      final m = _mock(status: 200, body: _bundleDict());
      await m.client.getBundle(42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
    });
  });

  // ---- 22. updateBundle ----

  group('updateBundle', () {
    test('PUTs /_/api/bundles/:id with patch body', () async {
      final m = _mock(status: 200, body: _bundleDict(description: 'edited'));
      await m.client.updateBundle(42, const UpdateBundleOptions(description: 'edited'));
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
      expect(m.capture.request!.method, 'PUT');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body['description'], 'edited');
    });
  });

  // ---- 23. deleteBundle ----

  group('deleteBundle', () {
    test('DELETEs /_/api/bundles/:id', () async {
      final m = _mock(status: 200, body: {'deleted': true});
      expect(await m.client.deleteBundle(42), isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 24. archiveBundle ----

  group('archiveBundle', () {
    test('POSTs /_/api/bundles/:id/archive', () async {
      final m = _mock(status: 200, body: _bundleDict(archivedAt: 1));
      await m.client.archiveBundle(42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42/archive');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 25. unarchiveBundle ----

  group('unarchiveBundle', () {
    test('POSTs /_/api/bundles/:id/unarchive', () async {
      final m = _mock(status: 200, body: _bundleDict());
      await m.client.unarchiveBundle(42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42/unarchive');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 26. getBundleAnalytics ----

  group('getBundleAnalytics', () {
    test('GETs /_/api/bundles/:id/analytics with ?range=', () async {
      final m = _mock(status: 200, body: {
        'bundle': _bundleDict(),
        'link_count': 0,
        'total_clicks': 0,
        'clicked_links': 0,
        'countries_reached': 0,
        'timeline': {
          'range': '7d',
          'buckets': <dynamic>[],
          'summary': {
            'last_24h': 0,
            'last_7d': 0,
            'last_30d': 0,
            'last_90d': 0,
            'last_1y': 0,
          },
        },
        'countries': <dynamic>[],
        'devices': <dynamic>[],
        'os': <dynamic>[],
        'browsers': <dynamic>[],
        'referrers': <dynamic>[],
        'referrer_hosts': <dynamic>[],
        'link_modes': <dynamic>[],
        'per_link': <dynamic>[],
      });
      await m.client.getBundleAnalytics(42, range: '7d');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/analytics?range=7d',
      );
    });
  });

  // ---- 27. listBundleLinks ----

  group('listBundleLinks', () {
    test('GETs /_/api/bundles/:id/links', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listBundleLinks(42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42/links');
    });
  });

  // ---- 28. addLinkToBundle ----

  group('addLinkToBundle', () {
    test('POSTs /_/api/bundles/:id/links with link_id', () async {
      final m = _mock(status: 200, body: {'added': true});
      expect(await m.client.addLinkToBundle(42, 7), isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42/links');
      expect(m.capture.request!.method, 'POST');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body, {'link_id': 7});
    });
  });

  // ---- 29. removeLinkFromBundle ----

  group('removeLinkFromBundle', () {
    test('DELETEs /_/api/bundles/:id/links/:linkId', () async {
      final m = _mock(status: 200, body: {'removed': true});
      expect(await m.client.removeLinkFromBundle(42, 7), isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42/links/7');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 30. listBundlesForLink ----

  group('listBundlesForLink', () {
    test('GETs /_/api/links/:id/bundles', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.listBundlesForLink(7);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/7/bundles');
    });
  });

  // ---- 31. Base URL normalization ----

  group('Base URL normalization', () {
    test('strips trailing slashes from baseUrl', () async {
      final capture = _Capture();
      final mock = MockClient((request) async {
        capture.request = request;
        return http.Response('[]', 200, headers: {'content-type': 'application/json'});
      });
      final client = ShrtnrClient(
        baseUrl: '$_base/',
        auth: const ApiKeyAuth(apiKey: _apiKey),
        httpClient: mock,
      );
      await client.listLinks();
      expect(capture.request!.url.toString(), '$_base/_/api/links');
    });
  });
}
