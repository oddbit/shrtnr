// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:meta/meta.dart';

/// Converts a nullable Unix-seconds timestamp from a JSON field to a UTC
/// [DateTime], or `null` if the field is absent or null.
DateTime? _dateFromSeconds(Object? value) {
  if (value == null) return null;
  final seconds = (value as num).toInt();
  return DateTime.fromMillisecondsSinceEpoch(seconds * 1000, isUtc: true);
}

/// Converts a UTC [DateTime] back to Unix seconds for JSON encoding.
int? _dateToSeconds(DateTime? value) {
  if (value == null) return null;
  return value.toUtc().millisecondsSinceEpoch ~/ 1000;
}

/// A short URL slug attached to a [Link]. Each link can have one or more
/// slugs (one primary, plus optional custom slugs).
@immutable
class Slug {
  /// Creates a slug directly. Most callers should rely on [Slug.fromJson].
  const Slug({
    required this.linkId,
    required this.slug,
    required this.isCustom,
    required this.isPrimary,
    required this.disabledAt,
    required this.clickCount,
    required this.createdAt,
  });

  /// Parses a slug from its JSON representation.
  factory Slug.fromJson(Map<String, dynamic> json) => Slug(
        linkId: (json['link_id'] as num).toInt(),
        slug: json['slug'] as String,
        isCustom: ((json['is_custom'] as num?) ?? 0).toInt() == 1,
        isPrimary: ((json['is_primary'] as num?) ?? 0).toInt() == 1,
        disabledAt: _dateFromSeconds(json['disabled_at']),
        clickCount: ((json['click_count'] as num?) ?? 0).toInt(),
        createdAt: _dateFromSeconds(json['created_at']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      );

  /// ID of the parent link.
  final int linkId;

  /// The short path (for example `a3x` or `my-campaign`).
  final String slug;

  /// Whether this slug was provided by a caller rather than auto-generated.
  final bool isCustom;

  /// Whether this is the primary slug for the parent link.
  final bool isPrimary;

  /// When the slug was disabled, or `null` if active.
  final DateTime? disabledAt;

  /// Number of clicks recorded against this slug.
  final int clickCount;

  /// When the slug was created (UTC).
  final DateTime createdAt;
}

/// A short link resource.
@immutable
class Link {
  /// Creates a link directly. Most callers should rely on [Link.fromJson].
  const Link({
    required this.id,
    required this.url,
    required this.label,
    required this.createdAt,
    required this.expiresAt,
    required this.createdVia,
    required this.createdBy,
    required this.slugs,
    required this.totalClicks,
  });

