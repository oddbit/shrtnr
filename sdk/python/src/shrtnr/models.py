# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Frozen dataclasses for every response shape in the shrtnr API.

Field names are snake_case matching the wire format exactly. Timestamps are
``int`` (Unix seconds). Optional fields default to ``None`` where the spec
marks them nullable or absent.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

# ---- Enum type aliases ----

TimelineRange = Literal["24h", "7d", "30d", "90d", "1y", "all"]
BundleAccent = Literal["orange", "red", "green", "blue", "purple"]


# ---- Core models ----


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
    def from_dict(cls, data: dict[str, Any]) -> Slug:
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
    def from_dict(cls, data: dict[str, Any]) -> Link:
        delta = data.get("delta_pct")
        expires = data.get("expires_at")
        return cls(
            id=int(data["id"]),
            url=str(data["url"]),
            label=data.get("label"),
            created_at=int(data["created_at"]),
            expires_at=int(expires) if expires is not None else None,
            created_via=data.get("created_via"),
            created_by=str(data["created_by"]),
            slugs=[Slug.from_dict(s) for s in data.get("slugs", [])],
            total_clicks=int(data.get("total_clicks", 0)),
            delta_pct=float(delta) if delta is not None else None,
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
    def from_dict(cls, data: dict[str, Any]) -> Bundle:
        archived = data.get("archived_at")
        return cls(
            id=int(data["id"]),
            name=str(data["name"]),
            description=data.get("description"),
            icon=data.get("icon"),
            accent=data["accent"],
            archived_at=int(archived) if archived is not None else None,
            created_via=data.get("created_via"),
            created_by=str(data["created_by"]),
            created_at=int(data["created_at"]),
            updated_at=int(data["updated_at"]),
        )


@dataclass(frozen=True)
class BundleTopLink:
    slug: str
    click_count: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BundleTopLink:
        return cls(slug=str(data["slug"]), click_count=int(data["click_count"]))


@dataclass(frozen=True)
class BundleWithSummary:
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
    link_count: int
    total_clicks: int
    sparkline: list[int]
    top_links: list[BundleTopLink]
    delta_pct: float | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BundleWithSummary:
        delta = data.get("delta_pct")
        archived = data.get("archived_at")
        return cls(
            id=int(data["id"]),
            name=str(data["name"]),
            description=data.get("description"),
            icon=data.get("icon"),
            accent=data["accent"],
            archived_at=int(archived) if archived is not None else None,
            created_via=data.get("created_via"),
            created_by=str(data["created_by"]),
            created_at=int(data["created_at"]),
            updated_at=int(data["updated_at"]),
            link_count=int(data.get("link_count", 0)),
            total_clicks=int(data.get("total_clicks", 0)),
            sparkline=[int(x) for x in data.get("sparkline", [])],
            top_links=[BundleTopLink.from_dict(x) for x in data.get("top_links", [])],
            delta_pct=float(delta) if delta is not None else None,
        )


# ---- Analytics models ----


@dataclass(frozen=True)
class NameCount:
    name: str
    count: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> NameCount:
        return cls(name=str(data["name"]), count=int(data["count"]))


@dataclass(frozen=True)
class DateCount:
    date: str
    count: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DateCount:
        return cls(date=str(data["date"]), count=int(data["count"]))


@dataclass(frozen=True)
class SlugCount:
    slug: str
    count: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SlugCount:
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
    def from_dict(cls, data: dict[str, Any]) -> ClickStats:
        return cls(
            total_clicks=int(data.get("total_clicks", 0)),
            countries=[NameCount.from_dict(x) for x in data.get("countries", [])],
            referrers=[NameCount.from_dict(x) for x in data.get("referrers", [])],
            referrer_hosts=[NameCount.from_dict(x) for x in data.get("referrer_hosts", [])],
            devices=[NameCount.from_dict(x) for x in data.get("devices", [])],
            os=[NameCount.from_dict(x) for x in data.get("os", [])],
            browsers=[NameCount.from_dict(x) for x in data.get("browsers", [])],
            link_modes=[NameCount.from_dict(x) for x in data.get("link_modes", [])],
            channels=[NameCount.from_dict(x) for x in data.get("channels", [])],
            clicks_over_time=[DateCount.from_dict(x) for x in data.get("clicks_over_time", [])],
            slug_clicks=[SlugCount.from_dict(x) for x in data.get("slug_clicks", [])],
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
    def from_dict(cls, data: dict[str, Any]) -> TimelineBucket:
        return cls(label=str(data["label"]), count=int(data["count"]))


@dataclass(frozen=True)
class TimelineSummary:
    last_24h: int
    last_7d: int
    last_30d: int
    last_90d: int
    last_1y: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TimelineSummary:
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
    def from_dict(cls, data: dict[str, Any]) -> TimelineData:
        return cls(
            range=data["range"],
            buckets=[TimelineBucket.from_dict(b) for b in data.get("buckets", [])],
            summary=TimelineSummary.from_dict(data.get("summary", {})),
        )


# ---- Result types ----


@dataclass(frozen=True)
class DeletedResult:
    deleted: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeletedResult:
        return cls(deleted=bool(data.get("deleted", False)))


@dataclass(frozen=True)
class AddedResult:
    added: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AddedResult:
        return cls(added=bool(data.get("added", False)))


@dataclass(frozen=True)
class RemovedResult:
    removed: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RemovedResult:
        return cls(removed=bool(data.get("removed", False)))
