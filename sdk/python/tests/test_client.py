# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Canonical SDK unit test layout — MUST stay structurally identical to
sdk/typescript/src/__tests__/client.test.ts and
sdk/dart/test/client_test.dart: same describe/group blocks, same order,
same test count, same names. When adding a new public method, add a
matching test here AND in the other two SDKs. See CLAUDE.md "SDK parity".
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


# ---- 1. Auth headers ----


@respx.mock
def test_auth_sends_bearer_and_x_client_header(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    client.list_links()
    req = route.calls[0].request
    assert req.headers["Authorization"] == f"Bearer {API_KEY}"
    assert req.headers["X-Client"] == "sdk"


# ---- 2. Error handling ----


@respx.mock
def test_error_throws_shrtnr_error_on_non_2xx(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links/999").mock(
        return_value=httpx.Response(404, json={"error": "Link not found"}),
    )
    with pytest.raises(ShrtnrError):
        client.get_link(999)


@respx.mock
def test_error_includes_status_and_message(client: Shrtnr) -> None:
    respx.post(f"{BASE_URL}/_/api/links/1/slugs").mock(
        return_value=httpx.Response(409, json={"error": "Slug already exists"}),
    )
    with pytest.raises(ShrtnrError) as exc_info:
        client.add_custom_slug(1, "taken")
    assert exc_info.value.status == 409
    assert str(exc_info.value) == "Slug already exists"


@respx.mock
def test_error_throws_shrtnr_error_on_401(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(401, json={"error": "Unauthorized"}),
    )
    with pytest.raises(ShrtnrError):
        client.list_links()


# ---- 3. health ----


@respx.mock
def test_health(client: Shrtnr) -> None:
    respx.get(f"{BASE_URL}/_/health").mock(
        return_value=httpx.Response(200, json={"status": "ok", "version": "0.1.0", "timestamp": 1}),
    )
    h = client.health()
    assert h.status == "ok"


# ---- 4. create_link ----


@respx.mock
def test_create_link(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links").mock(
        return_value=httpx.Response(201, json=make_link_dict(url="https://example.com", label="L")),
    )
    client.create_link(CreateLinkOptions(url="https://example.com", label="L"))
    body = json.loads(route.calls[0].request.content)
    assert body == {"url": "https://example.com", "label": "L"}


# ---- 5. list_links ----


@respx.mock
def test_list_links(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    client.list_links()
    assert route.calls[0].request.method == "GET"


# ---- 6. get_link ----


@respx.mock
def test_get_link(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/3").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=3)),
    )
    client.get_link(3)
    assert route.calls[0].request.method == "GET"


# ---- 7. update_link ----


@respx.mock
def test_update_link(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.update_link(1, UpdateLinkOptions(url="https://new.com"))
    body = json.loads(route.calls[0].request.content)
    assert body == {"url": "https://new.com"}


# ---- 8. disable_link ----


@respx.mock
def test_disable_link(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/disable").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1, expires_at=1)),
    )
    client.disable_link(1)
    assert route.calls[0].request.method == "POST"


# ---- 9. enable_link ----


@respx.mock
def test_enable_link(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/enable").mock(
        return_value=httpx.Response(200, json=make_link_dict(link_id=1)),
    )
    client.enable_link(1)
    assert route.calls[0].request.method == "POST"


# ---- 10. delete_link ----


@respx.mock
def test_delete_link(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/links/1").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    assert client.delete_link(1) is True
    assert route.calls[0].request.method == "DELETE"


# ---- 11. list_links_by_owner ----


@respx.mock
def test_list_links_by_owner_encodes_owner(client: Shrtnr) -> None:
    route = respx.get(
        url__regex=rf"^{BASE_URL}/_/api/links\?owner=user%40example\.com$",
    ).mock(return_value=httpx.Response(200, json=[]))
    client.list_links_by_owner("user@example.com")
    assert route.called


# ---- 12. add_custom_slug ----


@respx.mock
def test_add_custom_slug(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/slugs").mock(
        return_value=httpx.Response(201, json=make_slug_dict(link_id=1, slug="custom", is_custom=1)),
    )
    client.add_custom_slug(1, "custom")
    body = json.loads(route.calls[0].request.content)
    assert body == {"slug": "custom"}


# ---- 13. disable_slug ----


@respx.mock
def test_disable_slug(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/slugs/abc/disable").mock(
        return_value=httpx.Response(
            200, json=make_slug_dict(link_id=1, slug="abc", is_custom=1, disabled_at=1),
        ),
    )
    client.disable_slug(1, "abc")
    assert route.calls[0].request.method == "POST"


# ---- 14. enable_slug ----


@respx.mock
def test_enable_slug(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/links/1/slugs/abc/enable").mock(
        return_value=httpx.Response(200, json=make_slug_dict(link_id=1, slug="abc", is_custom=1)),
    )
    client.enable_slug(1, "abc")
    assert route.calls[0].request.method == "POST"


# ---- 15. remove_slug ----


@respx.mock
def test_remove_slug(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/links/1/slugs/abc").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    assert client.remove_slug(1, "abc") is True
    assert route.calls[0].request.method == "DELETE"


# ---- 16. get_link_by_slug ----


@respx.mock
def test_get_link_by_slug(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/slugs/find-me").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    client.get_link_by_slug("find-me")
    assert route.calls[0].request.method == "GET"


@respx.mock
def test_get_link_by_slug_url_encodes_reserved_chars(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/slugs/foo%2Fbar").mock(
        return_value=httpx.Response(200, json=make_link_dict()),
    )
    client.get_link_by_slug("foo/bar")
    assert route.called


# ---- 17. get_link_analytics ----


@respx.mock
def test_get_link_analytics(client: Shrtnr) -> None:
    payload: dict[str, Any] = {
        "total_clicks": 42,
        "countries": [],
        "referrers": [],
        "referrer_hosts": [],
        "devices": [],
        "os": [],
        "browsers": [],
        "link_modes": [],
        "channels": [],
        "clicks_over_time": [],
        "slug_clicks": [],
    }
    route = respx.get(f"{BASE_URL}/_/api/links/5/analytics").mock(
        return_value=httpx.Response(200, json=payload),
    )
    stats = client.get_link_analytics(5)
    assert stats.total_clicks == 42
    assert route.called


# ---- 18. get_link_qr ----


@respx.mock
def test_get_link_qr(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/qr").mock(
        return_value=httpx.Response(
            200,
            text="<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            headers={"Content-Type": "image/svg+xml"},
        ),
    )
    svg = client.get_link_qr(5)
    assert svg.startswith("<svg")
    assert route.called


@respx.mock
def test_get_link_qr_url_encodes_slug_query(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/5/qr?slug=foo%2Fbar").mock(
        return_value=httpx.Response(200, text="<svg/>"),
    )
    client.get_link_qr(5, slug="foo/bar")
    assert route.called


# ---- 19. create_bundle ----


@respx.mock
def test_create_bundle(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles").mock(
        return_value=httpx.Response(201, json=make_bundle_dict(name="B", accent="blue")),
    )
    client.create_bundle(CreateBundleOptions(name="B", accent="blue"))
    body = json.loads(route.calls[0].request.content)
    assert body == {"name": "B", "accent": "blue"}


# ---- 20. list_bundles ----


@respx.mock
def test_list_bundles_default(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles", params={}).mock(
        return_value=httpx.Response(200, json=[]),
    )
    client.list_bundles()
    assert route.called


@respx.mock
def test_list_bundles_archived_all(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles", params={"archived": "all"}).mock(
        return_value=httpx.Response(200, json=[]),
    )
    client.list_bundles(archived=True)
    assert route.called


# ---- 21. get_bundle ----


@respx.mock
def test_get_bundle(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    client.get_bundle(42)
    assert route.calls[0].request.method == "GET"


# ---- 22. update_bundle ----


@respx.mock
def test_update_bundle(client: Shrtnr) -> None:
    route = respx.put(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(description="edited")),
    )
    client.update_bundle(42, UpdateBundleOptions(description="edited"))
    body = json.loads(route.calls[0].request.content)
    assert body == {"description": "edited"}


# ---- 23. delete_bundle ----


@respx.mock
def test_delete_bundle(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/bundles/42").mock(
        return_value=httpx.Response(200, json={"deleted": True}),
    )
    assert client.delete_bundle(42) is True
    assert route.calls[0].request.method == "DELETE"


# ---- 24. archive_bundle ----


@respx.mock
def test_archive_bundle(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles/42/archive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict(archived_at=1)),
    )
    client.archive_bundle(42)
    assert route.calls[0].request.method == "POST"


# ---- 25. unarchive_bundle ----


@respx.mock
def test_unarchive_bundle(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles/42/unarchive").mock(
        return_value=httpx.Response(200, json=make_bundle_dict()),
    )
    client.unarchive_bundle(42)
    assert route.calls[0].request.method == "POST"


# ---- 26. get_bundle_analytics ----


@respx.mock
def test_get_bundle_analytics_with_range(client: Shrtnr) -> None:
    payload = {
        "bundle": make_bundle_dict(),
        "link_count": 0,
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
    client.get_bundle_analytics(42, range="7d")
    assert route.called


# ---- 27. list_bundle_links ----


@respx.mock
def test_list_bundle_links(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json=[]),
    )
    client.list_bundle_links(42)
    assert route.called


# ---- 28. add_link_to_bundle ----


@respx.mock
def test_add_link_to_bundle(client: Shrtnr) -> None:
    route = respx.post(f"{BASE_URL}/_/api/bundles/42/links").mock(
        return_value=httpx.Response(200, json={"added": True}),
    )
    assert client.add_link_to_bundle(42, 7) is True
    body = json.loads(route.calls[0].request.content)
    assert body == {"link_id": 7}


# ---- 29. remove_link_from_bundle ----


@respx.mock
def test_remove_link_from_bundle(client: Shrtnr) -> None:
    route = respx.delete(f"{BASE_URL}/_/api/bundles/42/links/7").mock(
        return_value=httpx.Response(200, json={"removed": True}),
    )
    assert client.remove_link_from_bundle(42, 7) is True
    assert route.calls[0].request.method == "DELETE"


# ---- 30. list_bundles_for_link ----


@respx.mock
def test_list_bundles_for_link(client: Shrtnr) -> None:
    route = respx.get(f"{BASE_URL}/_/api/links/7/bundles").mock(
        return_value=httpx.Response(200, json=[]),
    )
    client.list_bundles_for_link(7)
    assert route.called


# ---- 31. Base URL normalization ----


@respx.mock
def test_base_url_strips_trailing_slash() -> None:
    c = Shrtnr(f"{BASE_URL}/", api_key=API_KEY)
    route = respx.get(f"{BASE_URL}/_/api/links").mock(return_value=httpx.Response(200, json=[]))
    c.list_links()
    assert route.called
