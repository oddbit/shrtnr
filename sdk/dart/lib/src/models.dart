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

/// Accent color for a bundle card. Matches the server's `accent` enum.
enum BundleAccent {
  /// Orange accent. Default when the server value is absent or unrecognized.
  orange,

  /// Red accent.
  red,

  /// Green accent.
  green,

  /// Blue accent.
  blue,

  /// Purple accent.
  purple,
}

BundleAccent _accentFromString(String? raw) {
  switch (raw) {
    case 'red':
      return BundleAccent.red;
    case 'green':
      return BundleAccent.green;
    case 'blue':
      return BundleAccent.blue;
    case 'purple':
      return BundleAccent.purple;
    case 'orange':
    default:
      return BundleAccent.orange;
  }
}

String _accentToString(BundleAccent a) => a.name;

/// A collection of links grouped to show combined engagement.
@immutable
class Bundle {
  /// Creates a bundle directly. Most callers should rely on [Bundle.fromJson].
  const Bundle({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.accent,
    required this.archivedAt,
    required this.createdVia,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Parses a bundle from its JSON representation.
  factory Bundle.fromJson(Map<String, dynamic> json) => Bundle(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
        description: json['description'] as String?,
        icon: json['icon'] as String?,
        accent: _accentFromString(json['accent'] as String?),
        archivedAt: _dateFromSeconds(json['archived_at']),
        createdVia: json['created_via'] as String?,
        createdBy: (json['created_by'] as String?) ?? '',
        createdAt: _dateFromSeconds(json['created_at']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
        updatedAt: _dateFromSeconds(json['updated_at']) ??
            DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      );

  /// Unique bundle ID.
  final int id;

  /// Display name.
  final String name;

  /// Optional short description.
  final String? description;

  /// Optional Material Symbol icon name.
  final String? icon;

  /// Accent color.
  final BundleAccent accent;

  /// When the bundle was archived, or `null` if still active.
  final DateTime? archivedAt;

  /// How the bundle was created (`app`, `api`, `sdk`, `mcp`). May be `null`
  /// for legacy bundles created before this field was tracked.
  final String? createdVia;

  /// Identity (typically an email) of the creator and owner.
  final String createdBy;

  /// When the bundle was created (UTC).
  final DateTime createdAt;

  /// When the bundle was last modified (UTC).
  final DateTime updatedAt;
}

/// A bundle enriched with range-scoped summary data used on listing pages.
@immutable
class BundleWithSummary {
  /// Creates a summary directly.
  const BundleWithSummary({
    required this.bundle,
    required this.linkCount,
    required this.totalClicks,
    required this.deltaPct,
    required this.sparkline,
    required this.topLinks,
  });

  /// Parses from JSON (the bundle's own fields are inline with summary fields).
  factory BundleWithSummary.fromJson(Map<String, dynamic> json) =>
      BundleWithSummary(
        bundle: Bundle.fromJson(json),
        linkCount: ((json['link_count'] as num?) ?? 0).toInt(),
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
        deltaPct: (json['delta_pct'] as num?)?.toInt(),
        sparkline: ((json['sparkline'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic e) => (e as num).toInt())
            .toList(growable: false),
        topLinks: ((json['top_links'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic e) =>
                BundleTopLink.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
      );

  /// Underlying bundle metadata.
  final Bundle bundle;

  /// Number of links in the bundle.
  final int linkCount;

  /// Combined clicks in the selected range.
  final int totalClicks;

  /// Percent change vs. the previous equivalent range, or `null` when there is
  /// no baseline (first period or "all").
  final int? deltaPct;

  /// Bucketed click counts for the sparkline.
  final List<int> sparkline;

  /// Top 3 member links by click count.
  final List<BundleTopLink> topLinks;
}

/// Top-link entry preview shown on a bundle card.
@immutable
class BundleTopLink {
  /// Creates a top-link entry.
  const BundleTopLink({required this.slug, required this.clickCount});

  /// Parses from JSON.
  factory BundleTopLink.fromJson(Map<String, dynamic> json) => BundleTopLink(
        slug: (json['slug'] as String?) ?? '',
        clickCount: ((json['click_count'] as num?) ?? 0).toInt(),
      );

  /// The primary slug of the link.
  final String slug;

  /// Clicks this link contributed in the current summary range.
  final int clickCount;
}

/// A single link's contribution to a bundle's stats.
@immutable
class BundleLinkStats {
  /// Creates a per-link stats row.
  const BundleLinkStats({
    required this.linkId,
    required this.label,
    required this.primarySlug,
    required this.url,
    required this.clickCount,
    required this.pctOfBundle,
    required this.deltaPct,
  });

  /// Parses from JSON.
  factory BundleLinkStats.fromJson(Map<String, dynamic> json) =>
      BundleLinkStats(
        linkId: (json['link_id'] as num).toInt(),
        label: json['label'] as String?,
        primarySlug: (json['primary_slug'] as String?) ?? '',
        url: (json['url'] as String?) ?? '',
        clickCount: ((json['click_count'] as num?) ?? 0).toInt(),
        pctOfBundle: ((json['pct_of_bundle'] as num?) ?? 0).toInt(),
        deltaPct: (json['delta_pct'] as num?)?.toInt(),
      );

  /// The link ID.
  final int linkId;

  /// The link's label, or `null`.
  final String? label;

  /// The link's primary slug.
  final String primarySlug;

  /// The destination URL.
  final String url;

  /// Number of clicks this link contributed in the selected range.
  final int clickCount;

  /// This link's share of the bundle's total clicks, 0–100.
  final int pctOfBundle;

  /// Percent change for this link vs. the previous equivalent period.
  final int? deltaPct;
}

/// Combined analytics for a bundle across all its links.
@immutable
class BundleStats {
  /// Creates bundle stats directly. Most callers should rely on
  /// [BundleStats.fromJson].
  const BundleStats({
    required this.bundle,
    required this.linkCount,
    required this.totalClicks,
    required this.deltaPct,
    required this.clickedLinks,
    required this.countriesReached,
    required this.countries,
    required this.devices,
    required this.os,
    required this.browsers,
    required this.referrers,
    required this.linkModes,
    required this.perLink,
  });

  /// Parses combined stats from JSON.
  factory BundleStats.fromJson(Map<String, dynamic> json) => BundleStats(
        bundle: Bundle.fromJson(json['bundle'] as Map<String, dynamic>),
        linkCount: ((json['link_count'] as num?) ?? 0).toInt(),
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
        deltaPct: (json['delta_pct'] as num?)?.toInt(),
        clickedLinks: ((json['clicked_links'] as num?) ?? 0).toInt(),
        countriesReached:
            ((json['countries_reached'] as num?) ?? 0).toInt(),
        countries: ClickStats._nameCounts(json['countries']),
        devices: ClickStats._nameCounts(json['devices']),
        os: ClickStats._nameCounts(json['os']),
        browsers: ClickStats._nameCounts(json['browsers']),
        referrers: ClickStats._nameCounts(json['referrers']),
        linkModes: ClickStats._nameCounts(json['link_modes']),
        perLink: ((json['per_link'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic e) =>
                BundleLinkStats.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
      );

  /// Bundle metadata.
  final Bundle bundle;

  /// Number of links in the bundle.
  final int linkCount;

  /// Combined clicks in the selected range.
  final int totalClicks;

  /// Percent change vs. the previous equivalent range, or `null`.
  final int? deltaPct;

  /// How many bundle links got at least one click.
  final int clickedLinks;

  /// Distinct click-origin countries seen.
  final int countriesReached;

  /// Clicks grouped by country code.
  final List<NameCount> countries;

  /// Clicks grouped by device type.
  final List<NameCount> devices;

  /// Clicks grouped by operating system.
  final List<NameCount> os;

  /// Clicks grouped by browser.
  final List<NameCount> browsers;

  /// Clicks grouped by referrer host.
  final List<NameCount> referrers;

  /// Clicks grouped by access mode (direct link vs. QR scan).
  final List<NameCount> linkModes;

  /// Per-link breakdown, sorted by clicks desc.
  final List<BundleLinkStats> perLink;
}

/// Options for [ShrtnrClient.createBundle].
@immutable
class CreateBundleOptions {
  /// Creates a new-bundle payload.
  const CreateBundleOptions({
    required this.name,
    this.description,
    this.icon,
    this.accent,
  });

  /// Display name. Required.
  final String name;

  /// Optional short description.
  final String? description;

  /// Optional Material Symbol icon name.
  final String? icon;

  /// Optional accent color (defaults to orange on the server).
  final BundleAccent? accent;

  /// JSON body for the create-bundle request.
  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        if (description != null) 'description': description,
        if (icon != null) 'icon': icon,
        if (accent != null) 'accent': _accentToString(accent!),
      };
}

/// Options for [ShrtnrClient.updateBundle]. All fields are optional. Pass a
/// null description or icon together with `clearDescription`/`clearIcon` to
/// reset the value on the server.
@immutable
class UpdateBundleOptions {
  /// Creates an update payload.
  const UpdateBundleOptions({
    this.name,
    this.description,
    this.clearDescription = false,
    this.icon,
    this.clearIcon = false,
    this.accent,
  });

  /// New display name.
  final String? name;

  /// New description value.
  final String? description;

  /// If true, sends `"description": null` to clear the description.
  final bool clearDescription;

  /// New icon value.
  final String? icon;

  /// If true, sends `"icon": null` to clear the icon.
  final bool clearIcon;

  /// New accent color.
  final BundleAccent? accent;

  /// JSON body for the update-bundle request.
  Map<String, dynamic> toJson() {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (clearDescription) {
      body['description'] = null;
    } else if (description != null) {
      body['description'] = description;
    }
    if (clearIcon) {
      body['icon'] = null;
    } else if (icon != null) {
      body['icon'] = icon;
    }
    if (accent != null) body['accent'] = _accentToString(accent!);
    return body;
  }
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
