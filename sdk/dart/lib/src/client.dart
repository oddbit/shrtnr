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

  /// Reads click analytics for a link.
  Future<ClickStats> getLinkAnalytics(int linkId) async {
    final json = await requestJson('GET', '/_/api/links/$linkId/analytics');
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
}

/// Re-export so consumers can construct clients without importing the http
/// package directly for type references.
typedef ShrtnrHttpClient = http.Client;
