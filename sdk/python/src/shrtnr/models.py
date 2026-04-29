# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Frozen dataclasses for every request and response shape in the shrtnr API.

Timestamps stay as ``int`` (Unix seconds) to match the wire format exactly.
The TypeScript SDK does the same; the Dart SDK converts to ``DateTime`` as a
language-idiom choice. Python sticks close to the JSON.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

TimelineRange = Literal["24h", "7d", "30d", "90d", "1y", "all"]
BundleAccent = Literal["orange", "red", "green", "blue", "purple"]


def _decode_optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


@dataclass(frozen=True)
class HealthStatus:
    status: str
    version: str
    timestamp: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> HealthStatus:
        return cls(
            status=str(data["status"]),
            version=str(data["version"]),
            timestamp=int(data["timestamp"]),
        )


@dataclass(frozen=True)
class Slug:
    link_id: int
    slug: str
    is_custom: int
    is_primary: int
    click_count: int
    created_at: int
    disabled_at: int | None = None

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> Slug:
        disabled = data.get("disabled_at")
        return cls(
            link_id=int(data["link_id"]),
            slug=str(data["slug"]),
            is_custom=int(data["is_custom"]),
            is_primary=int(data["is_primary"]),
            click_count=int(data["click_count"]),
            created_at=int(data["created_at"]),
            disabled_at=int(disabled) if disabled is not None else None,
        )


@dataclass(frozen=True)
class Link:
    """A short link with all of its slugs and lifetime click count.

    Matches the server's :code:`LinkWithSlugs` shape. Every successful
    /_/api/links response returns this, not a bare Link.
    """

    id: int
    url: str
    label: str | None
    created_at: int
    expires_at: int | None
    created_via: str | None
    created_by: str
    slugs: list[Slug]
    total_clicks: int
    delta_pct: float | None = None

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> Link:
        delta = data.get("delta_pct")
        expires = data.get("expires_at")
        return cls(
            id=int(data["id"]),
            url=str(data["url"]),
            label=_decode_optional_str(data.get("label")),
            created_at=int(data["created_at"]),
            expires_at=int(expires) if expires is not None else None,
            created_via=_decode_optional_str(data.get("created_via")),
            created_by=str(data["created_by"]),
            slugs=[Slug.from_json(s) for s in data.get("slugs", [])],
            total_clicks=int(data.get("total_clicks", 0)),
            delta_pct=float(delta) if delta is not None else None,
        )


@dataclass(frozen=True)
class NameCount:
    name: str
    count: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> NameCount:
        return cls(name=str(data["name"]), count=int(data["count"]))


@dataclass(frozen=True)
class DateCount:
    date: str
    count: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> DateCount:
        return cls(date=str(data["date"]), count=int(data["count"]))


@dataclass(frozen=True)
class SlugCount:
    slug: str
    count: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> SlugCount:
        return cls(slug=str(data["slug"]), count=int(data["count"]))


@dataclass(frozen=True)
class ClickStats:
    total_clicks: int
    countries: list[NameCount]
    referrers: list[NameCount]
    referrer_hosts: list[NameCount]
    devices: list[NameCount]
    os: list[NameCount]
    browsers: list[NameCount]
    link_modes: list[NameCount]
    channels: list[NameCount]
    clicks_over_time: list[DateCount]
    slug_clicks: list[SlugCount]
    num_countries: int = 0
    num_referrers: int = 0
    num_referrer_hosts: int = 0
    num_os: int = 0
    num_browsers: int = 0

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> ClickStats:
        return cls(
            total_clicks=int(data.get("total_clicks", 0)),
            countries=[NameCount.from_json(x) for x in data.get("countries", [])],
            referrers=[NameCount.from_json(x) for x in data.get("referrers", [])],
            referrer_hosts=[NameCount.from_json(x) for x in data.get("referrer_hosts", [])],
            devices=[NameCount.from_json(x) for x in data.get("devices", [])],
            os=[NameCount.from_json(x) for x in data.get("os", [])],
            browsers=[NameCount.from_json(x) for x in data.get("browsers", [])],
            link_modes=[NameCount.from_json(x) for x in data.get("link_modes", [])],
            channels=[NameCount.from_json(x) for x in data.get("channels", [])],
            clicks_over_time=[DateCount.from_json(x) for x in data.get("clicks_over_time", [])],
            slug_clicks=[SlugCount.from_json(x) for x in data.get("slug_clicks", [])],
            num_countries=int(data.get("num_countries", 0)),
            num_referrers=int(data.get("num_referrers", 0)),
            num_referrer_hosts=int(data.get("num_referrer_hosts", 0)),
            num_os=int(data.get("num_os", 0)),
            num_browsers=int(data.get("num_browsers", 0)),
        )


