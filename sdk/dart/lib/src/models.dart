// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import 'package:meta/meta.dart';

// ---- Helpers ----

List<NameCount> _nameCountList(Object? raw) =>
    ((raw as List<dynamic>?) ?? const <dynamic>[])
        .map((dynamic e) => NameCount.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);

// ---- Core models ----

/// A short URL slug attached to a [Link].
@immutable
class Slug {
  const Slug({
    required this.linkId,
    required this.slug,
    required this.isCustom,
    required this.isPrimary,
    required this.clickCount,
    required this.createdAt,
    required this.disabledAt,
  });

  factory Slug.fromJson(Map<String, dynamic> json) => Slug(
        linkId: (json['link_id'] as num).toInt(),
        slug: json['slug'] as String,
        isCustom: ((json['is_custom'] as num?) ?? 0).toInt(),
        isPrimary: ((json['is_primary'] as num?) ?? 0).toInt(),
        clickCount: ((json['click_count'] as num?) ?? 0).toInt(),
        createdAt: ((json['created_at'] as num?) ?? 0).toInt(),
        disabledAt: (json['disabled_at'] as num?)?.toInt(),
      );

  /// ID of the parent link.
  final int linkId;

  /// The short path, for example `a3x` or `my-campaign`.
  final String slug;

  /// 1 if this slug was caller-provided rather than auto-generated, 0 otherwise.
  final int isCustom;

  /// 1 if this is the primary redirect target for the parent link, 0 otherwise.
  final int isPrimary;

  /// Number of clicks recorded against this slug.
  final int clickCount;

  /// Unix seconds when the slug was created.
  final int createdAt;

  /// Unix seconds when the slug was disabled, or null if active.
  final int? disabledAt;
}

/// A short link with its slugs, total click count, and metadata.
@immutable
class Link {
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
    this.deltaPct,
  });

  factory Link.fromJson(Map<String, dynamic> json) => Link(
        id: (json['id'] as num).toInt(),
        url: json['url'] as String,
        label: json['label'] as String?,
        createdAt: ((json['created_at'] as num?) ?? 0).toInt(),
        expiresAt: (json['expires_at'] as num?)?.toInt(),
        createdVia: json['created_via'] as String?,
        createdBy: (json['created_by'] as String?) ?? '',
        slugs: ((json['slugs'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic s) => Slug.fromJson(s as Map<String, dynamic>))
            .toList(growable: false),
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
        deltaPct: (json['delta_pct'] as num?)?.toDouble(),
      );

  /// Unique link ID.
  final int id;

  /// Target URL.
  final String url;

  /// Optional human-readable label.
  final String? label;

  /// Unix seconds when the link was created.
  final int createdAt;

  /// Unix seconds expiry, or null for no expiry.
  final int? expiresAt;

  /// How the link was created (`sdk`, `api`, `ui`). Null for legacy links.
  final String? createdVia;

  /// Identity (typically an email) of the creator.
  final String createdBy;

  /// Slugs attached to this link.
  final List<Slug> slugs;

  /// Total clicks across every slug on this link in the requested range.
  final int totalClicks;

  /// Click count change as a percentage versus the previous equivalent period.
  /// Absent when comparison data is unavailable.
  final double? deltaPct;
}

/// A collection of links grouped to show combined engagement.
@immutable
class Bundle {
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

  factory Bundle.fromJson(Map<String, dynamic> json) => Bundle(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
        description: json['description'] as String?,
        icon: json['icon'] as String?,
        accent: (json['accent'] as String?) ?? 'orange',
        archivedAt: (json['archived_at'] as num?)?.toInt(),
        createdVia: json['created_via'] as String?,
        createdBy: (json['created_by'] as String?) ?? '',
        createdAt: ((json['created_at'] as num?) ?? 0).toInt(),
        updatedAt: ((json['updated_at'] as num?) ?? 0).toInt(),
      );

  /// Unique bundle ID.
  final int id;

  /// Display name.
  final String name;

  /// Optional short description.
  final String? description;

  /// Optional Material Symbol icon name.
  final String? icon;

  /// Accent color string (`orange`, `red`, `green`, `blue`, `purple`).
  final String accent;

  /// Unix seconds when the bundle was archived, or null if active.
  final int? archivedAt;

  /// How the bundle was created. Null for legacy bundles.
  final String? createdVia;

  /// Identity (typically an email) of the creator.
  final String createdBy;

  /// Unix seconds when the bundle was created.
  final int createdAt;

  /// Unix seconds when the bundle was last modified.
  final int updatedAt;
}

