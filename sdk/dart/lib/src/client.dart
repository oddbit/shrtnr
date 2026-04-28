// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:http/http.dart' as http;

import 'auth.dart';
import 'base_client.dart';
import 'models.dart';

/// High-level client for the shrtnr URL shortener API.
///
/// Mirrors the public surface of the TypeScript `@oddbit/shrtnr` SDK. All
/// methods return a `Future` and throw [ShrtnrException] on non-2xx
/// responses.
class ShrtnrClient extends ShrtnrBaseClient {
  /// Creates a client.
  ///
  /// - [baseUrl]: root URL of the shrtnr instance, for example
  ///   `https://oddb.it`.
  /// - [auth]: authentication strategy, typically [ApiKeyAuth].
  /// - [httpClient]: optional injected `http.Client` (useful for testing).
  ShrtnrClient({
    required super.baseUrl,
    required super.auth,
    super.httpClient,
  });

  // ---- Service ----

  /// Checks service health and returns version information.
  Future<HealthStatus> health() async {
    final json = await requestJson('GET', '/_/health');
    return HealthStatus.fromJson(json! as Map<String, dynamic>);
  }

  // ---- Links ----

  /// Creates a new short link with an auto-generated slug.
  Future<Link> createLink(CreateLinkOptions options) async {
    final json = await requestJson(
      'POST',
      '/_/api/links',
      body: options.toJson(),
    );
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Lists every link visible to the current API key.
  Future<List<Link>> listLinks() async {
    final json = await requestJson('GET', '/_/api/links');
    return (json! as List<dynamic>)
        .map((dynamic e) => Link.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Returns a single link by ID.
  Future<Link> getLink(int id) async {
    final json = await requestJson('GET', '/_/api/links/$id');
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Updates a link's URL, label, or expiry.
  Future<Link> updateLink(int id, UpdateLinkOptions options) async {
    final json = await requestJson(
      'PUT',
      '/_/api/links/$id',
      body: options.toJson(),
    );
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Disables a link so it stops redirecting.
  Future<Link> disableLink(int id) async {
    final json = await requestJson('POST', '/_/api/links/$id/disable');
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Re-enables a previously disabled link.
  Future<Link> enableLink(int id) async {
    final json = await requestJson('POST', '/_/api/links/$id/enable');
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  /// Permanently deletes a link. Returns `true` on success.
  Future<bool> deleteLink(int id) async {
    final json = await requestJson('DELETE', '/_/api/links/$id');
    if (json is Map && json['deleted'] is bool) return json['deleted'] as bool;
    return true;
  }

  /// Lists links created by the given owner identity (typically an email).
  Future<List<Link>> listLinksByOwner(String owner) async {
    final encoded = Uri.encodeComponent(owner);
    final json = await requestJson('GET', '/_/api/links?owner=$encoded');
    return (json! as List<dynamic>)
        .map((dynamic e) => Link.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  // ---- Slugs ----

  /// Adds a custom slug to an existing link.
  ///
  /// Throws [ShrtnrException] with status 409 if the slug is already taken,
  /// or 400 for an invalid format.
  Future<Slug> addCustomSlug(int linkId, String slug) async {
    final json = await requestJson(
      'POST',
      '/_/api/links/$linkId/slugs',
      body: <String, dynamic>{'slug': slug},
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Disables a custom slug without affecting the parent link.
  Future<Slug> disableSlug(int linkId, String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await requestJson(
      'POST',
      '/_/api/links/$linkId/slugs/$encoded/disable',
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Re-enables a previously disabled custom slug.
  Future<Slug> enableSlug(int linkId, String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await requestJson(
      'POST',
      '/_/api/links/$linkId/slugs/$encoded/enable',
    );
    return Slug.fromJson(json! as Map<String, dynamic>);
  }

  /// Permanently removes a custom slug. Only succeeds if the slug has zero
  /// clicks. Returns `true` on success.
  Future<bool> removeSlug(int linkId, String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await requestJson(
      'DELETE',
      '/_/api/links/$linkId/slugs/$encoded',
    );
    if (json is Map && json['removed'] is bool) return json['removed'] as bool;
    return true;
  }

  /// Looks up a link by slug (custom or primary).
  Future<Link> getLinkBySlug(String slug) async {
    final encoded = Uri.encodeComponent(slug);
    final json = await requestJson('GET', '/_/api/slugs/$encoded');
    return Link.fromJson(json! as Map<String, dynamic>);
  }

  // ---- Analytics ----

  /// Reads click analytics for a link. Defaults to all-time; pass [range] to
  /// scope to a window like `7d` or `30d`.
  Future<ClickStats> getLinkAnalytics(int linkId, {String range = 'all'}) async {
    final json = await requestJson(
      'GET',
      '/_/api/links/$linkId/analytics?range=${Uri.encodeComponent(range)}',
    );
    return ClickStats.fromJson(json! as Map<String, dynamic>);
  }

  // ---- QR ----

  /// Fetches the QR code for a link as an SVG string.
  ///
  /// If [slug] is provided, the QR encodes that specific slug rather than
  /// the primary slug.
  Future<String> getLinkQR(int linkId, {String? slug}) async {
    final qs = slug == null ? '' : '?slug=${Uri.encodeComponent(slug)}';
    return requestText('GET', '/_/api/links/$linkId/qr$qs');
  }

  // ---- Bundles ----

  /// Creates a new bundle.
  Future<Bundle> createBundle(CreateBundleOptions options) async {
    final json = await requestJson(
      'POST',
      '/_/api/bundles',
      body: options.toJson(),
    );
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Lists bundles owned by the caller with summary stats. Returns lifetime
  /// click totals plus a fixed 30d-vs-prev-30d trend and 30-day sparkline.
  ///
  /// - [archived]: when true, includes archived bundles; omit to hide them.
  Future<List<BundleWithSummary>> listBundles({bool? archived}) async {
    final params = <String>[];
    if (archived != null) {
      params.add('archived=${archived ? 'all' : 'false'}');
    }
    final qs = params.isEmpty ? '' : '?${params.join('&')}';
    final json = await requestJson('GET', '/_/api/bundles$qs');
    return (json! as List<dynamic>)
        .map((dynamic e) =>
            BundleWithSummary.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Returns a single bundle's metadata.
  Future<Bundle> getBundle(int id) async {
    final json = await requestJson('GET', '/_/api/bundles/$id');
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Updates a bundle's name, description, icon, or accent.
  Future<Bundle> updateBundle(int id, UpdateBundleOptions options) async {
    final json = await requestJson(
      'PUT',
      '/_/api/bundles/$id',
      body: options.toJson(),
    );
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Permanently deletes a bundle. Member links are preserved.
  Future<bool> deleteBundle(int id) async {
    final json = await requestJson('DELETE', '/_/api/bundles/$id');
    if (json is Map && json['deleted'] is bool) return json['deleted'] as bool;
    return true;
  }

  /// Archives a bundle. It stays in the database but is hidden from the
  /// default list.
  Future<Bundle> archiveBundle(int id) async {
    final json = await requestJson('POST', '/_/api/bundles/$id/archive');
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Restores a previously archived bundle.
  Future<Bundle> unarchiveBundle(int id) async {
    final json = await requestJson('POST', '/_/api/bundles/$id/unarchive');
    return Bundle.fromJson(json! as Map<String, dynamic>);
  }

  /// Reads combined analytics across every link in the bundle.
  Future<BundleStats> getBundleAnalytics(int id, {String range = 'all'}) async {
    final json = await requestJson(
      'GET',
      '/_/api/bundles/$id/analytics?range=${Uri.encodeComponent(range)}',
    );
    return BundleStats.fromJson(json! as Map<String, dynamic>);
  }

  /// Lists every link currently in the bundle.
  Future<List<Link>> listBundleLinks(int id) async {
    final json = await requestJson('GET', '/_/api/bundles/$id/links');
    return (json! as List<dynamic>)
        .map((dynamic e) => Link.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Adds a link to a bundle. Idempotent.
  Future<bool> addLinkToBundle(int bundleId, int linkId) async {
    final json = await requestJson(
      'POST',
      '/_/api/bundles/$bundleId/links',
      body: <String, dynamic>{'link_id': linkId},
    );
    if (json is Map && json['added'] is bool) return json['added'] as bool;
    return true;
  }

  /// Removes a link from a bundle. The link itself is not deleted.
  Future<bool> removeLinkFromBundle(int bundleId, int linkId) async {
    final json = await requestJson(
      'DELETE',
      '/_/api/bundles/$bundleId/links/$linkId',
    );
    if (json is Map && json['removed'] is bool) return json['removed'] as bool;
    return true;
  }

  /// Lists every bundle the given link belongs to.
  Future<List<Bundle>> listBundlesForLink(int linkId) async {
    final json = await requestJson('GET', '/_/api/links/$linkId/bundles');
    return (json! as List<dynamic>)
        .map((dynamic e) => Bundle.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }
}

/// Re-export so consumers can construct clients without importing the http
/// package directly for type references.
typedef ShrtnrHttpClient = http.Client;
