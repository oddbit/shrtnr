# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Python SDK for the shrtnr URL shortener API.

Exposes a synchronous :class:`Shrtnr` and asynchronous :class:`AsyncShrtnr`
client. Each provides resource-grouped access via ``client.links``,
``client.slugs``, and ``client.bundles``. See README.md for usage.
"""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

from .client import AsyncShrtnr, Shrtnr
from .errors import ShrtnrError
from .models import (
    AddedResult,
    Bundle,
    BundleAccent,
    BundleTopLink,
    BundleWithSummary,
    ClickStats,
    DateCount,
    DeletedResult,
    Link,
    NameCount,
    RemovedResult,
    Slug,
    SlugCount,
    TimelineBucket,
    TimelineData,
    TimelineRange,
    TimelineSummary,
)

try:
    __version__ = _pkg_version("shrtnr")
except PackageNotFoundError:
    __version__ = "0.0.0+unknown"

__all__ = [
    "AddedResult",
    "AsyncShrtnr",
    "Bundle",
    "BundleAccent",
    "BundleTopLink",
    "BundleWithSummary",
    "ClickStats",
    "DateCount",
    "DeletedResult",
    "Link",
    "NameCount",
    "RemovedResult",
    "Shrtnr",
    "ShrtnrError",
    "Slug",
    "SlugCount",
    "TimelineBucket",
    "TimelineData",
    "TimelineRange",
    "TimelineSummary",
    "__version__",
]