/// Bundle enriched with range-scoped summary data.
@immutable
class BundleWithSummary extends Bundle {
  const BundleWithSummary({
    required super.id,
    required super.name,
    required super.description,
    required super.icon,
    required super.accent,
    required super.archivedAt,
    required super.createdVia,
    required super.createdBy,
    required super.createdAt,
    required super.updatedAt,
    required this.linkCount,
    required this.totalClicks,
    required this.sparkline,
    required this.topLinks,
    this.deltaPct,
  });

  factory BundleWithSummary.fromJson(Map<String, dynamic> json) =>
      BundleWithSummary(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
        description: json['description'] as String?,
        icon: json['icon'] as String?,
        accent: (json['accent'] as String?) ?? 'orange',
        archivedAt: (json['archived_at'] as num?)?.toInt(),
        createdVia: json['created_via'] as String?,
        createdBy: (json['created_by'] as String?) ?? '',
        createdAt: ((json['created_at'] as num?) ?? 0).toInt(),
        updatedAt: ((json['updated_at'] as num?) ?? 0).toInt(),
        linkCount: ((json['link_count'] as num?) ?? 0).toInt(),
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
        deltaPct: (json['delta_pct'] as num?)?.toDouble(),
        sparkline: ((json['sparkline'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic e) => (e as num).toInt())
            .toList(growable: false),
        topLinks:
            ((json['top_links'] as List<dynamic>?) ?? const <dynamic>[])
                .map((dynamic e) =>
                    BundleTopLink.fromJson(e as Map<String, dynamic>))
                .toList(growable: false),
      );

  /// Number of links in the bundle.
  final int linkCount;

  /// Combined clicks in the selected range.
  final int totalClicks;

  /// Click count change percentage versus the previous equivalent range.
  /// Absent when comparison data is unavailable.
  final double? deltaPct;

  /// Bucketed click counts for sparkline display.
  final List<int> sparkline;

  /// Top member links by click count.
  final List<BundleTopLink> topLinks;
}

/// Top-link entry preview shown in a [BundleWithSummary].
@immutable
class BundleTopLink {
  const BundleTopLink({required this.slug, required this.clickCount});

  factory BundleTopLink.fromJson(Map<String, dynamic> json) => BundleTopLink(
        slug: (json['slug'] as String?) ?? '',
        clickCount: ((json['click_count'] as num?) ?? 0).toInt(),
      );

  /// The slug of the link.
  final String slug;

  /// Clicks this link contributed in the current summary range.
  final int clickCount;
}

// ---- Analytics models ----

/// A name/count pair used in analytics breakdowns.
@immutable
class NameCount {
  const NameCount({required this.name, required this.count});

  factory NameCount.fromJson(Map<String, dynamic> json) => NameCount(
        name: (json['name'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// The bucket label, for example a country code or browser name.
  final String name;

  /// The click count in this bucket.
  final int count;
}

/// Per-link click analytics breakdown.
@immutable
class ClickStats {
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
    required this.numCountries,
    required this.numReferrers,
    required this.numReferrerHosts,
    required this.numOs,
    required this.numBrowsers,
  });

  factory ClickStats.fromJson(Map<String, dynamic> json) => ClickStats(
        totalClicks: ((json['total_clicks'] as num?) ?? 0).toInt(),
        countries: _nameCountList(json['countries']),
        referrers: _nameCountList(json['referrers']),
        referrerHosts: _nameCountList(json['referrer_hosts']),
        devices: _nameCountList(json['devices']),
        os: _nameCountList(json['os']),
        browsers: _nameCountList(json['browsers']),
        linkModes: _nameCountList(json['link_modes']),
        channels: _nameCountList(json['channels']),
        clicksOverTime:
            ((json['clicks_over_time'] as List<dynamic>?) ?? const <dynamic>[])
                .map((dynamic e) =>
                    DateClickCount.fromJson(e as Map<String, dynamic>))
                .toList(growable: false),
        slugClicks:
            ((json['slug_clicks'] as List<dynamic>?) ?? const <dynamic>[])
                .map((dynamic e) =>
                    SlugClickCount.fromJson(e as Map<String, dynamic>))
                .toList(growable: false),
        numCountries: ((json['num_countries'] as num?) ?? 0).toInt(),
        numReferrers: ((json['num_referrers'] as num?) ?? 0).toInt(),
        numReferrerHosts: ((json['num_referrer_hosts'] as num?) ?? 0).toInt(),
        numOs: ((json['num_os'] as num?) ?? 0).toInt(),
        numBrowsers: ((json['num_browsers'] as num?) ?? 0).toInt(),
      );

  /// Sum of clicks across every slug on the link in the requested range.
  final int totalClicks;

  /// Clicks grouped by country.
  final List<NameCount> countries;

  /// Clicks grouped by full HTTP Referer value.
  final List<NameCount> referrers;

  /// Clicks grouped by referrer hostname.
  final List<NameCount> referrerHosts;

  /// Clicks grouped by device type.
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
  final List<DateClickCount> clicksOverTime;

  /// Per-slug click counts.
  final List<SlugClickCount> slugClicks;

  /// Distinct country count.
  final int numCountries;

  /// Distinct referrer count.
  final int numReferrers;

  /// Distinct referrer-host count.
  final int numReferrerHosts;

  /// Distinct OS count.
  final int numOs;

  /// Distinct browser count.
  final int numBrowsers;
}

/// A date/count pair in a click timeline.
@immutable
class DateClickCount {
  const DateClickCount({required this.date, required this.count});

