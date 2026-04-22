# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Unit tests for the synchronous Shrtnr client.

Every test uses ``respx`` to mock httpx transport, so the SDK never hits the
network. Coverage includes auth headers, error shape, each method's URL +
method + body, and the error mapping for non-2xx responses.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
import respx

from shrtnr import (
    CreateBundleOptions,
    CreateLinkOptions,
    Shrtnr,
    ShrtnrError,
    UpdateBundleOptions,
    UpdateLinkOptions,
)

from .conftest import API_KEY, BASE_URL, make_bundle_dict, make_link_dict, make_slug_dict


@pytest.fixture()
def client() -> Shrtnr:
    return Shrtnr(BASE_URL, api_key=API_KEY)


# ---- auth + error handling ----


@respx.mock
def test_sends_bearer_token_and_sdk_client_header(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    client.list_links()
    assert route.called
    req = route.calls[0].request
    assert req.headers["Authorization"] == f"Bearer {API_KEY}"
    assert req.headers["X-Client"] == "sdk"


@respx.mock
def test_raises_shrtnr_error_with_body_message(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/999").mock(
        return_value=httpx.Response(404, json={"error": "Link not found"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        client.get_link(999)
    assert exc_info.value.status == 404
    assert str(exc_info.value) == "Link not found"
    assert exc_info.value.body == {"error": "Link not found"}


@respx.mock
def test_raises_shrtnr_error_with_fallback_message(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/999").mock(
        return_value=httpx.Response(500, text="server down"),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        client.get_link(999)
    assert exc_info.value.status == 500
    assert str(exc_info.value) == "HTTP 500"


# ---- health ----


@respx.mock
def test_health(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/health").mock(
        return_value=httpx.Response(
            200,
            json={"status": "ok", "version": "0.31.2", "timestamp": 1700000000},
        ),
    )
    result = client.health()
    assert result.status == "ok"
    assert result.version == "0.31.2"


# ---- links ----


@respx.mock
def test_create_link_posts_options(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(201, json=make_link_dict(url="https://example.com/new")),
    )
    link = client.create_link(CreateLinkOptions(url="https://example.com/new", label="N"))
    assert route.called
    body = json.loads(route.calls[0].request.content)
    assert body == {"url": "https://example.com/new", "label": "N"}
    assert link.url == "https://example.com/new"


@respx.mock
def test_list_links(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(
            200, json=[make_link_dict(link_id=1), make_link_dict(link_id=2)]
        ),
    )
    links = client.list_links()
    assert [link.id for link in links] == [1, 2]


@respx.mock
def test_get_link(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/7").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=7)),
    )
    link = client.get_link(7)
    assert link.id == 7


@respx.mock
def test_update_link_omits_unset_and_sends_explicit_null(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/links/7").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=7, label="X")),
    )
    client.update_link(7, UpdateLinkOptions(label="X", expires_at=None))
    # 'url' was not set: absent. 'expires_at' was explicitly None: present as null.
    body = json.loads(route.calls[0].request.content)
    assert body == {"label": "X", "expires_at": None}


@respx.mock
def test_disable_enable_delete_link(client: Shrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/7/disable").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=7, expires_at=1)),
    )
    respx.post(f"{BASE_URL}/_/api/links/7/enable").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=7)),
    )
    respx.delete(f"{BASE_URL}/_/api/links/7").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    assert client.disable_link(7).expires_at == 1
    assert client.enable_link(7).expires_at is None
    assert client.delete_link(7) is True


@respx.mock
def test_list_links_by_owner_encodes_owner(client: Shrtnr) -> None:
    route = respx.get(url__regex=rf"^{BASE_URL}/_/api/links\?owner=user%40example\.com$").mock(
        return_value=httpx.Response(200, json=[]),
    )
    result = client.list_links_by_owner("user@example.com")
    assert route.called
    assert result == []


# ---- slugs ----


@respx.mock
def test_add_custom_slug(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/7/slugs").mock(
        return_value=httpx.Response(201, json=make_slug_dict(link_id=7, slug="promo", is_custom=1)),
    )
    slug = client.add_custom_slug(7, "promo")
    assert json.loads(route.calls[0].request.content) == {"slug": "promo"}
    assert slug.slug == "promo"
    assert slug.is_custom == 1


@respx.mock
def test_disable_enable_remove_slug_hit_public_routes(client: Shrtnr) -> None:
    """Regression guard: these routes exist under /_/api/*, not only /_/admin/api/*."""
    respx.post(f"{BASE_URL}/_/api/links/7/slugs/promo/disable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=7, slug="promo", is_custom=1, disabled_at=1700000001),
        ),
    )
    respx.post(f"{BASE_URL}/_/api/links/7/slugs/promo/enable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=7, slug="promo", is_custom=1),
        ),
    )
    respx.delete(f"{BASE_URL}/_/api/links/7/slugs/promo").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    assert client.disable_slug(7, "promo").disabled_at == 1700000001
    assert client.enable_slug(7, "promo").disabled_at is None
    assert client.remove_slug(7, "promo") is True


@respx.mock
def test_slug_with_reserved_characters_is_percent_encoded(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/7/slugs/a%2Fb/disable").mock(
        return_value=httpx.Response(
            200,
            json=make_slug_dict(link_id=7, slug="a/b", is_custom=1),
        ),
    )
    client.disable_slug(7, "a/b")
    assert route.called