@dataclass(frozen=True)
class TimelineBucket:
    label: str
    count: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> TimelineBucket:
        return cls(label=str(data["label"]), count=int(data["count"]))


@dataclass(frozen=True)
class TimelineSummary:
    last_24h: int
    last_7d: int
    last_30d: int
    last_90d: int
    last_1y: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> TimelineSummary:
        return cls(
            last_24h=int(data.get("last_24h", 0)),
            last_7d=int(data.get("last_7d", 0)),
            last_30d=int(data.get("last_30d", 0)),
            last_90d=int(data.get("last_90d", 0)),
            last_1y=int(data.get("last_1y", 0)),
        )


@dataclass(frozen=True)
class TimelineData:
    range: TimelineRange
    buckets: list[TimelineBucket]
    summary: TimelineSummary

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> TimelineData:
        return cls(
            range=data["range"],
            buckets=[TimelineBucket.from_json(b) for b in data.get("buckets", [])],
            summary=TimelineSummary.from_json(data.get("summary", {})),
        )


@dataclass(frozen=True)
class Bundle:
    id: int
    name: str
    description: str | None
    icon: str | None
    accent: BundleAccent
    archived_at: int | None
    created_via: str | None
    created_by: str
    created_at: int
    updated_at: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> Bundle:
        archived = data.get("archived_at")
        return cls(
            id=int(data["id"]),
            name=str(data["name"]),
            description=_decode_optional_str(data.get("description")),
            icon=_decode_optional_str(data.get("icon")),
            accent=data.get("accent", "orange"),
            archived_at=int(archived) if archived is not None else None,
            created_via=_decode_optional_str(data.get("created_via")),
            created_by=str(data["created_by"]),
            created_at=int(data["created_at"]),
            updated_at=int(data["updated_at"]),
        )


@dataclass(frozen=True)
class BundleTopLink:
    slug: str
    click_count: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> BundleTopLink:
        return cls(slug=str(data["slug"]), click_count=int(data["click_count"]))


@dataclass(frozen=True)
class BundleWithSummary:
    bundle: Bundle
    link_count: int
    total_clicks: int
    sparkline: list[int]
    top_links: list[BundleTopLink]
    delta_pct: float | None = None

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> BundleWithSummary:
        delta = data.get("delta_pct")
        return cls(
            bundle=Bundle.from_json(data),
            link_count=int(data.get("link_count", 0)),
            total_clicks=int(data.get("total_clicks", 0)),
            sparkline=[int(x) for x in data.get("sparkline", [])],
            top_links=[BundleTopLink.from_json(x) for x in data.get("top_links", [])],
            delta_pct=float(delta) if delta is not None else None,
        )


@dataclass(frozen=True)
class BundleStatsPerLink:
    link_id: int
    label: str | None
    primary_slug: str
    url: str
    click_count: int
    pct_of_bundle: int
    delta_pct: float | None = None

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> BundleStatsPerLink:
        delta = data.get("delta_pct")
        return cls(
            link_id=int(data["link_id"]),
            label=_decode_optional_str(data.get("label")),
            primary_slug=str(data["primary_slug"]),
            url=str(data["url"]),
            click_count=int(data["click_count"]),
            pct_of_bundle=int(data.get("pct_of_bundle", 0)),
            delta_pct=float(delta) if delta is not None else None,
        )


@dataclass(frozen=True)
class BundleTopPerformer:
    slug: str
    label: str | None
    click_count: int
    pct_of_bundle: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> BundleTopPerformer:
        return cls(
            slug=str(data["slug"]),
            label=_decode_optional_str(data.get("label")),
            click_count=int(data["click_count"]),
            pct_of_bundle=int(data.get("pct_of_bundle", 0)),
        )


@dataclass(frozen=True)
class BundleTopCountry:
    name: str
    pct: int

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> BundleTopCountry:
        return cls(name=str(data["name"]), pct=int(data["pct"]))


