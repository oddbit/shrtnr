// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/// Thrown by [ShrtnrClient] when the API returns a 4xx/5xx response or when
/// a network error prevents the request from completing.
///
/// Mirrors the [ShrtnrError] class from the TypeScript and Python SDKs.
class ShrtnrError implements Exception {
  /// Creates an error from an HTTP status and a server-provided message.
  ///
  /// Use [status] 0 for network-level failures where no HTTP status exists.
  const ShrtnrError(this.status, this.serverMessage);

  /// HTTP status code from the failing response, or 0 for network errors.
  final int status;

  /// The `error` string from the JSON response body, or a fallback description
  /// for network errors and responses without a parseable body.
  final String serverMessage;

  @override
  String toString() => 'ShrtnrError(HTTP $status): $serverMessage';
}
