// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'errors.dart';

/// Value of the `X-Client` header sent on every request.
///
/// The API reads it to record how a link or bundle was created: `sdk` when
/// the header is present, `api` otherwise (`src/api/links.ts`,
/// `src/api/bundles.ts`).
const _clientHeader = 'sdk';

/// The JSON container a resource method can consume: a single resource
/// ([object]) or a list to map over ([list]). The transport cannot infer it
/// from the response, so each call names it.
enum JsonShape {
  /// A single resource: the body must decode to a Map.
  object,

  /// A list of resources: the body must decode to a List.
  list,
}

/// Low-level HTTP transport used by [ShrtnrClient].
///
/// Handles base URL normalization, auth header injection, query-string
/// building, JSON parsing, and error mapping. Not intended for direct use.
class ShrtnrBaseClient {
  /// Creates a base client.
  ///
  /// - [baseUrl]: root URL; trailing slashes are stripped.
  /// - [apiKey]: sent as `Authorization: Bearer <apiKey>`.
  /// - [httpClient]: optional injected client; if omitted one is created and
  ///   owned by this instance.
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
    JsonShape shape = JsonShape.object,
  }) async {
    final uri = _buildUri(path, query);
    final headers = <String, String>{
      'Authorization': _authHeader,
      'X-Client': _clientHeader,
    };
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

    // send() only yields headers/status; the body is read lazily here, so a
    // connection drop mid-transfer surfaces as a raw stream error at this
    // call, not at send() above. Wrap it too, or it escapes the documented
    // "network failures throw ShrtnrError(status: 0)" guarantee.
    http.Response response;
    try {
      response = await http.Response.fromStream(streamed);
    } catch (e) {
      throw ShrtnrError(0, e.toString());
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      // Every JSON call feeds a model or a list, so no caller can consume a
      // 204: it is a body of the wrong shape like any other empty body. The
      // transport used to return null for it ahead of the shape check
      // below, which the resource method's `json! as List` reported as a
      // null-check error instead of the documented ShrtnrError. A stripped
      // body on a 200 (a CDN or proxy that drops the body off some 2xx
      // responses) lands here for the same reason.
      if (response.body.isEmpty) {
        throw ShrtnrError(response.statusCode, 'Empty response body');
      }
      dynamic decoded;
      try {
        decoded = jsonDecode(response.body);
      } catch (e) {
        throw ShrtnrError(response.statusCode, 'Invalid JSON response: $e');
      }
      // A body that is valid JSON but of the wrong container type (a bare
      // scalar such as null, a number, a string or a bool; a List where a
      // single resource is expected; a Map where a list is expected) passes
      // the decode above unchanged. Left alone it reached the resource
      // method's `json! as Map<String, dynamic>` or `as List<dynamic>` and
      // failed as a raw type error instead of the documented ShrtnrError.
      if (shape == JsonShape.list) {
        if (decoded is! List) {
          throw ShrtnrError(
            response.statusCode,
            'Response body is not a JSON array',
          );
        }
      } else if (decoded is! Map) {
        throw ShrtnrError(
          response.statusCode,
          'Response body is not a JSON object',
        );
      }
      return decoded;
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
    final headers = <String, String>{
      'Authorization': _authHeader,
      'X-Client': _clientHeader,
    };
    final request = http.Request(method, uri)..headers.addAll(headers);

    http.StreamedResponse streamed;
    try {
      streamed = await _httpClient.send(request);
    } catch (e) {
      throw ShrtnrError(0, e.toString());
    }

    http.Response response;
    try {
      response = await http.Response.fromStream(streamed);
    } catch (e) {
      throw ShrtnrError(0, e.toString());
    }

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

  // Uri.parse throws FormatException on a malformed base URL (a bad port,
  // a bad IDNA host), synchronously and before any I/O. Both request paths
  // build their URI before entering the try that wraps send(), so the raw
  // exception escaped the "network failures throw ShrtnrError with
  // status: 0" guarantee in README.md. Wrapping here rather than at each
  // call site covers both paths, and any later one, from one place.
  Uri _buildUri(String path, Map<String, String?>? query) {
    try {
      return _parseUri(path, query);
    } on FormatException catch (e) {
      throw ShrtnrError(0, e.toString());
    }
  }

  Uri _parseUri(String path, Map<String, String?>? query) {
    final base = '$_baseUrl$path';
    if (query == null || query.isEmpty) return Uri.parse(base);
    final params = <String, String>{};
    query.forEach((k, v) {
      if (v != null) params[k] = v;
    });
    if (params.isEmpty) return Uri.parse(base);
    final qs = params.entries
        .map((e) =>
            '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
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
