// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import '../base_client.dart';
import '../models.dart';

/// Methods for slug lookup and management endpoints.
class SlugsResource {
  /// Creates a slugs resource backed by [_http].
  SlugsResource(this._http);

  final ShrtnrBaseClient _http;

  /// Look up a link by its slug.
  Future<Link> lookup(String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await _http.requestJson('GET', '/_/api/slugs/$encoded');
    return Link.fromJson(json! as Map<String, dynamic>);
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
    final encoded = Uri.encodeComponent(slug);
    final json = await _http.requestJson(
      'POST',
      '/_/api/links/$linkId/slugs/$encoded/disable',
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Re-enable a disabled slug on a link.
  Future<Slug> enable(int linkId, String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await _http.requestJson(
      'POST',
      '/_/api/links/$linkId/slugs/$encoded/enable',
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Remove a custom slug from a link.
  Future<RemovedResult> remove(int linkId, String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await _http.requestJson(
      'DELETE',
      '/_/api/links/$linkId/slugs/$encoded',
    );
    return RemovedResult.fromJson(json! as Map<String, dynamic>);
  }
}
