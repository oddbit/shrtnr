# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Async client tests for the shrtnr SDK 1.0 surface.

The sync tests cover the full method matrix. These tests confirm the async
client speaks the same protocol (auth, errors, at least one method per
resource) and that context-manager teardown works.
"""

from __future__ import annotations

import httpx
import pytest
import respx

from shrtnr import AsyncShrtnr, ShrtnrError

from .conftest import (
    API_KEY,
    BASE_URL,
    make_bundle_dict,
    make_bundle_with_summary_dict,
    make_click_stats_dict,
    make_link_dict,
    make_slug_dict,
    make_timeline_dict,
)


@pytest.fixture()
async def client() -> AsyncShrtnr:
    c = AsyncShrtnr(base_url=BASE_URL, api_key=API_KEY)
    try:
        yield c
    finally:
        await c.aclose()


# ---- Auth ----


@respx.mock
async def test_async_auth_sends_bearer_header(client: AsyncShrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    await client.links.list()
    assert route.called
    assert route.calls[0].request.headers["Authorization"] == f"Bearer {API_KEY}"


# ---- Errors ----


@respx.mock
async def test_async_raises_shrtnr_error_on_404(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/999").mock(
        return_value=httpx.Response(404, json={"error": "gone"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        await client.links.get(999)
    assert exc_info.value.status == 404
    assert exc_info.value.server_message == "gone"


async def test_async_network_error_wraps_as_status_0(client: AsyncShrtnr) -> None:
    with respx.mock:
        respx.get(f"{BASE_URL}/_/api/links").mock(side_effect=httpx.ConnectError("refused"))
        with pytest.raises(ShrtnrError) as exc_info:
            await client.links.list()
        assert exc_info.value.status == 0


# ---- Links resource ----


@respx.mock
async def test_async_links_get(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/3").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=3)),
    )
    link = await client.links.get(3)
    assert link.id == 3


@respx.mock
async def test_async_links_get_with_range(client: AsyncShrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/3?range=7d").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=3)),
    )
    await client.links.get(3, range="7d")
    assert route.called


@respx.mock
async def test_async_links_list(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(200, json=[make_link_dict()]),
    )
    links = await client.links.list()
    assert len(links) == 1


@respx.mock
async def test_async_links_create(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(201, json=make_link_dict()),
    )
    link = await client.links.create(url="https://example.com")
    assert link.id == 1


@respx.mock
async def test_async_links_update(client: AsyncShrtnr) -> None:
    respx.put(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    link = await client.links.update(1, url="https://new.com")
    assert link.id == 1


@respx.mock
async def test_async_links_disable(client: AsyncShrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/disable").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    await client.links.disable(1)
    assert route.called


@respx.mock
async def test_async_links_enable(client: AsyncShrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/enable").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    await client.links.enable(1)
    assert route.called


@respx.mock
async def test_async_links_delete(client: AsyncShrtnr) -> None:
    respx.delete(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    result = await client.links.delete(1)
    assert result.deleted is True


@respx.mock
async def test_async_links_analytics(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/5/analytics").mock(
        return_value=httpx.Response(200, json=make_click_stats_dict(total_clicks=7)),
    )
    stats = await client.links.analytics(5)
    assert stats.total_clicks == 7


@respx.mock
async def test_async_links_timeline(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/5/timeline").mock(
        return_value=httpx.Response(200, json=make_timeline_dict()),
    )
    td = await client.links.timeline(5)
    assert td.range == "7d"


@respx.mock
async def test_async_links_qr(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/5/qr").mock(
        return_value=httpx.Response(200, text="<svg/>"),
    )
    svg = await client.links.qr(5)
    assert "<svg" in svg


@respx.mock
async def test_async_links_bundles(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/7/bundles").mock(
        return_value=httpx.Response(200, json=[make_bundle_dict()]),
    )
    bundles = await client.links.bundles(7)
    assert len(bundles) == 1


# ---- Slugs resource ----


@respx.mock
async def test_async_slugs_lookup(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/slugs/promo").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    link = await client.slugs.lookup("promo")
    assert link.id == 1


@respx.mock
async def test_async_slugs_add(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/1/slugs").mock(
        return_value=httpx.Response(201, json=make_slug_dict(link_id=1, slug="promo", is_custom=1)),
    )
    slug = await client.slugs.add(1, "promo")
    assert slug.slug == "promo"


@respx.mock
async def test_async_slugs_disable(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/1/slugs/promo/disable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=1, slug="promo", is_custom=1, disabled_at=2),
        ),
    )
    slug = await client.slugs.disable(1, "promo")
    assert slug.disabled_at == 2


@respx.mock
async def test_async_slugs_enable(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/1/slugs/promo/enable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=1, slug="promo", is_custom=1),
        ),
    )
    slug = await client.slugs.enable(1, "promo")
    assert slug.disabled_at is None


@respx.mock
async def test_async_slugs_remove(client: AsyncShrtnr) -> None:
    respx.delete(f"{BASE_URL}/_/api/links/1/slugs/promo").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    result = await client.slugs.remove(1, "promo")
    assert result.removed is True


# ---- Bundles resource ----


@respx.mock
async def test_async_bundles_get(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_with_summary_dict()),
    )
    b = await client.bundles.get(42)
    assert b.id == 42


@respx.mock
async def test_async_bundles_list(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/bundles").mock(
        return_value=httpx.Response(200, json=[make_bundle_with_summary_dict()]),
    )
    bundles = await client.bundles.list()
    assert len(bundles) == 1


@respx.mock
async def test_async_bundles_create(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/bundles").mock(
        return_value=httpx.Response(201, json=make_bundle_dict(name="Async B")),
    )
    b = await client.bundles.create(name="Async B")
    assert b.name == "Async B"


@respx.mock
async def test_async_bundles_update(client: AsyncShrtnr) -> None:
    respx.put(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    b = await client.bundles.update(42, name="Renamed")
    assert b.id == 42


@respx.mock
async def test_async_bundles_delete(client: AsyncShrtnr) -> None:
    respx.delete(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    result = await client.bundles.delete(42)
    assert result.deleted is True


@respx.mock
async def test_async_bundles_archive(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/bundles/42/archive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(archived_at=1)),
    )
    b = await client.bundles.archive(42)
    assert b.archived_at == 1


@respx.mock
async def test_async_bundles_unarchive(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/bundles/42/unarchive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    b = await client.bundles.unarchive(42)
    assert b.archived_at is None


@respx.mock
async def test_async_bundles_analytics(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/bundles/42/analytics").mock(
        return_value=httpx.Response(200, json=make_click_stats_dict(total_clicks=5)),
    )
    stats = await client.bundles.analytics(42)
    assert stats.total_clicks == 5


@respx.mock
async def test_async_bundles_links(client: AsyncShrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json=[make_link_dict()]),
    )
    links = await client.bundles.links(42)
    assert len(links) == 1


@respx.mock
async def test_async_bundles_add_link(client: AsyncShrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json={"added": True}),
    )
    result = await client.bundles.add_link(42, 7)
    assert result.added is True


@respx.mock
async def test_async_bundles_remove_link(client: AsyncShrtnr) -> None:
    respx.delete(f"{BASE_URL}/_/api/bundles/42/links/7").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    result = await client.bundles.remove_link(42, 7)
    assert result.removed is True


# ---- Context manager ----


@respx.mock
async def test_async_context_manager_closes_client() -> None:
    async with AsyncShrtnr(base_url=BASE_URL, api_key=API_KEY) as c:
        respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
        await c.links.list()