@dataclass(frozen=True)
class BundleStats:
    bundle: Bundle
    link_count: int
    total_clicks: int
    clicked_links: int
    countries_reached: int
    timeline: TimelineData
    countries: list[NameCount]
    devices: list[NameCount]
    os: list[NameCount]
    browsers: list[NameCount]
    referrers: list[NameCount]
    referrer_hosts: list[NameCount]
    link_modes: list[NameCount]
    per_link: list[BundleStatsPerLink]
    delta_pct: float | None = None
    top_performer: BundleTopPerformer | None = None
    top_country: BundleTopCountry | None = None
    num_countries: int = 0
    num_referrers: int = 0
    num_referrer_hosts: int = 0
    num_os: int = 0
    num_browsers: int = 0

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> BundleStats:
        delta = data.get("delta_pct")
        top_perf = data.get("top_performer")
        top_country = data.get("top_country")
        return cls(
            bundle=Bundle.from_json(data["bundle"]),
            link_count=int(data.get("link_count", 0)),
            total_clicks=int(data.get("total_clicks", 0)),
            clicked_links=int(data.get("clicked_links", 0)),
            countries_reached=int(data.get("countries_reached", 0)),
            timeline=TimelineData.from_json(data["timeline"]),
            countries=[NameCount.from_json(x) for x in data.get("countries", [])],
            devices=[NameCount.from_json(x) for x in data.get("devices", [])],
            os=[NameCount.from_json(x) for x in data.get("os", [])],
            browsers=[NameCount.from_json(x) for x in data.get("browsers", [])],
            referrers=[NameCount.from_json(x) for x in data.get("referrers", [])],
            referrer_hosts=[NameCount.from_json(x) for x in data.get("referrer_hosts", [])],
            link_modes=[NameCount.from_json(x) for x in data.get("link_modes", [])],
            per_link=[BundleStatsPerLink.from_json(x) for x in data.get("per_link", [])],
            delta_pct=float(delta) if delta is not None else None,
            top_performer=BundleTopPerformer.from_json(top_perf) if top_perf else None,
            top_country=BundleTopCountry.from_json(top_country) if top_country else None,
            num_countries=int(data.get("num_countries", 0)),
            num_referrers=int(data.get("num_referrers", 0)),
            num_referrer_hosts=int(data.get("num_referrer_hosts", 0)),
            num_os=int(data.get("num_os", 0)),
            num_browsers=int(data.get("num_browsers", 0)),
        )


# Request option dataclasses — kept mutable because callers construct and tweak
# them inline. Only serialization matters, not identity.


@dataclass
class CreateLinkOptions:
    url: str
    label: str | None = None
    slug_length: int | None = None
    expires_at: int | None = None
    allow_duplicate: bool | None = None

    def to_json(self) -> dict[str, Any]:
        body: dict[str, Any] = {"url": self.url}
        if self.label is not None:
            body["label"] = self.label
        if self.slug_length is not None:
            body["slug_length"] = self.slug_length
        if self.expires_at is not None:
            body["expires_at"] = self.expires_at
        if self.allow_duplicate is not None:
            body["allow_duplicate"] = self.allow_duplicate
        return body


_UNSET = object()


@dataclass
class UpdateLinkOptions:
    """Patch an existing link.

    Fields default to ``_UNSET`` (omitted from the request body). Pass
    ``label=None`` to clear a label on the server; pass ``expires_at=None``
    to clear the expiry.
    """

    url: Any = field(default=_UNSET)
    label: Any = field(default=_UNSET)
    expires_at: Any = field(default=_UNSET)

    def to_json(self) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if self.url is not _UNSET:
            body["url"] = self.url
        if self.label is not _UNSET:
            body["label"] = self.label
        if self.expires_at is not _UNSET:
            body["expires_at"] = self.expires_at
        return body


@dataclass
class CreateBundleOptions:
    name: str
    description: str | None = None
    icon: str | None = None
    accent: BundleAccent | None = None

    def to_json(self) -> dict[str, Any]:
        body: dict[str, Any] = {"name": self.name}
        if self.description is not None:
            body["description"] = self.description
        if self.icon is not None:
            body["icon"] = self.icon
        if self.accent is not None:
            body["accent"] = self.accent
        return body


@dataclass
class UpdateBundleOptions:
    name: Any = field(default=_UNSET)
    description: Any = field(default=_UNSET)
    icon: Any = field(default=_UNSET)
    accent: Any = field(default=_UNSET)

    def to_json(self) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if self.name is not _UNSET:
            body["name"] = self.name
        if self.description is not _UNSET:
            body["description"] = self.description
        if self.icon is not _UNSET:
            body["icon"] = self.icon
        if self.accent is not _UNSET:
            body["accent"] = self.accent
        return body


DeleteResult = dict[str, bool]
RemoveResult = dict[str, bool]
AddResult = dict[str, bool]
ListBundlesArchived = bool | Literal["all", "only", "true", "false"]
