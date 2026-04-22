# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Python SDK for the shrtnr URL shortener API.

Exposes a synchronous :class:`Shrtnr` and asynchronous :class:`AsyncShrtnr`
client with identical method surfaces. See README.md for usage.
"""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

from .async_client import AsyncShrtnr
from .client import Shrtnr
from .errors import ShrtnrError
from .models import (
    Bundle,
    BundleAccent,
    BundleStats,
    BundleStatsPerLink,
    BundleTopCountry,
    BundleTopLink,
    BundleTopPerformer,
    BundleWithSummary,
    ClickStats,
    CreateBundleOptions,
    CreateLinkOptions,
    DateCount,
    HealthStatus,
    Link,
    NameCount,
    Slug,
    SlugCount,
    TimelineBucket,
    TimelineData,
    TimelineRange,
    TimelineSummary,
    UpdateBundleOptions,
    UpdateLinkOptions,
)

# Derive __version__ from installed package metadata so pyproject.toml is
# the single source of truth. Falls back when running from a source tree
# that has not been installed (e.g. scratch checkouts).
try:
    __version__ = _pkg_version("shrtnr")
except PackageNotFoundError:
    __version__ = "0.0.0+unknown"

__all__ = [
    "AsyncShrtnr",
    "Bundle",
    "BundleAccent",
    "BundleStats",
    "BundleStatsPerLink",
    "BundleTopCountry",
    "BundleTopLink",
    "BundleTopPerformer",
    "BundleWithSummary",
    "ClickStats",
    "CreateBundleOptions",
    "CreateLinkOptions",
    "DateCount",
    "HealthStatus",
    "Link",
    "NameCount",
    "Shrtnr",
    "ShrtnrError",
    "Slug",
    "SlugCount",
    "TimelineBucket",
    "TimelineData",
    "TimelineRange",
    "TimelineSummary",
    "UpdateBundleOptions",
    "UpdateLinkOptions",
    "__version__",
]
