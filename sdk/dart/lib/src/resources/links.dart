// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import '../base_client.dart';
import '../models.dart';

// Sentinel distinguishing "not provided" from an explicit null.
const Object _unset = Object();

/// Methods for the `/api/links` and related endpoints.
class LinksResource {
  /// Creates a links resource backed by [_http].
  LinksResource(this._http);

  final ShrtnrBaseClient _http;

  /// Get a link by ID. Optional [range] scopes the click count to a time window.
  Future<Link> get(int id, {TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/links/$id',
      query: {'range': range?.wireValue},
    );
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// List all links. Filter by [owner] identity or click-count [range].
  Future<List<Link>> list({String? owner, TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/links',
      query: {'owner': owner, 'range': range?.wireValue},
    );
    return (json! as List<dynamic>)
        .map((dynamic e) => Link.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Create a new short link.
  Future<Link> create({
    required String url,
    String? label,
    int? slugLength,
    int? expiresAt,
    bool? allowDuplicate,
  }) async {
    final body = <String, dynamic>{'url': url};
    if (label != null) body['label'] = label;
    if (slugLength != null) body['slug_length'] = slugLength;
    if (expiresAt != null) body['expires_at'] = expiresAt;
    if (allowDuplicate != null) body['allow_duplicate'] = allowDuplicate;
    final json = await _http.requestJson('POST', '/_/api/links', body: body);
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Update a link's URL, label, or expiry.
  ///
  /// Pass `null` for [label] or [expiresAt] to clear the field.
  /// Omitting a parameter leaves the field unchanged.
  Future<Link> update(
    int id, {
    String? url,
    Object? label = _unset,
    Object? expiresAt = _unset,
  }) async {
    final body = <String, dynamic>{};
    if (url != null) body['url'] = url;
    if (!identical(label, _unset)) body['label'] = label;
    if (!identical(expiresAt, _unset)) body['expires_at'] = expiresAt;
    final json = await _http.requestJson('PUT', '/_/api/links/$id', body: body);
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Disable a link so it stops redirecting.
  Future<Link> disable(int id) async {
    final json = await _http.requestJson('POST', '/_/api/links/$id/disable');
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Re-enable a disabled link.
  Future<Link> enable(int id) async {
    final json = await _http.requestJson('POST', '/_/api/links/$id/enable');
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Permanently delete a link.
  Future<DeletedResult> delete(int id) async {
    final json = await _http.requestJson('DELETE', '/_/api/links/$id');
    return DeletedResult.fromJson(json! as Map<String, dynamic>);
  }

  /// Get click analytics for a link. Optional [range] scopes the window.
  Future<ClickStats> analytics(int id, {TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/links/$id/analytics',
      query: {'range': range?.wireValue},
    );
    return ClickStats.fromJson(json! as Map<String, dynamic>);
  }

  /// Get click timeline for a link. Optional [range] scopes the window.
  Future<TimelineData> timeline(int id, {TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/links/$id/timeline',
      query: {'range': range?.wireValue},
    );
    return TimelineData.fromJson(json! as Map<String, dynamic>);
  }

  /// Get QR code SVG for a link. Returns the SVG string.
  ///
  /// [slug] pins the QR to a specific slug; defaults to the primary slug.
  /// [size] sets the pixel dimension (square).
  Future<String> qr(int id, {String? slug, int? size}) async {
    return _http.requestText(
      'GET',
      '/_/api/links/$id/qr',
      query: {
        'slug': slug,
        'size': size?.toString(),
      },
    );
  }

  /// List bundles that contain this link.
  Future<List<Bundle>> bundles(int id) async {
    final json = await _http.requestJson('GET', '/_/api/links/$id/bundles');
    return (json! as List<dynamic>)
        .map((dynamic e) => Bundle.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }
}
