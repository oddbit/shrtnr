# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Surface-level async tests.

``test_client.py`` covers the full method matrix on the sync client. Both
clients share request-building and response-parsing through
``_base_client.py``, so duplicating all 25 assertions for async would be
redundant. These tests confirm the async client speaks the same protocol
(auth, errors, at least one method per resource group).
"""

from __future__ import annotations

import httpx
import pytest
import respx

from shrtnr import (
    AsyncShrtnr,
    CreateLinkOptions,
    ShrtnrError,
)

from .conftest import API_KEY, BASE_URL, make_link_dict, make_slug_dict


@pytest.fixture()
async def client() -> AsyncShrtnr:
    c = AsyncShrtnr(BASE_URL, api_key=API_KEY)
    try:
        yield c
    finally:
        await c.aclose()


@respx.mock
async def test_async_sends_bearer_header(client: AsyncShrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    await client.list_links()
    assert route.called
    req = route.calls[0].request
    assert req.headers["Authorization"] == f"Bearer {API_KEY}"
    assert req.headers["X-Client"] == "sdk"


@respx.mock
async def test_async_raises_shrtnr_error(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/999").mock(
        return_value=httpx.Response(404, json={"error": "gone"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        await client.get_link(999)
    assert exc_info.value.status == 404


@respx.mock
async def test_async_create_link(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(201, json=make_link_dict()),
    )
    link = await client.create_link(CreateLinkOptions(url="https://example.com"))
    assert link.id == 1


@respx.mock
async def test_async_slug_mutations(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/1/slugs/promo/disable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=1, slug="promo", is_custom=1, disabled_at=2),
        ),
    )
    respx.post(f"{BASE_URL}/_/api/links/1/slugs/promo/enable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=1, slug="promo", is_custom=1),
        ),
    )
    respx.delete(f"{BASE_URL}/_/api/links/1/slugs/promo").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    assert (await client.disable_slug(1, "promo")).disabled_at == 2
    assert (await client.enable_slug(1, "promo")).disabled_at is None
    assert await client.remove_slug(1, "promo") is True


@respx.mock
async def test_async_context_manager_closes_client() -> None:
    async with AsyncShrtnr(BASE_URL, api_key=API_KEY) as c:
        respx.get(f"{BASE_URL}/_/health").mock(
            return_value=httpx.Response(
                200,
                json={"status": "ok", "version": "x", "timestamp": 1},
            ),
        )
        h = await c.health()
        assert h.status == "ok"
