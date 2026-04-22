# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Shared fixtures for the shrtnr SDK test suite."""

from __future__ import annotations

from typing import Any

import pytest

BASE_URL = "https://shrtnr.test"
API_KEY = "sk_testkeytestkeytestkeytestkeytestkeytestkeytestkey"


def make_slug_dict(
    *,
    link_id: int = 1,
    slug: str = "auto",
    is_custom: int = 0,
    is_primary: int = 1,
    click_count: int = 0,
    created_at: int = 1700000000,
    disabled_at: int | None = None,
) -> dict[str, Any]:
    return {
        "link_id": link_id,
        "slug": slug,
        "is_custom": is_custom,
        "is_primary": is_primary,
        "click_count": click_count,
        "created_at": created_at,
        "disabled_at": disabled_at,
    }


def make_link_dict(
    *,
    link_id: int = 1,
    url: str = "https://example.com",
    label: str | None = None,
    created_at: int = 1700000000,
    expires_at: int | None = None,
    created_via: str | None = "sdk",
    created_by: str = "owner@example.com",
    slugs: list[dict[str, Any]] | None = None,
    total_clicks: int = 0,
) -> dict[str, Any]:
    return {
        "id": link_id,
        "url": url,
        "label": label,
        "created_at": created_at,
        "expires_at": expires_at,
        "created_via": created_via,
        "created_by": created_by,
        "slugs": slugs if slugs is not None else [make_slug_dict(link_id=link_id, slug="auto")],
        "total_clicks": total_clicks,
    }


def make_bundle_dict(
    *,
    bundle_id: int = 42,
    name: str = "Campaign",
    description: str | None = None,
    icon: str | None = None,
    accent: str = "orange",
    archived_at: int | None = None,
    created_via: str | None = "sdk",
    created_by: str = "owner@example.com",
    created_at: int = 1700000000,
    updated_at: int = 1700000000,
) -> dict[str, Any]:
    return {
        "id": bundle_id,
        "name": name,
        "description": description,
        "icon": icon,
        "accent": accent,
        "archived_at": archived_at,
        "created_via": created_via,
        "created_by": created_by,
        "created_at": created_at,
        "updated_at": updated_at,
    }


@pytest.fixture()
def base_url() -> str:
    return BASE_URL


@pytest.fixture()
def api_key() -> str:
    return API_KEY
