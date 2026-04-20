// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth.dart';
import 'errors.dart';

/// Low-level HTTP transport used by [ShrtnrClient]. Handles base URL
/// normalization, auth headers, and error mapping from non-2xx responses to
/// [ShrtnrException].
///
/// Not intended for direct use. Create a [ShrtnrClient] instead.
class ShrtnrBaseClient {
  /// Creates a base client.
  ///
  /// - [baseUrl]: the root URL of the shrtnr instance. Trailing slashes are
  ///   stripped.
  /// - [auth]: the authentication strategy.
  /// - [httpClient]: optional injected `http.Client`. Useful for tests; if
  ///   omitted a new `http.Client` is created and owned by this instance.
  ShrtnrBaseClient({
    required String baseUrl,
    required ShrtnrAuth auth,
    http.Client? httpClient,
  })  : _baseUrl = _stripTrailingSlashes(baseUrl),
        _httpClient = httpClient ?? http.Client(),
        _headers = _buildHeaders(auth);

  final String _baseUrl;
  final http.Client _httpClient;
  final Map<String, String> _headers;

  static String _stripTrailingSlashes(String url) {
    var out = url;
    while (out.endsWith('/')) {
      out = out.substring(0, out.length - 1);
    }
    return out;
  }

  static Map<String, String> _buildHeaders(ShrtnrAuth auth) {
    return switch (auth) {
      ApiKeyAuth(:final apiKey) => <String, String>{
          'Authorization': 'Bearer $apiKey',
          'X-Client': 'sdk',
        },
    };
  }

  /// Issues an HTTP request and returns the parsed JSON body.
  ///
  /// Throws [ShrtnrException] for non-2xx responses. Returns `null` for 204
  /// No Content.
  Future<Object?> requestJson(
    String method,
    String path, {
    Object? body,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = <String, String>{..._headers};
    final bodyBytes = body == null ? null : utf8.encode(jsonEncode(body));
    if (bodyBytes != null) {
      headers['Content-Type'] = 'application/json';
    }

    final request = http.Request(method, uri)..headers.addAll(headers);
    if (bodyBytes != null) request.bodyBytes = bodyBytes;

    final streamed = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == 204 || response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }

    Object? parsed;
    try {
      parsed = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      parsed = null;
    }
    throw ShrtnrException(response.statusCode, parsed);
  }

  /// Issues a GET request and returns the raw response body as text.
  /// Used for endpoints that return non-JSON payloads (for example SVG).
  Future<String> requestText(String method, String path) async {
    final uri = Uri.parse('$_baseUrl$path');
    final request = http.Request(method, uri)..headers.addAll(_headers);
    final streamed = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body;
    }

    Object? parsed;
    try {
      parsed = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      parsed = null;
    }
    throw ShrtnrException(response.statusCode, parsed);
  }

  /// Releases the underlying `http.Client`. Safe to call multiple times.
  void close() => _httpClient.close();
}