@respx.mock
def test_get_link_by_slug(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/slugs/promo").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    link = client.get_link_by_slug("promo")
    assert link.id == 1


# ---- analytics + qr ----


@respx.mock
def test_get_link_analytics(client: Shrtnr) -> None:
    payload: dict[str, Any] = {
        "total_clicks": 4,
        "countries": [{"name": "SE", "count": 2}],
        "referrers": [],
        "referrer_hosts": [{"name": "example.com", "count": 4}],
        "devices": [{"name": "desktop", "count": 4}],
        "os": [{"name": "macos", "count": 4}],
        "browsers": [{"name": "chrome", "count": 4}],
        "link_modes": [{"name": "link", "count": 4}],
        "channels": [],
        "clicks_over_time": [{"date": "2026-04-22", "count": 4}],
        "slug_clicks": [{"slug": "auto", "count": 4}],
        "num_countries": 1,
        "num_referrers": 0,
        "num_referrer_hosts": 1,
        "num_os": 1,
        "num_browsers": 1,
    }
    respx.get(f"{BASE_URL}/_/api/links/7/analytics").mock(
        return_value=httpx.Response(200, json=payload),
    )
    stats = client.get_link_analytics(7)
    assert stats.total_clicks == 4
    assert stats.countries[0].name == "SE"
    assert stats.num_referrer_hosts == 1


@respx.mock
def test_get_link_qr_returns_svg_text(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/7/qr").mock(
        return_value=httpx.Response(
            200,
            text="<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            headers={"Content-Type": "image/svg+xml"},
        ),
    )
    svg = client.get_link_qr(7)
    assert svg.startswith("<svg")


@respx.mock
def test_get_link_qr_with_slug_query_param(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/7/qr?slug=custom").mock(
        return_value=httpx.Response(200, text="<svg/>"),
    )
    client.get_link_qr(7, slug="custom")
    assert route.called


# ---- bundles ----


@respx.mock
def test_create_bundle(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles").mock(
        return_value=httpx.Response(201, json=make_bundle_dict(name="C")),
    )
    bundle = client.create_bundle(CreateBundleOptions(name="C", accent="blue"))
    assert bundle.name == "C"
    body = json.loads(route.calls[0].request.content)
    assert body == {"name": "C", "accent": "blue"}


@respx.mock
def test_list_bundles_default(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles", params={}).mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    **make_bundle_dict(),
                    "link_count": 3,
                    "total_clicks": 10,
                    "sparkline": [1, 2, 7],
                    "top_links": [{"slug": "auto", "click_count": 7}],
                },
            ],
        ),
    )
    bundles = client.list_bundles()
    assert route.called
    assert bundles[0].link_count == 3


@respx.mock
def test_list_bundles_archived_sends_archived_all(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles", params={"archived": "all"}).mock(
        return_value=httpx.Response(200, json=[]),
    )
    client.list_bundles(archived=True)
    assert route.called


@respx.mock
def test_get_update_archive_unarchive_delete_bundle(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    respx.put(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(description="edited")),
    )
    respx.post(f"{BASE_URL}/_/api/bundles/42/archive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(archived_at=1700000001)),
    )
    respx.post(f"{BASE_URL}/_/api/bundles/42/unarchive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    respx.delete(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    assert client.get_bundle(42).id == 42
    assert (
        client.update_bundle(42, UpdateBundleOptions(description="edited")).description == "edited"
    )
    assert client.archive_bundle(42).archived_at == 1700000001
    assert client.unarchive_bundle(42).archived_at is None
    assert client.delete_bundle(42) is True


@respx.mock
def test_bundle_analytics_sends_range_query(client: Shrtnr) -> None:
    payload = {
        "bundle": make_bundle_dict(),
        "link_count": 1,
        "total_clicks": 0,
        "clicked_links": 0,
        "countries_reached": 0,
        "timeline": {
            "range": "7d",
            "buckets": [],
            "summary": {
                "last_24h": 0,
                "last_7d": 0,
                "last_30d": 0,
                "last_90d": 0,
                "last_1y": 0,
            },
        },
        "countries": [],
        "devices": [],
        "os": [],
        "browsers": [],
        "referrers": [],
        "referrer_hosts": [],
        "link_modes": [],
        "per_link": [],
    }
    route = respx.get(f"{BASE_URL}/_/api/bundles/42/analytics?range=7d").mock(
        return_value=httpx.Response(200, json=payload),
    )
    stats = client.get_bundle_analytics(42, range="7d")
    assert route.called
    assert stats.bundle.id == 42


@respx.mock
def test_bundle_membership(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json=[make_link_dict()]),
    )
    respx.post(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json={"added": True}),
    )
    respx.delete(f"{BASE_URL}/_/api/bundles/42/links/1").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    respx.get(f"{BASE_URL}/_/api/links/1/bundles").mock(
        return_value=httpx.Response(200, json=[make_bundle_dict()]),
    )
    assert client.list_bundle_links(42)[0].id == 1
    assert client.add_link_to_bundle(42, 1) is True
    assert client.remove_link_from_bundle(42, 1) is True
    assert client.list_bundles_for_link(1)[0].id == 42
