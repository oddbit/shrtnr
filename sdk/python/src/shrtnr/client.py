# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Synchronous client for the shrtnr API."""

from __future__ import annotations

from types import TracebackType

import httpx

from ._base_client import (
    DEFAULT_TIMEOUT,
    build_headers,
    build_url,
    handle_response,
    handle_text_response,
    url_quote,
)
from .models import (
    Bundle,
    BundleStats,
    BundleWithSummary,
    ClickStats,
    CreateBundleOptions,
    CreateLinkOptions,
    HealthStatus,
    Link,
    Slug,
    TimelineRange,
    UpdateBundleOptions,
    UpdateLinkOptions,
)


class Shrtnr:
    """Synchronous shrtnr API client built on ``httpx.Client``.

    Construct with the shrtnr deployment's base URL and an API key minted
    from the admin dashboard. Use as a context manager to ensure the
    underlying HTTP connection pool is closed deterministically::

        with Shrtnr("https://s.example.com", api_key="sk_...") as client:
            link = client.create_link(CreateLinkOptions(url="https://example.com"))
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: str,
        timeout: float = DEFAULT_TIMEOUT,
        client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._client = client if client is not None else httpx.Client(timeout=timeout)
        self._owns_client = client is None

    # ---- context manager ----

    def __enter__(self) -> Shrtnr:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    # ---- internal ----

    def _url(self, path: str) -> str:
        return build_url(self._base_url, path)

    def _get(self, path: str) -> object:
        return handle_response(
            self._client.get(self._url(path), headers=build_headers(self._api_key)),
        )

    def _get_text(self, path: str) -> str:
        return handle_text_response(
            self._client.get(self._url(path), headers=build_headers(self._api_key)),
        )

    def _post(self, path: str, json: object | None = None) -> object:
        if json is None:
            return handle_response(
                self._client.post(self._url(path), headers=build_headers(self._api_key)),
            )
        return handle_response(
            self._client.post(
                self._url(path),
                headers=build_headers(self._api_key, with_content_type=True),
                json=json,
            ),
        )

    def _put(self, path: str, json: object) -> object:
        return handle_response(
            self._client.put(
                self._url(path),
                headers=build_headers(self._api_key, with_content_type=True),
                json=json,
            ),
        )

    def _delete(self, path: str) -> object:
        return handle_response(
            self._client.delete(self._url(path), headers=build_headers(self._api_key)),
        )

    # ---- health ----

    def health(self) -> HealthStatus:
        return HealthStatus.from_json(_as_dict(self._get("/_/health")))

    # ---- links ----

    def create_link(self, options: CreateLinkOptions) -> Link:
        return Link.from_json(_as_dict(self._post("/_/api/links", options.to_json())))

    def list_links(self) -> list[Link]:
        return [Link.from_json(x) for x in _as_list(self._get("/_/api/links"))]

    def get_link(self, link_id: int) -> Link:
        return Link.from_json(_as_dict(self._get(f"/_/api/links/{link_id}")))

    def update_link(self, link_id: int, options: UpdateLinkOptions) -> Link:
        return Link.from_json(_as_dict(self._put(f"/_/api/links/{link_id}", options.to_json())))

    def disable_link(self, link_id: int) -> Link:
        return Link.from_json(_as_dict(self._post(f"/_/api/links/{link_id}/disable")))

    def enable_link(self, link_id: int) -> Link:
        return Link.from_json(_as_dict(self._post(f"/_/api/links/{link_id}/enable")))

    def delete_link(self, link_id: int) -> bool:
        result = _as_dict(self._delete(f"/_/api/links/{link_id}"))
        return bool(result.get("deleted", False))

    def list_links_by_owner(self, owner: str) -> list[Link]:
        path = f"/_/api/links?owner={url_quote(owner)}"
        return [Link.from_json(x) for x in _as_list(self._get(path))]

    # ---- slugs ----

    def add_custom_slug(self, link_id: int, slug: str) -> Slug:
        return Slug.from_json(_as_dict(self._post(f"/_/api/links/{link_id}/slugs", {"slug": slug})))

    def disable_slug(self, link_id: int, slug: str) -> Slug:
        path = f"/_/api/links/{link_id}/slugs/{url_quote(slug)}/disable"
        return Slug.from_json(_as_dict(self._post(path)))

    def enable_slug(self, link_id: int, slug: str) -> Slug:
        path = f"/_/api/links/{link_id}/slugs/{url_quote(slug)}/enable"
        return Slug.from_json(_as_dict(self._post(path)))

    def remove_slug(self, link_id: int, slug: str) -> bool:
        path = f"/_/api/links/{link_id}/slugs/{url_quote(slug)}"
        result = _as_dict(self._delete(path))
        return bool(result.get("removed", False))

    def get_link_by_slug(self, slug: str) -> Link:
        return Link.from_json(_as_dict(self._get(f"/_/api/slugs/{url_quote(slug)}")))

    # ---- analytics + qr ----

    def get_link_analytics(
        self,
        link_id: int,
        *,
        range: TimelineRange = "all",
    ) -> ClickStats:
        path = f"/_/api/links/{link_id}/analytics?range={range}"
        return ClickStats.from_json(_as_dict(self._get(path)))

    def get_link_qr(self, link_id: int, *, slug: str | None = None) -> str:
        suffix = f"?slug={url_quote(slug)}" if slug else ""
        return self._get_text(f"/_/api/links/{link_id}/qr{suffix}")

    # ---- bundles ----

    def create_bundle(self, options: CreateBundleOptions) -> Bundle:
        return Bundle.from_json(_as_dict(self._post("/_/api/bundles", options.to_json())))

    def list_bundles(self, *, archived: bool | None = None) -> list[BundleWithSummary]:
        path = "/_/api/bundles"
        if archived is True:
            path += "?archived=all"
        elif archived is False:
            path += "?archived=false"
        return [BundleWithSummary.from_json(x) for x in _as_list(self._get(path))]

    def get_bundle(self, bundle_id: int) -> Bundle:
        return Bundle.from_json(_as_dict(self._get(f"/_/api/bundles/{bundle_id}")))

    def update_bundle(self, bundle_id: int, options: UpdateBundleOptions) -> Bundle:
        return Bundle.from_json(
            _as_dict(self._put(f"/_/api/bundles/{bundle_id}", options.to_json())),
        )

    def delete_bundle(self, bundle_id: int) -> bool:
        result = _as_dict(self._delete(f"/_/api/bundles/{bundle_id}"))
        return bool(result.get("deleted", False))

    def archive_bundle(self, bundle_id: int) -> Bundle:
        return Bundle.from_json(_as_dict(self._post(f"/_/api/bundles/{bundle_id}/archive")))

    def unarchive_bundle(self, bundle_id: int) -> Bundle:
        return Bundle.from_json(_as_dict(self._post(f"/_/api/bundles/{bundle_id}/unarchive")))

    def get_bundle_analytics(
        self,
        bundle_id: int,
        *,
        range: TimelineRange = "all",
    ) -> BundleStats:
        path = f"/_/api/bundles/{bundle_id}/analytics?range={range}"
        return BundleStats.from_json(_as_dict(self._get(path)))

    def list_bundle_links(self, bundle_id: int) -> list[Link]:
        return [Link.from_json(x) for x in _as_list(self._get(f"/_/api/bundles/{bundle_id}/links"))]

    def add_link_to_bundle(self, bundle_id: int, link_id: int) -> bool:
        result = _as_dict(
            self._post(f"/_/api/bundles/{bundle_id}/links", {"link_id": link_id}),
        )
        return bool(result.get("added", False))

    def remove_link_from_bundle(self, bundle_id: int, link_id: int) -> bool:
        result = _as_dict(self._delete(f"/_/api/bundles/{bundle_id}/links/{link_id}"))
        return bool(result.get("removed", False))

    def list_bundles_for_link(self, link_id: int) -> list[Bundle]:
        return [Bundle.from_json(x) for x in _as_list(self._get(f"/_/api/links/{link_id}/bundles"))]


def _as_dict(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise TypeError(f"expected object from API, got {type(value).__name__}")
    return value


def _as_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise TypeError(f"expected array from API, got {type(value).__name__}")
    return value
