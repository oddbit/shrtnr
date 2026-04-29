// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import '../base_client.dart';
import '../models.dart';

/// Methods for the `/api/bundles` and related endpoints.
class BundlesResource {
  /// Creates a bundles resource backed by [_http].
  BundlesResource(this._http);

  final ShrtnrBaseClient _http;

  /// Get a bundle by ID with aggregated click summary.
  /// Optional [range] scopes the click window.
  Future<BundleWithSummary> get(int id, {String? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles/$id',
      query: {'range': range},
    );
    return BundleWithSummary.fromJson(json! as Map<String, dynamic>);
  }

  /// List bundles. Use [archived] to filter archived status
  /// (`'1'`, `'true'`, `'only'`, `'all'`). Optional [range] scopes click counts.
  Future<List<BundleWithSummary>> list({String? archived, String? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles',
      query: {'archived': archived, 'range': range},
    );
    return (json! as List<dynamic>)
        .map((dynamic e) =>
            BundleWithSummary.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Create a new bundle.
  Future<Bundle> create({
    required String name,
    String? description,
    String? icon,
    String? accent,
  }) async {
    final body = <String, dynamic>{'name': name};
    if (description != null) body['description'] = description;
    if (icon != null) body['icon'] = icon;
    if (accent != null) body['accent'] = accent;
    final json = await _http.requestJson('POST', '/_/api/bundles', body: body);
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Update a bundle's name, description, icon, or accent.
  Future<Bundle> update(
    int id, {
    String? name,
    String? description,
    String? icon,
    String? accent,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (description != null) body['description'] = description;
    if (icon != null) body['icon'] = icon;
    if (accent != null) body['accent'] = accent;
    final json =
        await _http.requestJson('PUT', '/_/api/bundles/$id', body: body);
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Permanently delete a bundle. Member links are preserved.
  Future<DeletedResult> delete(int id) async {
    final json = await _http.requestJson('DELETE', '/_/api/bundles/$id');
    return DeletedResult.fromJson(json! as Map<String, dynamic>);
  }

  /// Archive a bundle. It stays in the database but is hidden from the
  /// default listing.
  Future<Bundle> archive(int id) async {
    final json = await _http.requestJson('POST', '/_/api/bundles/$id/archive');
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Restore a previously archived bundle.
  Future<Bundle> unarchive(int id) async {
    final json =
        await _http.requestJson('POST', '/_/api/bundles/$id/unarchive');
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Get combined click analytics for a bundle. Optional [range] scopes the window.
  Future<ClickStats> analytics(int id, {String? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles/$id/analytics',
      query: {'range': range},
    );
    return ClickStats.fromJson(json! as Map<String, dynamic>);
  }

  /// List links in a bundle.
  Future<List<Link>> links(int id) async {
    final json = await _http.requestJson('GET', '/_/api/bundles/$id/links');
    return (json! as List<dynamic>)
        .map((dynamic e) => Link.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Add a link to a bundle. Idempotent.
  Future<AddedResult> addLink(int id, int linkId) async {
    final json = await _http.requestJson(
      'POST',
      '/_/api/bundles/$id/links',
      body: <String, dynamic>{'link_id': linkId},
    );
    return AddedResult.fromJson(json! as Map<String, dynamic>);
  }

  /// Remove a link from a bundle. The link itself is not deleted.
  Future<RemovedResult> removeLink(int id, int linkId) async {
    final json =
        await _http.requestJson('DELETE', '/_/api/bundles/$id/links/$linkId');
    return RemovedResult.fromJson(json! as Map<String, dynamic>);
  }
}
