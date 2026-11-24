// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import '../base_client.dart';
import '../errors.dart';
import '../models.dart';

/// A slug as one URL path segment.
///
/// Percent-encoding keeps a slug with reserved characters inside its segment,
/// but it leaves "." untouched, and the URI parser collapses a "." or ".."
/// segment before the request is sent: `/links/5/slugs/../disable` becomes
/// `/links/5/disable`, which disables the whole link. An empty slug drops the
/// segment the same way. None of the three can name a slug, so they throw the
/// 404 the server answers for any slug that fails its path pattern, without a
/// request.
String _slugSegment(String slug) {
  if (slug.isEmpty || slug == '.' || slug == '..') {
    throw ShrtnrError(404, 'Slug not found: "$slug" is not a valid slug');
  }
  return Uri.encodeComponent(slug);
}

/// Methods for slug lookup and management endpoints.
class SlugsResource {
  /// Creates a slugs resource backed by [_http].
  SlugsResource(this._http);

  final ShrtnrBaseClient _http;

  /// Look up a link by its slug.
  Future<Link> lookup(String slug) async {
    final encoded = _slugSegment(slug);
    return _http.requestLink('GET', '/_/api/slugs/$encoded');
  }

  /// Add a custom slug to a link.
  Future<Slug> add(int linkId, String slug) async {
    final json = await _http.requestJson(
      'POST',
      '/_/api/links/$linkId/slugs',
      body: <String, dynamic>{'slug': slug},
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Disable a specific slug on a link.
  Future<Slug> disable(int linkId, String slug) async {
    final encoded = _slugSegment(slug);
    final json = await _http.requestJson(
      'POST',
      '/_/api/links/$linkId/slugs/$encoded/disable',
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Re-enable a disabled slug on a link.
  Future<Slug> enable(int linkId, String slug) async {
    final encoded = _slugSegment(slug);
    final json = await _http.requestJson(
      'POST',
      '/_/api/links/$linkId/slugs/$encoded/enable',
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Remove a custom slug from a link.
  Future<RemovedResult> remove(int linkId, String slug) async {
    final encoded = _slugSegment(slug);
    final json = await _http.requestJson(
      'DELETE',
      '/_/api/links/$linkId/slugs/$encoded',
    );
    return RemovedResult.fromJson(json! as Map<String, dynamic>);
  }
}
