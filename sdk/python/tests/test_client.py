# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Sync client tests for the shrtnr SDK 1.0 surface.

Covers all 27 resource methods plus auth, errors, and URL edge cases.
"""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from shrtnr import Shrtnr, ShrtnrError
from shrtnr.models import Bundle, BundleWithSummary

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
def client() -> Shrtnr:
    return Shrtnr(base_url=BASE_URL, api_key=API_KEY)


# ---- Auth ----


@respx.mock
def test_auth_sends_bearer_header(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    client.links.list()
    req = route.calls[0].request
    assert req.headers["Authorization"] == f"Bearer {API_KEY}"


# ---- Error handling ----


@respx.mock
def test_error_on_404(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/999").mock(
        return_value=httpx.Response(404, json={"error": "Link not found"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        client.links.get(999)
    assert exc_info.value.status == 404
    assert exc_info.value.server_message == "Link not found"


@respx.mock
def test_error_on_401(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(401, json={"error": "Unauthorized"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        client.links.list()
    assert exc_info.value.status == 401


@respx.mock
def test_error_on_400_with_server_message(client: Shrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/1/slugs").mock(
        return_value=httpx.Response(409, json={"error": "Slug already exists"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        client.slugs.add(1, "taken")
    assert exc_info.value.status == 409
    assert exc_info.value.server_message == "Slug already exists"
    assert "409" in str(exc_info.value)


def test_network_error_wraps_as_status_0(client: Shrtnr) -> None:
    with respx.mock:
        respx.get(f"{BASE_URL}/_/api/links").mock(side_effect=httpx.ConnectError("refused"))
        with pytest.raises(ShrtnrError) as exc_info:
            client.links.list()
        assert exc_info.value.status == 0


# ---- Base URL normalization ----


@respx.mock
def test_base_url_strips_trailing_slash() -> None:
    c = Shrtnr(base_url=f"{BASE_URL}/", api_key=API_KEY)
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    c.links.list()
    assert route.called


# ---- links.get ----


@respx.mock
def test_links_get(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/3").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=3)),
    )
    link = client.links.get(3)
    assert link.id == 3
    assert route.calls[0].request.method == "GET"


@respx.mock
def test_links_get_with_range(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/3?range=7d").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=3)),
    )
    client.links.get(3, range="7d")
    assert route.called


@respx.mock
def test_links_get_no_range_param_when_none(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/3").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=3)),
    )
    client.links.get(3)
    assert "range" not in str(route.calls[0].request.url)


# ---- links.list ----


@respx.mock
def test_links_list(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(200, json=[make_link_dict()]),
    )
    links = client.links.list()
    assert len(links) == 1
    assert route.called


@respx.mock
def test_links_list_with_owner_and_range(client: Shrtnr) -> None:
    route = respx.get(
        url__regex=rf"^{BASE_URL}/_/api/links\?",
    ).mock(return_value=httpx.Response(200, json=[]))
    client.links.list(owner="user@example.com", range="30d")
    url = str(route.calls[0].request.url)
    assert "owner=user%40example.com" in url
    assert "range=30d" in url


# ---- links.create ----


@respx.mock
def test_links_create(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(201, json=make_link_dict(url="https://example.com", label="L")),
    )
    client.links.create(url="https://example.com", label="L")
    body = json.loads(route.calls[0].request.content)
    assert body["url"] == "https://example.com"
    assert body["label"] == "L"


# ---- links.update ----


@respx.mock
def test_links_update(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.links.update(1, url="https://new.com")
    body = json.loads(route.calls[0].request.content)
    assert body == {"url": "https://new.com"}


@respx.mock
def test_links_update_clears_label_with_none(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.links.update(1, label=None)
    body = json.loads(route.calls[0].request.content)
    assert "label" in body
    assert body["label"] is None


@respx.mock
def test_links_update_omits_label_when_not_provided(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.links.update(1, url="https://new.com")
    body = json.loads(route.calls[0].request.content)
    assert "label" not in body


@respx.mock
def test_links_update_clears_expires_at_with_none(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.links.update(1, expires_at=None)
    body = json.loads(route.calls[0].request.content)
    assert "expires_at" in body
    assert body["expires_at"] is None


# ---- links.disable ----


@respx.mock
def test_links_disable(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/disable").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.links.disable(1)
    assert route.calls[0].request.method == "POST"


# ---- links.enable ----


@respx.mock
def test_links_enable(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/enable").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.links.enable(1)
    assert route.calls[0].request.method == "POST"


# ---- links.delete ----


@respx.mock
def test_links_delete(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    result = client.links.delete(1)
    assert result.deleted is True
    assert route.calls[0].request.method == "DELETE"


# ---- links.analytics ----


@respx.mock
def test_links_analytics(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/analytics").mock(
        return_value=httpx.Response(200, json=make_click_stats_dict(total_clicks=42)),
    )
    stats = client.links.analytics(5)
    assert stats.total_clicks == 42
    assert route.called


@respx.mock
def test_links_analytics_with_range(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/analytics?range=7d").mock(
        return_value=httpx.Response(200, json=make_click_stats_dict()),
    )
    client.links.analytics(5, range="7d")
    assert route.called


# ---- links.timeline ----


@respx.mock
def test_links_timeline(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/timeline").mock(
        return_value=httpx.Response(200, json=make_timeline_dict(range="7d")),
    )
    td = client.links.timeline(5)
    assert td.range == "7d"
    assert route.called


@respx.mock
def test_links_timeline_with_range(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/timeline?range=30d").mock(
        return_value=httpx.Response(200, json=make_timeline_dict(range="30d")),
    )
    client.links.timeline(5, range="30d")
    assert route.called


# ---- links.qr ----


@respx.mock
def test_links_qr(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/qr").mock(
        return_value=httpx.Response(
            200,
            text="<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            headers={"Content-Type": "image/svg+xml"},
        ),
    )
    svg = client.links.qr(5)
    assert svg.startswith("<svg")
    assert route.called


@respx.mock
def test_links_qr_with_slug_and_size(client: Shrtnr) -> None:
    route = respx.get(url__regex=rf"^{BASE_URL}/_/api/links/5/qr\?").mock(
        return_value=httpx.Response(200, text="<svg/>"),
    )
    client.links.qr(5, slug="promo", size="200")
    url = str(route.calls[0].request.url)
    assert "slug=promo" in url
    assert "size=200" in url


# ---- links.bundles ----


@respx.mock
def test_links_bundles(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/7/bundles").mock(
        return_value=httpx.Response(200, json=[make_bundle_dict()]),
    )
    bundles = client.links.bundles(7)
    assert len(bundles) == 1
    assert route.called


# ---- slugs.lookup ----


@respx.mock
def test_slugs_lookup(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/slugs/find-me").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    link = client.slugs.lookup("find-me")
    assert link.id == 1
    assert route.called


@respx.mock
def test_slugs_lookup_url_encodes_reserved_chars(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/slugs/foo%2Fbar").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    client.slugs.lookup("foo/bar")
    assert route.called


# ---- slugs.add ----


@respx.mock
def test_slugs_add(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/slugs").mock(
        return_value=httpx.Response(
            201, json=make_slug_dict(link_id=1, slug="custom", is_custom=1)
        ),
    )
    slug = client.slugs.add(1, "custom")
    assert slug.slug == "custom"
    body = json.loads(route.calls[0].request.content)
    assert body == {"slug": "custom"}


# ---- slugs.disable ----


@respx.mock
def test_slugs_disable(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/slugs/abc/disable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=1, slug="abc", is_custom=1, disabled_at=1),
        ),
    )
    slug = client.slugs.disable(1, "abc")
    assert slug.disabled_at == 1
    assert route.calls[0].request.method == "POST"


# ---- slugs.enable ----


@respx.mock
def test_slugs_enable(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/slugs/abc/enable").mock(
        return_value=httpx.Response(200, json=make_slug_dict(link_id=1, slug="abc", is_custom=1)),
    )
    slug = client.slugs.enable(1, "abc")
    assert slug.disabled_at is None
    assert route.calls[0].request.method == "POST"


# ---- slugs.remove ----


@respx.mock
def test_slugs_remove(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/links/1/slugs/abc").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    result = client.slugs.remove(1, "abc")
    assert result.removed is True
    assert route.calls[0].request.method == "DELETE"


# ---- bundles.get ----


@respx.mock
def test_bundles_get(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_with_summary_dict()),
    )
    b = client.bundles.get(42)
    assert b.id == 42
    assert route.calls[0].request.method == "GET"


@respx.mock
def test_bundles_get_with_range(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42?range=7d").mock(
        return_value=httpx.Response(200, json=make_bundle_with_summary_dict()),
    )
    client.bundles.get(42, range="7d")
    assert route.called


# ---- bundles.list ----


@respx.mock
def test_bundles_list(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles").mock(
        return_value=httpx.Response(200, json=[make_bundle_with_summary_dict()]),
    )
    bundles = client.bundles.list()
    assert len(bundles) == 1
    assert route.called


@respx.mock
def test_bundles_list_with_archived(client: Shrtnr) -> None:
    route = respx.get(
        url__regex=rf"^{BASE_URL}/_/api/bundles\?archived=all",
    ).mock(return_value=httpx.Response(200, json=[]))
    client.bundles.list(archived="all")
    assert route.called


# ---- bundles.create ----


@respx.mock
def test_bundles_create(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles").mock(
        return_value=httpx.Response(201, json=make_bundle_dict(name="B", accent="blue")),
    )
    b = client.bundles.create(name="B", accent="blue")
    assert b.name == "B"
    body = json.loads(route.calls[0].request.content)
    assert body == {"name": "B", "accent": "blue"}


# ---- bundles.update ----


@respx.mock
def test_bundles_update(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(description="edited")),
    )
    client.bundles.update(42, description="edited")
    body = json.loads(route.calls[0].request.content)
    assert body == {"description": "edited"}


@respx.mock
def test_bundles_update_clears_description_with_none(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    client.bundles.update(42, description=None)
    body = json.loads(route.calls[0].request.content)
    assert "description" in body
    assert body["description"] is None


@respx.mock
def test_bundles_update_omits_description_when_not_provided(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    client.bundles.update(42, name="New Name")
    body = json.loads(route.calls[0].request.content)
    assert "description" not in body


# ---- bundles.delete ----


@respx.mock
def test_bundles_delete(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    result = client.bundles.delete(42)
    assert result.deleted is True
    assert route.calls[0].request.method == "DELETE"


# ---- bundles.archive ----


@respx.mock
def test_bundles_archive(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles/42/archive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(archived_at=1)),
    )
    b = client.bundles.archive(42)
    assert b.archived_at == 1
    assert route.calls[0].request.method == "POST"


# ---- bundles.unarchive ----


@respx.mock
def test_bundles_unarchive(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles/42/unarchive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    client.bundles.unarchive(42)
    assert route.calls[0].request.method == "POST"


# ---- bundles.analytics ----


@respx.mock
def test_bundles_analytics(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42/analytics").mock(
        return_value=httpx.Response(200, json=make_click_stats_dict(total_clicks=99)),
    )
    stats = client.bundles.analytics(42)
    assert stats.total_clicks == 99
    assert route.called


@respx.mock
def test_bundles_analytics_with_range(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42/analytics?range=7d").mock(
        return_value=httpx.Response(200, json=make_click_stats_dict()),
    )
    client.bundles.analytics(42, range="7d")
    assert route.called


# ---- bundles.links ----


@respx.mock
def test_bundles_links(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json=[make_link_dict()]),
    )
    links = client.bundles.links(42)
    assert len(links) == 1
    assert route.called


# ---- bundles.add_link ----


@respx.mock
def test_bundles_add_link(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json={"added": True}),
    )
    result = client.bundles.add_link(42, 7)
    assert result.added is True
    body = json.loads(route.calls[0].request.content)
    assert body == {"link_id": 7}


# ---- bundles.remove_link ----


@respx.mock
def test_bundles_remove_link(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/bundles/42/links/7").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    result = client.bundles.remove_link(42, 7)
    assert result.removed is True
    assert route.calls[0].request.method == "DELETE"


# ---- Context manager ----


@respx.mock
def test_context_manager_closes_client() -> None:
    with Shrtnr(base_url=BASE_URL, api_key=API_KEY) as c:
        respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
        c.links.list()


# ---- Bundle.accent required field ----


def test_bundle_from_dict_raises_on_missing_accent() -> None:
    """Bundle.accent is required; a missing key must raise KeyError, not silently default."""
    data = {
        "id": 1,
        "name": "test",
        "description": None,
        "icon": None,
        # accent intentionally absent
        "archived_at": None,
        "created_via": None,
        "created_by": "user@example.com",
        "created_at": 1000000,
        "updated_at": 1000000,
    }
    with pytest.raises(KeyError):
        Bundle.from_dict(data)


def test_bundle_with_summary_from_dict_raises_on_missing_accent() -> None:
    """BundleWithSummary.accent is required; a missing key must raise KeyError."""
    data = {
        "id": 1,
        "name": "test",
        "description": None,
        "icon": None,
        # accent intentionally absent
        "archived_at": None,
        "created_via": None,
        "created_by": "user@example.com",
        "created_at": 1000000,
        "updated_at": 1000000,
        "link_count": 0,
        "total_clicks": 0,
        "sparkline": [],
        "top_links": [],
    }
    with pytest.raises(KeyError):
        BundleWithSummary.from_dict(data)
