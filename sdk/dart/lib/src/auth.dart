// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:meta/meta.dart';

/// Authentication strategy used by [ShrtnrClient].
///
/// Currently only [ApiKeyAuth] is supported. The sealed hierarchy leaves room
/// for future strategies (for example OAuth access tokens) without breaking
/// existing callers.
@immutable
sealed class ShrtnrAuth {
  const ShrtnrAuth();
}

/// API key authentication. The key is sent as a Bearer token in the
/// `Authorization` header.
@immutable
class ApiKeyAuth extends ShrtnrAuth {
  /// Creates an API key auth strategy.
  const ApiKeyAuth({required this.apiKey});

  /// The raw API key, sent as `Authorization: Bearer <apiKey>`.
  final String apiKey;
}
