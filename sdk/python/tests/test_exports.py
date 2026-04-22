# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Public surface check: every name in README `API Reference` must be exported."""

from __future__ import annotations

import shrtnr


def test_client_classes_exported() -> None:
    assert hasattr(shrtnr, "Shrtnr")
    assert hasattr(shrtnr, "AsyncShrtnr")
    assert hasattr(shrtnr, "ShrtnrError")


def test_models_exported() -> None:
    for name in (
        "Bundle",
        "BundleStats",
        "BundleStatsPerLink",
        "BundleWithSummary",
        "ClickStats",
        "CreateBundleOptions",
        "CreateLinkOptions",
        "HealthStatus",
        "Link",
        "Slug",
        "UpdateBundleOptions",
        "UpdateLinkOptions",
    ):
        assert hasattr(shrtnr, name), f"missing export: {name}"


def test_version_declared() -> None:
    assert isinstance(shrtnr.__version__, str)
    assert shrtnr.__version__ == "0.1.0"


def test_all_matches_module_contents() -> None:
    for name in shrtnr.__all__:
        assert hasattr(shrtnr, name), f"__all__ lists missing attribute {name}"


SYNC_METHODS = {
    "health",
    "create_link",
    "list_links",
    "get_link",
    "update_link",
    "disable_link",
    "enable_link",
    "delete_link",
    "list_links_by_owner",
    "add_custom_slug",
    "disable_slug",
    "enable_slug",
    "remove_slug",
    "get_link_by_slug",
    "get_link_analytics",
    "get_link_qr",
    "create_bundle",
    "list_bundles",
    "get_bundle",
    "update_bundle",
    "delete_bundle",
    "archive_bundle",
    "unarchive_bundle",
    "get_bundle_analytics",
    "list_bundle_links",
    "add_link_to_bundle",
    "remove_link_from_bundle",
    "list_bundles_for_link",
}


def test_sync_client_exposes_every_sdk_method() -> None:
    for method in SYNC_METHODS:
        assert hasattr(shrtnr.Shrtnr, method), f"Shrtnr is missing {method}"


def test_async_client_exposes_every_sdk_method() -> None:
    for method in SYNC_METHODS:
        assert hasattr(shrtnr.AsyncShrtnr, method), f"AsyncShrtnr is missing {method}"
