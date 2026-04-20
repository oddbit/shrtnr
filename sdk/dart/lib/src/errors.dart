// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/// Thrown by [ShrtnrClient] when the API returns a non-2xx response.
///
/// Mirrors the `ShrtnrError` class from the TypeScript SDK. Named
/// `ShrtnrException` here to follow Dart's convention of using `Exception`
/// (not `Error`) for runtime failures from external systems.
class ShrtnrException implements Exception {
  /// Creates an exception from an HTTP status and optional parsed body.
  ShrtnrException(this.statusCode, this.body)
      : message = _extractMessage(statusCode, body);

  /// HTTP status code from the failing response.
  final int statusCode;

  /// Parsed JSON body of the error response, or `null` if the body was not
  /// JSON or was empty.
  final Object? body;

  /// Human-readable error message. Derived from the response body's `error`
  /// field if present, otherwise falls back to `HTTP <status>`.
  final String message;

  static String _extractMessage(int status, Object? body) {
    if (body is Map && body['error'] is String) {
      return body['error'] as String;
    }
    return 'HTTP $status';
  }

  @override
  String toString() => 'ShrtnrException($statusCode): $message';
}