  factory DateClickCount.fromJson(Map<String, dynamic> json) => DateClickCount(
        date: (json['date'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// The bucket date string, for example `2026-04-21`.
  final String date;

  /// Click count on that date.
  final int count;
}

/// A slug/count pair in a per-slug analytics breakdown.
@immutable
class SlugClickCount {
  const SlugClickCount({required this.slug, required this.count});

  factory SlugClickCount.fromJson(Map<String, dynamic> json) => SlugClickCount(
        slug: (json['slug'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// The slug identifier.
  final String slug;

  /// Click count for this slug.
  final int count;
}

/// A single time bucket in a [TimelineData] response.
@immutable
class TimelineBucket {
  const TimelineBucket({required this.label, required this.count});

  factory TimelineBucket.fromJson(Map<String, dynamic> json) => TimelineBucket(
        label: (json['label'] as String?) ?? '',
        count: ((json['count'] as num?) ?? 0).toInt(),
      );

  /// Human-readable bucket label, for example `Mon` or `Apr 21`.
  final String label;

  /// Click count in this bucket.
  final int count;
}

/// Period-summary totals nested inside [TimelineData].
@immutable
class TimelineSummary {
  const TimelineSummary({
    required this.last24h,
    required this.last7d,
    required this.last30d,
    required this.last90d,
    required this.last1y,
  });

  factory TimelineSummary.fromJson(Map<String, dynamic> json) => TimelineSummary(
        last24h: ((json['last_24h'] as num?) ?? 0).toInt(),
        last7d: ((json['last_7d'] as num?) ?? 0).toInt(),
        last30d: ((json['last_30d'] as num?) ?? 0).toInt(),
        last90d: ((json['last_90d'] as num?) ?? 0).toInt(),
        last1y: ((json['last_1y'] as num?) ?? 0).toInt(),
      );

  /// Clicks in the last 24 hours.
  final int last24h;

  /// Clicks in the last 7 days.
  final int last7d;

  /// Clicks in the last 30 days.
  final int last30d;

  /// Clicks in the last 90 days.
  final int last90d;

  /// Clicks in the last 365 days.
  final int last1y;
}

/// Click timeline with bucketed counts and period summaries.
@immutable
class TimelineData {
  const TimelineData({
    required this.range,
    required this.buckets,
    required this.summary,
  });

  factory TimelineData.fromJson(Map<String, dynamic> json) => TimelineData(
        range: (json['range'] as String?) ?? 'all',
        buckets: ((json['buckets'] as List<dynamic>?) ?? const <dynamic>[])
            .map((dynamic e) =>
                TimelineBucket.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        summary: TimelineSummary.fromJson(
            (json['summary'] as Map<String, dynamic>?) ?? const {}),
      );

  /// The time range this data covers.
  final String range;

  /// Click counts bucketed over the range.
  final List<TimelineBucket> buckets;

  /// Period summary totals.
  final TimelineSummary summary;
}

// ---- Result types ----

/// Result of a delete operation.
@immutable
class DeletedResult {
  const DeletedResult({required this.deleted});

  factory DeletedResult.fromJson(Map<String, dynamic> json) =>
      DeletedResult(deleted: (json['deleted'] as bool?) ?? false);

  /// True when the resource was deleted.
  final bool deleted;
}

/// Result of an add-link-to-bundle operation.
@immutable
class AddedResult {
  const AddedResult({required this.added});

  factory AddedResult.fromJson(Map<String, dynamic> json) =>
      AddedResult(added: (json['added'] as bool?) ?? false);

  /// True when the link was added.
  final bool added;
}

/// Result of a remove-link-from-bundle or remove-slug operation.
@immutable
class RemovedResult {
  const RemovedResult({required this.removed});

  factory RemovedResult.fromJson(Map<String, dynamic> json) =>
      RemovedResult(removed: (json['removed'] as bool?) ?? false);

  /// True when the resource was removed.
  final bool removed;
}
