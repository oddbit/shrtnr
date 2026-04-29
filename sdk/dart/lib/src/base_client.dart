// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'errors.dart';

/// Low-level HTTP transport used by [ShrtnrClient].
///
/// Handles base URL normalization, auth header injection, query-string
/// building, JSON parsing, and error mapping. Not intended for direct use.
class ShrtnrBaseClient {
  ShrtnrBaseClient({
    required String baseUrl,
    required String apiKey,
    http.Client? httpClient,
  })  : _baseUrl = _stripTrailing(baseUrl),
        _authHeader = 'Bearer $apiKey',
        _httpClient = httpClient ?? http.Client(),
        _owned = httpClient == null;

  final String _baseUrl;
  final String _authHeader;
  final http.Client _httpClient;
  // True when we created the client ourselves and must close it.
  final bool _owned;

  static String _stripTrailing(String url) {
    var out = url;
    while (out.endsWith('/')) {
      out = out.substring(0, out.length - 1);
    }
    return out;
  }

  /// Issues an HTTP request and returns the parsed JSON body.
  ///
  /// Throws [ShrtnrError] for non-2xx responses or network failures.
  Future<Object?> requestJson(
    String method,
    String path, {
    Map<String, String?>? query,
    Object? body,
  }) async {
    final uri = _buildUri(path, query);
    final headers = <String, String>{'Authorization': _authHeader};
    List<int>? bodyBytes;
    if (body != null) {
      bodyBytes = utf8.encode(jsonEncode(body));
      headers['Content-Type'] = 'application/json';
    }

    final request = http.Request(method, uri)..headers.addAll(headers);
    if (bodyBytes != null) request.bodyBytes = bodyBytes;

    http.StreamedResponse streamed;
    try {
      streamed = await _httpClient.send(request);
    } catch (e) {
      throw ShrtnrError(0, e.toString());
    }

    final response = await http.Response.fromStream(streamed);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == 204 || response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }

    String serverMessage = 'HTTP ${response.statusCode}';
    try {
      if (response.body.isNotEmpty) {
        final parsed = jsonDecode(response.body);
        if (parsed is Map && parsed['error'] is String) {
          serverMessage = parsed['error'] as String;
        }
      }
    } catch (_) {
      // Use the default message derived from status code.
    }
    throw ShrtnrError(response.statusCode, serverMessage);
  }

  /// Issues a request and returns the raw response body as text.
  ///
  /// Used for endpoints that return non-JSON payloads, for example SVG.
  Future<String> requestText(
    String method,
    String path, {
    Map<String, String?>? query,
  }) async {
    final uri = _buildUri(path, query);
    final headers = <String, String>{'Authorization': _authHeader};
    final request = http.Request(method, uri)..headers.addAll(headers);

    http.StreamedResponse streamed;
    try {
      streamed = await _httpClient.send(request);
    } catch (e) {
      throw ShrtnrError(0, e.toString());
    }

    final response = await http.Response.fromStream(streamed);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body;
    }

    String serverMessage = 'HTTP ${response.statusCode}';
    try {
      if (response.body.isNotEmpty) {
        final parsed = jsonDecode(response.body);
        if (parsed is Map && parsed['error'] is String) {
          serverMessage = parsed['error'] as String;
        }
      }
    } catch (_) {
      // Use the default message.
    }
    throw ShrtnrError(response.statusCode, serverMessage);
  }

  Uri _buildUri(String path, Map<String, String?>? query) {
    final base = '$_baseUrl$path';
    if (query == null || query.isEmpty) return Uri.parse(base);
    final params = <String, String>{};
    query.forEach((k, v) {
      if (v != null) params[k] = v;
    });
    if (params.isEmpty) return Uri.parse(base);
    final qs = params.entries
        .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    return Uri.parse('$base?$qs');
  }

  /// Closes the underlying HTTP client. Safe to call multiple times, but only
  /// closes when this instance owns the client (i.e., no external client was
  /// injected via the constructor).
  void close() {
    if (_owned) _httpClient.close();
  }
}
