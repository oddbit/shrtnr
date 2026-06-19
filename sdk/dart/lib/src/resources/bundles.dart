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
  Future<BundleWithSummary> get(int id, {TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles/$id',
      query: {'range': range?.wireValue},
    );
    return BundleWithSummary.fromJson(json! as Map<String, dynamic>);
  }

  /// List bundles. Use [archived] to filter archived status.
  /// Optional [range] scopes click counts.
  Future<List<BundleWithSummary>> list(
      {BundleArchivedFilter? archived, TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles',
      query: {'archived': archived?.wireValue, 'range': range?.wireValue},
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
    BundleAccent? accent,
  }) async {
    final body = <String, dynamic>{'name': name};
    if (description != null) body['description'] = description;
    if (icon != null) body['icon'] = icon;
    if (accent != null) body['accent'] = accent.wireValue;
    final json = await _http.requestJson('POST', '/_/api/bundles', body: body);
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Update a bundle with the values held by [bundle].
  ///
  /// The writable fields ([Bundle.name], [Bundle.description], [Bundle.icon],
  /// [Bundle.accent]) are always sent on the wire; pass a [Bundle] produced
  /// by [Bundle.copyWith] with the desired changes (use `null` on a nullable
  /// field to clear it). [BundleWithSummary] is also accepted because it
  /// extends [Bundle]; only the writable fields above are put on the wire,
  /// so the summary fields never reach the server (whose update schema is
  /// strict and would reject them).
  Future<Bundle> update(Bundle bundle) async {
    final body = <String, dynamic>{
      'name': bundle.name,
      'description': bundle.description,
      'icon': bundle.icon,
      'accent': bundle.accent.wireValue,
    };
    final json =
        await _http.requestJson('PUT', '/_/api/bundles/${bundle.id}', body: body);
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
  Future<ClickStats> analytics(int id, {TimelineRange? range}) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles/$id/analytics',
      query: {'range': range?.wireValue},
    );
    return ClickStats.fromJson(json! as Map<String, dynamic>);
  }

  /// Page through a single analytics [dimension] for a bundle.
  ///
  /// [dimension] selects the breakdown (countries, referrers, or referrer
  /// hosts). Optional [range] scopes the window; [offset] and [limit] page the
  /// results. Returns the page rows plus the dimension's total bucket count.
  Future<BreakdownPage> breakdown(
    int id, {
    required BreakdownDimension dimension,
    TimelineRange? range,
    int? offset,
    int? limit,
  }) async {
    final json = await _http.requestJson(
      'GET',
      '/_/api/bundles/$id/breakdown',
      query: {
        'dimension': dimension.wireValue,
        'range': range?.wireValue,
        'offset': offset?.toString(),
        'limit': limit?.toString(),
      },
    );
    return BreakdownPage.fromJson(json! as Map<String, dynamic>);
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