  /// Parses a link from its JSON representation.
  factory Link.fromJson(Map<String, dynamic> json) => Link(
        id: (json['id'] as num).toInt(),
        url: json['url'] as String,
        label: json['label'] as String?,
        createdAt: _dateFromSeconds(json['created_at']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        expiresAt: _dateFromSeconds(json['expires_at']),
        createdVia: json['created_via'] as String?,
        createdBy: (json['created_by'] as String?) ?? '',
        slugs: ((json['slugs'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic s) => Slug.fromJson(s as Map<String, dynamic>))
            .toList(growable: false),
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
      );

  /// Unique link ID.
  final int id;

  /// Target URL.
  final String url;

  /// Optional human-readable label.
  final String? label;

  /// When the link was created (UTC).
  final DateTime createdAt;

  /// When the link expires, or `null` if it never does.
  final DateTime? expiresAt;

  /// How the link was created (for example `sdk`, `api`, `ui`). May be
  /// `null` for legacy links.
  final String? createdVia;

  /// Identity (typically an email) of the creator.
  final String createdBy;

  /// Slugs attached to the link.
  final List<Slug> slugs;

  /// Total clicks across every slug on this link.
  final int totalClicks;
}

/// A named bucket with a click count. Used in analytics breakdowns.
@immutable
class NameCount {
  /// Creates a name/count pair.
  const NameCount({required this.name, required this.count});

  /// Parses from JSON.
  factory NameCount.fromJson(Map<String, dynamic> json) => NameCount(
        name: (json['name'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// The bucket name (for example a country code or browser name).
  final String name;

  /// The click count in this bucket.
  final int count;
}

/// A date/count pair used in click timelines.
@immutable
class DateCount {
  /// Creates a date/count pair.
  const DateCount({required this.date, required this.count});

  /// Parses from JSON.
  factory DateCount.fromJson(Map<String, dynamic> json) => DateCount(
        date: (json['date'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// The bucket date as a string (for example `2026-04-21`).
  final String date;

  /// The click count on that date.
  final int count;
}

/// A slug/count pair used in per-slug analytics breakdowns.
@immutable
class SlugCount {
  /// Creates a slug/count pair.
  const SlugCount({required this.slug, required this.count});

  /// Parses from JSON.
  factory SlugCount.fromJson(Map<String, dynamic> json) => SlugCount(
        slug: (json['slug'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// The slug identifier.
  final String slug;

  /// The click count for this slug.
  final int count;
}

/// Click analytics for a link.
@immutable
class ClickStats {
  /// Creates click stats directly. Most callers should rely on
  /// [ClickStats.fromJson].
  const ClickStats({
    required this.totalClicks,
    required this.countries,
    required this.referrers,
    required this.referrerHosts,
    required this.devices,
    required this.os,
    required this.browsers,
    required this.linkModes,
    required this.channels,
    required this.clicksOverTime,
    required this.slugClicks,
  });

  /// Parses click stats from JSON.
  factory ClickStats.fromJson(Map<String, dynamic> json) => ClickStats(
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
        countries: _nameCounts(json['countries']),
        referrers: _nameCounts(json['referrers']),
        referrerHosts: _nameCounts(json['referrer_hosts']),
        devices: _nameCounts(json['devices']),
        os: _nameCounts(json['os']),
        browsers: _nameCounts(json['browsers']),
        linkModes: _nameCounts(json['link_modes']),
        channels: _nameCounts(json['channels']),
        clicksOverTime: ((json['clicks_over_time'] as List<dynamic>?) ??
                const <dynamic>[])
            .map((dynamic e) => DateCount.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        slugClicks:
            ((json['slug_clicks'] as List<dynamic>?) ?? const <dynamic>[])
                .map(
                    (dynamic e) => SlugCount.fromJson(e as Map<String, dynamic>))
                .toList(growable: false),
      );

  static List<NameCount> _nameCounts(Object? raw) =>
      ((raw as List<dynamic>?) ?? const <dynamic>[])
          .map((dynamic e) => NameCount.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);

  /// Sum of clicks across every slug on the link.
  final int totalClicks;

  /// Clicks grouped by country (typically ISO 3166-1 alpha-2 codes).
  final List<NameCount> countries;

  /// Clicks grouped by full HTTP Referer value.
  final List<NameCount> referrers;

  /// Clicks grouped by referrer host only.
  final List<NameCount> referrerHosts;

  /// Clicks grouped by device type (mobile, desktop, tablet, ...).
  final List<NameCount> devices;

  /// Clicks grouped by operating system.
  final List<NameCount> os;

  /// Clicks grouped by browser.
  final List<NameCount> browsers;

  /// Clicks grouped by link access mode.
  final List<NameCount> linkModes;

  /// Clicks grouped by traffic channel.
  final List<NameCount> channels;

  /// Click timeline, one entry per date bucket.
  final List<DateCount> clicksOverTime;

  /// Per-slug click counts.
  final List<SlugCount> slugClicks;
}

/// Service health response.
@immutable
class HealthStatus {
  /// Creates a health status directly.
  const HealthStatus({
    required this.status,
    required this.version,
    required this.timestamp,
  });

  /// Parses a health status from JSON.
  factory HealthStatus.fromJson(Map<String, dynamic> json) => HealthStatus(
        status: json['status'] as String,
        version: json['version'] as String,
        timestamp: _dateFromSeconds(json['timestamp']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      );

  /// Service status string (for example `ok`).
  final String status;

  /// Service version (for example `0.29.1`).
  final String version;

  /// Server time at the moment the response was produced (UTC).
  final DateTime timestamp;
}

/// Options for [ShrtnrClient.createLink].
@immutable
class CreateLinkOptions {
  /// Creates a new-link payload.
  const CreateLinkOptions({
    required this.url,
    this.label,
    this.slugLength,
    this.expiresAt,
  });

  /// Target URL to shorten. Required.
  final String url;

  /// Optional human-readable label.
  final String? label;

  /// Optional desired length of the generated slug.
  final int? slugLength;

  /// Optional expiry timestamp (UTC).
  final DateTime? expiresAt;

  /// JSON body for the create-link request.
  Map<String, dynamic> toJson() => <String, dynamic>{
        'url': url,
        if (label != null) 'label': label,
        if (slugLength != null) 'slug_length': slugLength,
        if (expiresAt != null) 'expires_at': _dateToSeconds(expiresAt),
      };
}

/// Options for [ShrtnrClient.updateLink]. All fields are optional. Pass a
/// null [label] or [expiresAt] to clear the current value on the server.
@immutable
class UpdateLinkOptions {
  /// Creates an update payload.
  const UpdateLinkOptions({
    this.url,
    this.label,
    this.clearLabel = false,
    this.expiresAt,
    this.clearExpiresAt = false,
  });

  /// New target URL, or `null` to leave unchanged.
  final String? url;

  /// New label value. Combined with [clearLabel] to distinguish between
  /// "leave unchanged" and "clear the label".
  final String? label;

  /// If true, serializes `"label": null` to clear the label on the server.
  final bool clearLabel;

  /// New expiry, or `null` to leave unchanged.
  final DateTime? expiresAt;

  /// If true, serializes `"expires_at": null` to clear the expiry.
  final bool clearExpiresAt;

  /// JSON body for the update-link request.
  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{};
    if (url != null) body['url'] = url;
    if (clearLabel) {
      body['label'] = null;
    } else if (label != null) {
      body['label'] = label;
    }
    if (clearExpiresAt) {
      body['expires_at'] = null;
    } else if (expiresAt != null) {
      body['expires_at'] = _dateToSeconds(expiresAt);
    }
    return body;
  }
}
