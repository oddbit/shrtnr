// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Canonical SDK unit test layout. Structurally mirrors
// sdk/typescript/tests/client.test.ts and
// sdk/python/tests/test_client.py: same describe/group blocks,
// same order, same test count, same intent. When adding a public
// method, add a matching test here AND in the other two SDKs.

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
        : (contentType.startsWith('application/json')
            ? jsonEncode(body)
            : body as String);
    return http.Response(
      bodyString,
      status,
      headers: <String, String>{'content-type': contentType},
    );
  });
  final client = ShrtnrClient(
    baseUrl: _base,
    apiKey: _apiKey,
    httpClient: mock,
  );
  return (client: client, capture: capture);
}

// ---- Fixture builders ----

Map<String, Object?> _linkJson({
  int id = 1,
  String url = 'https://example.com',
  int totalClicks = 0,
  double? deltaPct,
  List<Map<String, Object?>> slugs = const [],
}) =>
    <String, Object?>{
      'id': id,
      'url': url,
      'label': null,
      'created_at': 1000000,
      'expires_at': null,
      'created_via': 'sdk',
      'created_by': 'owner@example.com',
      'slugs': slugs,
      'total_clicks': totalClicks,
      if (deltaPct != null) 'delta_pct': deltaPct,
    };

Map<String, Object?> _slugJson({
  int linkId = 1,
  String slug = 'custom',
  int isCustom = 1,
  int? disabledAt,
}) =>
    <String, Object?>{
      'link_id': linkId,
      'slug': slug,
      'is_custom': isCustom,
      'is_primary': 0,
      'click_count': 5,
      'created_at': 1000000,
      'disabled_at': disabledAt,
    };

Map<String, Object?> _bundleJson({
  int id = 42,
  String name = 'B',
  String accent = 'orange',
  int? archivedAt,
}) =>
    <String, Object?>{
      'id': id,
      'name': name,
      'description': null,
      'icon': null,
      'accent': accent,
      'archived_at': archivedAt,
      'created_via': 'sdk',
      'created_by': 'owner@example.com',
      'created_at': 1000000,
      'updated_at': 1000000,
    };

Map<String, Object?> _bundleWithSummaryJson({
  int id = 42,
  String name = 'B',
  String accent = 'orange',
  int? archivedAt,
  double? deltaPct,
}) =>
    <String, Object?>{
      ..._bundleJson(id: id, name: name, accent: accent, archivedAt: archivedAt),
      'link_count': 3,
      'total_clicks': 100,
      'sparkline': <int>[10, 20, 30],
      'top_links': <dynamic>[],
      if (deltaPct != null) 'delta_pct': deltaPct,
    };

Map<String, Object?> _clickStatsJson({int totalClicks = 42}) =>
    <String, Object?>{
      'total_clicks': totalClicks,
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
      'num_countries': 5,
      'num_referrers': 3,
      'num_referrer_hosts': 2,
      'num_os': 4,
      'num_browsers': 6,
    };

Map<String, Object?> _timelineJson() => <String, Object?>{
      'range': '7d',
      'buckets': <Map<String, Object?>>[
        <String, Object?>{'label': 'Mon', 'count': 10},
      ],
      'summary': <String, Object?>{
        'last_24h': 1,
        'last_7d': 7,
        'last_30d': 30,
        'last_90d': 90,
        'last_1y': 365,
      },
    };

