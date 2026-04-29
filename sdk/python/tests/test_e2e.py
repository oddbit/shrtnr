# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0
#
# End-to-end tests run by scripts/test-sdks-e2e.sh against a live
# `wrangler dev` instance. Requires:
#   SHRTNR_TEST_URL        base URL of the running dev server
#   SHRTNR_TEST_API_KEY    a create+read API key minted by the harness
#
# Default `pytest` excludes this file via addopts = "-m 'not e2e'" in
# pyproject.toml. The harness runs `pytest -m e2e` explicitly.
# If either env var is missing the tests skip with a clear message so
# a misconfigured run doesn't silently pass.

from __future__ import annotations

import os

import pytest

from shrtnr import AsyncShrtnr, Shrtnr

BASE_URL = os.environ.get("SHRTNR_TEST_URL")
API_KEY = os.environ.get("SHRTNR_TEST_API_KEY")

_MISSING = "SHRTNR_TEST_URL and SHRTNR_TEST_API_KEY must be set. Run e2e tests via scripts/test-sdks-e2e.sh from the repo root, not directly."


# ---------------------------------------------------------------------------
# Sync client
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def client() -> Shrtnr:
    if not BASE_URL or not API_KEY:
        pytest.skip(_MISSING)
    return Shrtnr(base_url=BASE_URL, api_key=API_KEY)


@pytest.mark.e2e
def test_link_lifecycle(client: Shrtnr) -> None:
    """Create, get, and delete a link against the live server."""
    link = client.links.create(url="https://example.com/py-e2e", label="py-e2e")
    assert link.url == "https://example.com/py-e2e"
    fetched = client.links.get(link.id)
    assert fetched.id == link.id
    result = client.links.delete(link.id)
    assert result.deleted is True


@pytest.mark.e2e
def test_links_list(client: Shrtnr) -> None:
    """Create a link, confirm it appears in list, then clean up."""
    link = client.links.create(url="https://example.com/py-e2e-list")
    try:
        links = client.links.list()
        assert any(lnk.id == link.id for lnk in links)
    finally:
        client.links.delete(link.id)


@pytest.mark.e2e
def test_slug_mutations(client: Shrtnr) -> None:
    """Add, disable, enable, and remove a slug against live routes."""
    link = client.links.create(url="https://example.com/py-slugs")
    try:
        client.slugs.add(link.id, "py-e2e-slug")
        disabled = client.slugs.disable(link.id, "py-e2e-slug")
        assert disabled.disabled_at is not None
        enabled = client.slugs.enable(link.id, "py-e2e-slug")
        assert enabled.disabled_at is None
        removed = client.slugs.remove(link.id, "py-e2e-slug")
        assert removed.removed is True
    finally:
        client.links.delete(link.id)


@pytest.mark.e2e
def test_bundle_lifecycle(client: Shrtnr) -> None:
    """Create, archive, and delete a bundle against the live server."""
    bundle = client.bundles.create(name="py e2e bundle")
    assert bundle.name == "py e2e bundle"
    archived = client.bundles.archive(bundle.id)
    assert archived.archived_at is not None
    result = client.bundles.delete(bundle.id)
    assert result.deleted is True


# ---------------------------------------------------------------------------
# Async client
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def async_client() -> AsyncShrtnr:
    if not BASE_URL or not API_KEY:
        pytest.skip(_MISSING)
    return AsyncShrtnr(base_url=BASE_URL, api_key=API_KEY)


@pytest.mark.e2e
async def test_async_link_lifecycle(async_client: AsyncShrtnr) -> None:
    """Create, get, and delete a link using the async client."""
    link = await async_client.links.create(url="https://example.com/py-async-e2e", label="py-async-e2e")
    assert link.url == "https://example.com/py-async-e2e"
    fetched = await async_client.links.get(link.id)
    assert fetched.id == link.id
    result = await async_client.links.delete(link.id)
    assert result.deleted is True


@pytest.mark.e2e
async def test_async_bundle_lifecycle(async_client: AsyncShrtnr) -> None:
    """Create, archive, and delete a bundle using the async client."""
    bundle = await async_client.bundles.create(name="py async e2e bundle")
    assert bundle.name == "py async e2e bundle"
    archived = await async_client.bundles.archive(bundle.id)
    assert archived.archived_at is not None
    result = await async_client.bundles.delete(bundle.id)
    assert result.deleted is True