void main() {
  // ---- 1. Auth header ----

  group('Auth header', () {
    test('sends Authorization: Bearer on every request', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.links.list();
      expect(
        m.capture.request!.headers['Authorization'],
        'Bearer $_apiKey',
      );
    });

    test('does not send X-Client header (removed in 1.0)', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.links.list();
      expect(m.capture.request!.headers.containsKey('X-Client'), isFalse);
    });
  });

  // ---- 2. Error handling ----

  group('Error handling', () {
    test('throws ShrtnrError on 4xx', () async {
      final m = _mock(status: 404, body: <String, Object?>{'error': 'not found'});
      expect(() => m.client.links.get(999), throwsA(isA<ShrtnrError>()));
    });

    test('populates status and serverMessage from error body', () async {
      final m =
          _mock(status: 409, body: <String, Object?>{'error': 'Slug already exists'});
      try {
        await m.client.slugs.add(1, 'taken');
        fail('expected ShrtnrError');
      } on ShrtnrError catch (e) {
        expect(e.status, 409);
        expect(e.serverMessage, 'Slug already exists');
      }
    });

    test('throws ShrtnrError on 401', () async {
      final m = _mock(status: 401, body: <String, Object?>{'error': 'Unauthorized'});
      expect(() => m.client.links.list(), throwsA(isA<ShrtnrError>()));
    });

    test('throws ShrtnrError with status 0 on network error', () async {
      final capture = _Capture();
      final mock = MockClient((request) async {
        capture.request = request;
        throw Exception('connection refused');
      });
      final client =
          ShrtnrClient(baseUrl: _base, apiKey: _apiKey, httpClient: mock);
      try {
        await client.links.list();
        fail('expected ShrtnrError');
      } on ShrtnrError catch (e) {
        expect(e.status, 0);
        expect(e.serverMessage, contains('connection refused'));
      }
    });
  });

  // ---- 3. links.get ----

  group('links.get', () {
    test('GETs /_/api/links/:id', () async {
      final m = _mock(status: 200, body: _linkJson(id: 3));
      final link = await m.client.links.get(3);
      expect(link.id, 3);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/3');
      expect(m.capture.request!.method, 'GET');
    });

    test('appends range param when given', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.links.get(1, range: TimelineRange.last7d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1?range=7d',
      );
    });

    test('omits range param when not given', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.links.get(1);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
    });
  });

  // ---- 4. links.list ----

  group('links.list', () {
    test('GETs /_/api/links with no params by default', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.links.list();
      expect(m.capture.request!.url.toString(), '$_base/_/api/links');
    });

    test('appends owner query param when given', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.links.list(owner: 'user@example.com');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links?owner=user%40example.com',
      );
    });

    test('appends range query param when given', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.links.list(range: TimelineRange.last30d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links?range=30d',
      );
    });
  });

  // ---- 5. links.create ----

  group('links.create', () {
    test('POSTs /_/api/links with required and optional fields', () async {
      final m = _mock(status: 201, body: _linkJson(url: 'https://example.com'));
      await m.client.links.create(
        url: 'https://example.com',
        label: 'My link',
        slugLength: 6,
        expiresAt: 9999999,
        allowDuplicate: true,
      );
      final req = m.capture.request!;
      expect(req.url.toString(), '$_base/_/api/links');
      expect(req.method, 'POST');
      final body = jsonDecode(req.body) as Map<String, Object?>;
      expect(body['url'], 'https://example.com');
      expect(body['label'], 'My link');
      expect(body['slug_length'], 6);
      expect(body['expires_at'], 9999999);
      expect(body['allow_duplicate'], true);
    });

    test('omits optional fields when not provided', () async {
      final m = _mock(status: 201, body: _linkJson());
      await m.client.links.create(url: 'https://example.com');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body.containsKey('label'), isFalse);
      expect(body.containsKey('slug_length'), isFalse);
    });
  });

  // ---- 6. links.update ----

  group('links.update', () {
    test('PUTs /_/api/links/:id with patch body', () async {
      final m = _mock(status: 200, body: _linkJson(url: 'https://new.com'));
      await m.client.links.update(1, url: 'https://new.com');
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
      expect(m.capture.request!.method, 'PUT');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body['url'], 'https://new.com');
    });

    test('sends label: null to clear the label', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.links.update(1, label: null);
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body.containsKey('label'), isTrue);
      expect(body['label'], isNull);
    });

    test('omits label when not provided', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.links.update(1, url: 'https://new.com');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body.containsKey('label'), isFalse);
    });
  });

  // ---- 7. links.disable ----

  group('links.disable', () {
    test('POSTs /_/api/links/:id/disable', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.links.disable(1);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/disable');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 8. links.enable ----

  group('links.enable', () {
    test('POSTs /_/api/links/:id/enable', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.links.enable(1);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1/enable');
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 9. links.delete ----

  group('links.delete', () {
    test('DELETEs /_/api/links/:id and returns DeletedResult', () async {
      final m =
          _mock(status: 200, body: <String, Object?>{'deleted': true});
      final result = await m.client.links.delete(1);
      expect(result.deleted, isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/1');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 10. links.analytics ----

  group('links.analytics', () {
    test('GETs /_/api/links/:id/analytics', () async {
      final m = _mock(status: 200, body: _clickStatsJson(totalClicks: 99));
      final stats = await m.client.links.analytics(5);
      expect(stats.totalClicks, 99);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/analytics',
      );
    });

    test('appends range param when given', () async {
      final m = _mock(status: 200, body: _clickStatsJson());
      await m.client.links.analytics(5, range: TimelineRange.last30d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/analytics?range=30d',
      );
    });

    test('omits range param when not given', () async {
      final m = _mock(status: 200, body: _clickStatsJson());
      await m.client.links.analytics(5);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/analytics',
      );
    });

    test('maps snake_case num_* fields to camelCase', () async {
      final m = _mock(status: 200, body: _clickStatsJson());
      final stats = await m.client.links.analytics(1);
      expect(stats.numCountries, 5);
      expect(stats.numReferrers, 3);
      expect(stats.numReferrerHosts, 2);
      expect(stats.numOs, 4);
      expect(stats.numBrowsers, 6);
    });
  });

  // ---- 11. links.timeline ----

  group('links.timeline', () {
    test('GETs /_/api/links/:id/timeline and parses TimelineData', () async {
      final m = _mock(status: 200, body: _timelineJson());
      final td = await m.client.links.timeline(5);
      expect(td.range, TimelineRange.last7d);
      expect(td.buckets.length, 1);
      expect(td.buckets[0].label, 'Mon');
      expect(td.buckets[0].count, 10);
      expect(td.summary.last7d, 7);
      expect(td.summary.last30d, 30);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/timeline',
      );
    });

    test('appends range param when given', () async {
      final m = _mock(status: 200, body: _timelineJson());
      await m.client.links.timeline(5, range: TimelineRange.last90d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/5/timeline?range=90d',
      );
    });
  });

  // ---- 12. links.qr ----

  group('links.qr', () {
    test('GETs /_/api/links/:id/qr and returns SVG body', () async {
      final m =
          _mock(status: 200, body: '<svg/>', contentType: 'image/svg+xml');
      final svg = await m.client.links.qr(5);
      expect(svg, contains('<svg'));
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/5/qr');
    });

    test('appends slug and size params when given', () async {
      final m =
          _mock(status: 200, body: '<svg/>', contentType: 'image/svg+xml');
      await m.client.links.qr(5, slug: 'promo', size: 256);
      final url = m.capture.request!.url.toString();
      expect(url, contains('slug=promo'));
      expect(url, contains('size=256'));
    });

    test('omits query params when not given', () async {
      final m =
          _mock(status: 200, body: '<svg/>', contentType: 'image/svg+xml');
      await m.client.links.qr(5);
      expect(m.capture.request!.url.toString(), '$_base/_/api/links/5/qr');
    });
  });

  // ---- 13. links.bundles ----

  group('links.bundles', () {
    test('GETs /_/api/links/:id/bundles', () async {
      final m = _mock(
        status: 200,
        body: <Map<String, Object?>>[_bundleJson()],
      );
      final bundles = await m.client.links.bundles(7);
      expect(bundles.length, 1);
      expect(bundles[0].id, 42);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/7/bundles',
      );
    });
  });

  // ---- 14. slugs.lookup ----

  group('slugs.lookup', () {
    test('GETs /_/api/slugs/:slug', () async {
      final m = _mock(status: 200, body: _linkJson(id: 7));
      final link = await m.client.slugs.lookup('find-me');
      expect(link.id, 7);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/slugs/find-me',
      );
    });

    test('URL-encodes slugs with reserved characters', () async {
      final m = _mock(status: 200, body: _linkJson());
      await m.client.slugs.lookup('foo/bar');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/slugs/foo%2Fbar',
      );
    });
  });

  // ---- 15. slugs.add ----

  group('slugs.add', () {
    test('POSTs /_/api/links/:id/slugs with slug body', () async {
      final m = _mock(status: 201, body: _slugJson(slug: 'custom'));
      await m.client.slugs.add(1, 'custom');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs',
      );
      expect(m.capture.request!.method, 'POST');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body, <String, Object?>{'slug': 'custom'});
    });
  });

  // ---- 16. slugs.disable ----

  group('slugs.disable', () {
    test('POSTs /_/api/links/:id/slugs/:slug/disable', () async {
      final m = _mock(
          status: 200, body: _slugJson(slug: 'abc', disabledAt: 9999999));
      await m.client.slugs.disable(1, 'abc');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs/abc/disable',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 17. slugs.enable ----

  group('slugs.enable', () {
    test('POSTs /_/api/links/:id/slugs/:slug/enable', () async {
      final m = _mock(status: 200, body: _slugJson(slug: 'abc'));
      await m.client.slugs.enable(1, 'abc');
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs/abc/enable',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 18. slugs.remove ----

  group('slugs.remove', () {
    test('DELETEs /_/api/links/:id/slugs/:slug and returns RemovedResult',
        () async {
      final m =
          _mock(status: 200, body: <String, Object?>{'removed': true});
      final result = await m.client.slugs.remove(1, 'abc');
      expect(result.removed, isTrue);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/links/1/slugs/abc',
      );
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 19. bundles.get ----

  group('bundles.get', () {
    test('GETs /_/api/bundles/:id', () async {
      final m = _mock(status: 200, body: _bundleWithSummaryJson(id: 42));
      final b = await m.client.bundles.get(42);
      expect(b.id, 42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
    });

    test('appends range param when given', () async {
      final m = _mock(status: 200, body: _bundleWithSummaryJson());
      await m.client.bundles.get(42, range: TimelineRange.last7d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42?range=7d',
      );
    });

    test('omits range param when not given', () async {
      final m = _mock(status: 200, body: _bundleWithSummaryJson());
      await m.client.bundles.get(42);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
    });
  });

  // ---- 20. bundles.list ----

  group('bundles.list', () {
    test('GETs /_/api/bundles with no params by default', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.bundles.list();
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles');
    });

    test('appends archived param when given', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.bundles.list(archived: BundleArchivedFilter.all);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles?archived=all',
      );
    });

    test('appends range param when given', () async {
      final m = _mock(status: 200, body: <dynamic>[]);
      await m.client.bundles.list(range: TimelineRange.last30d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles?range=30d',
      );
    });
  });

  // ---- 21. bundles.create ----

  group('bundles.create', () {
    test('POSTs /_/api/bundles with required and optional fields', () async {
      final m = _mock(status: 201, body: _bundleJson(name: 'B', accent: 'blue'));
      await m.client.bundles.create(
          name: 'B',
          description: 'desc',
          icon: 'star',
          accent: BundleAccent.blue);
      final req = m.capture.request!;
      expect(req.url.toString(), '$_base/_/api/bundles');
      expect(req.method, 'POST');
      final body = jsonDecode(req.body) as Map<String, Object?>;
      expect(body['name'], 'B');
      expect(body['description'], 'desc');
      expect(body['icon'], 'star');
      expect(body['accent'], 'blue');
    });

    test('omits optional fields when not provided', () async {
      final m = _mock(status: 201, body: _bundleJson());
      await m.client.bundles.create(name: 'B');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body.containsKey('description'), isFalse);
      expect(body.containsKey('icon'), isFalse);
      expect(body.containsKey('accent'), isFalse);
    });
  });

  // ---- 22. bundles.update ----

  group('bundles.update', () {
    test('PUTs /_/api/bundles/:id with patch body', () async {
      final m = _mock(status: 200, body: _bundleJson(name: 'Updated'));
      await m.client.bundles.update(42, name: 'Updated');
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
      expect(m.capture.request!.method, 'PUT');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body['name'], 'Updated');
    });

    test('sends description: null to clear the description', () async {
      final m = _mock(status: 200, body: _bundleJson());
      await m.client.bundles.update(42, description: null);
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body.containsKey('description'), isTrue);
      expect(body['description'], isNull);
    });

    test('omits description when not provided', () async {
      final m = _mock(status: 200, body: _bundleJson());
      await m.client.bundles.update(42, name: 'Only Name');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body.containsKey('description'), isFalse);
    });
  });

  // ---- 23. bundles.delete ----

  group('bundles.delete', () {
    test('DELETEs /_/api/bundles/:id and returns DeletedResult', () async {
      final m =
          _mock(status: 200, body: <String, Object?>{'deleted': true});
      final result = await m.client.bundles.delete(42);
      expect(result.deleted, isTrue);
      expect(m.capture.request!.url.toString(), '$_base/_/api/bundles/42');
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 24. bundles.archive ----

  group('bundles.archive', () {
    test('POSTs /_/api/bundles/:id/archive', () async {
      final m = _mock(
          status: 200, body: _bundleJson(archivedAt: 9999999));
      await m.client.bundles.archive(42);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/archive',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 25. bundles.unarchive ----

  group('bundles.unarchive', () {
    test('POSTs /_/api/bundles/:id/unarchive', () async {
      final m = _mock(status: 200, body: _bundleJson());
      await m.client.bundles.unarchive(42);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/unarchive',
      );
      expect(m.capture.request!.method, 'POST');
    });
  });

  // ---- 26. bundles.analytics ----

  group('bundles.analytics', () {
    test('GETs /_/api/bundles/:id/analytics', () async {
      final m = _mock(status: 200, body: _clickStatsJson(totalClicks: 55));
      final stats = await m.client.bundles.analytics(42);
      expect(stats.totalClicks, 55);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/analytics',
      );
    });

    test('appends range param when given', () async {
      final m = _mock(status: 200, body: _clickStatsJson());
      await m.client.bundles.analytics(42, range: TimelineRange.last7d);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/analytics?range=7d',
      );
    });

    test('omits range param when not given', () async {
      final m = _mock(status: 200, body: _clickStatsJson());
      await m.client.bundles.analytics(42);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/analytics',
      );
    });
  });

  // ---- 27. bundles.links ----

  group('bundles.links', () {
    test('GETs /_/api/bundles/:id/links', () async {
      final m = _mock(
        status: 200,
        body: <Map<String, Object?>>[_linkJson(id: 3)],
      );
      final links = await m.client.bundles.links(42);
      expect(links.length, 1);
      expect(links[0].id, 3);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/links',
      );
    });
  });

  // ---- 28. bundles.addLink ----

  group('bundles.addLink', () {
    test('POSTs /_/api/bundles/:id/links with link_id and returns AddedResult',
        () async {
      final m =
          _mock(status: 200, body: <String, Object?>{'added': true});
      final result = await m.client.bundles.addLink(42, 7);
      expect(result.added, isTrue);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/links',
      );
      expect(m.capture.request!.method, 'POST');
      final body = jsonDecode(m.capture.request!.body) as Map<String, Object?>;
      expect(body, <String, Object?>{'link_id': 7});
    });
  });

  // ---- 29. bundles.removeLink ----

  group('bundles.removeLink', () {
    test(
        'DELETEs /_/api/bundles/:id/links/:linkId and returns RemovedResult',
        () async {
      final m =
          _mock(status: 200, body: <String, Object?>{'removed': true});
      final result = await m.client.bundles.removeLink(42, 7);
      expect(result.removed, isTrue);
      expect(
        m.capture.request!.url.toString(),
        '$_base/_/api/bundles/42/links/7',
      );
      expect(m.capture.request!.method, 'DELETE');
    });
  });

  // ---- 30. Base URL normalization ----

  group('Base URL normalization', () {
    test('strips trailing slashes from baseUrl', () async {
      final capture = _Capture();
      final mock = MockClient((request) async {
        capture.request = request;
        return http.Response('[]', 200,
            headers: <String, String>{'content-type': 'application/json'});
      });
      final client =
          ShrtnrClient(baseUrl: '$_base/', apiKey: _apiKey, httpClient: mock);
      await client.links.list();
      expect(capture.request!.url.toString(), '$_base/_/api/links');
    });
  });

  // ---- 31. snake_case → camelCase model mapping ----

  group('snake_case to camelCase model mapping', () {
    test('Link maps snake_case fields to camelCase', () async {
      final m = _mock(
        status: 200,
        body: _linkJson(id: 99, totalClicks: 77, deltaPct: 12.5),
      );
      final link = await m.client.links.get(99);
      expect(link.totalClicks, 77);
      expect(link.deltaPct, 12.5);
      expect(link.createdBy, 'owner@example.com');
      expect(link.createdVia, 'sdk');
    });

    test('Slug maps snake_case fields to camelCase', () async {
      final m = _mock(
        status: 201,
        body: _slugJson(linkId: 5, slug: 'custom', isCustom: 1, disabledAt: null),
      );
      final slug = await m.client.slugs.add(5, 'custom');
      expect(slug.linkId, 5);
      expect(slug.isCustom, 1);
      expect(slug.isPrimary, 0);
      expect(slug.clickCount, 5);
      expect(slug.disabledAt, isNull);
    });

    test('Bundle maps snake_case fields to camelCase', () async {
      final m = _mock(status: 200, body: _bundleJson(archivedAt: 9999999));
      final bundle = await m.client.bundles.archive(42);
      expect(bundle.archivedAt, 9999999);
      expect(bundle.createdBy, 'owner@example.com');
      expect(bundle.createdVia, 'sdk');
    });

    test('BundleWithSummary maps flat JSON fields correctly', () async {
      final m = _mock(
        status: 200,
        body: _bundleWithSummaryJson(deltaPct: 5.0),
      );
      final b = await m.client.bundles.get(42);
      expect(b.linkCount, 3);
      expect(b.totalClicks, 100);
      expect(b.deltaPct, 5.0);
      expect(b.sparkline, <int>[10, 20, 30]);
    });

    test('TimelineData.summary maps last_* fields to camelCase', () async {
      final m = _mock(status: 200, body: _timelineJson());
      final td = await m.client.links.timeline(1);
      expect(td.summary.last24h, 1);
      expect(td.summary.last7d, 7);
      expect(td.summary.last30d, 30);
      expect(td.summary.last90d, 90);
      expect(td.summary.last1y, 365);
    });
  });

  // ---- 32. BundleAccent enum ----

  group('BundleAccent enum', () {
    test('wireValue round-trips for every member', () {
      expect(BundleAccent.orange.wireValue, 'orange');
      expect(BundleAccent.red.wireValue, 'red');
      expect(BundleAccent.green.wireValue, 'green');
      expect(BundleAccent.blue.wireValue, 'blue');
      expect(BundleAccent.purple.wireValue, 'purple');
    });

    test('fromWire parses known values', () {
      expect(BundleAccent.fromWire('orange'), BundleAccent.orange);
      expect(BundleAccent.fromWire('blue'), BundleAccent.blue);
    });

    test('fromWire throws ArgumentError for unknown value', () {
      expect(() => BundleAccent.fromWire('neon'), throwsA(isA<ArgumentError>()));
    });

    test('Bundle.fromJson throws when accent is absent', () {
      final json = <String, Object?>{
        'id': 1,
        'name': 'test',
        'description': null,
        'icon': null,
        'archived_at': null,
        'created_via': null,
        'created_by': 'user@example.com',
        'created_at': 1000000,
        'updated_at': 1000000,
      };
      expect(() => Bundle.fromJson(json), throwsA(isA<TypeError>()));
    });
  });

  // ---- 33. TimelineRange enum ----

  group('TimelineRange enum', () {
    test('wireValue round-trips for every member', () {
      expect(TimelineRange.last24h.wireValue, '24h');
      expect(TimelineRange.last7d.wireValue, '7d');
      expect(TimelineRange.last30d.wireValue, '30d');
      expect(TimelineRange.last90d.wireValue, '90d');
      expect(TimelineRange.last1y.wireValue, '1y');
      expect(TimelineRange.all.wireValue, 'all');
    });

    test('fromWire parses known values', () {
      expect(TimelineRange.fromWire('7d'), TimelineRange.last7d);
      expect(TimelineRange.fromWire('all'), TimelineRange.all);
    });

    test('fromWire throws ArgumentError for unknown value', () {
      expect(
        () => TimelineRange.fromWire('forever'),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  // ---- 34. BundleArchivedFilter enum ----

  group('BundleArchivedFilter enum', () {
    test('wireValue maps to correct strings', () {
      expect(BundleArchivedFilter.trueValue.wireValue, 'true');
      expect(BundleArchivedFilter.activeOnly.wireValue, 'only');
      expect(BundleArchivedFilter.all.wireValue, 'all');
    });

    test('fromWire parses known values', () {
      expect(BundleArchivedFilter.fromWire('only'), BundleArchivedFilter.activeOnly);
      expect(BundleArchivedFilter.fromWire('all'), BundleArchivedFilter.all);
    });

    test('fromWire throws ArgumentError for unknown value', () {
      expect(
        () => BundleArchivedFilter.fromWire('1'),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
