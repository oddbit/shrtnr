# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Links resource: sync and async implementations."""

from __future__ import annotations

# `Links.list` / `AsyncLinks.list` shadow the builtin inside class scope,
# which trips mypy when other methods declare `list[X]` return types. Aliasing
# the builtin here lets those methods keep the PEP 585 `list[X]` style without
# resolving to the method.
from builtins import list as _list
from typing import Any

import httpx

from .._base import (
    UNSET,
    _build_auth_headers,
    _build_url,
    parse_json_response,
    parse_text_response,
)
from ..errors import ShrtnrError
from ..models import (
    Bundle,
    ClickStats,
    DeletedResult,
    Link,
    TimelineData,
    TimelineRange,
)


class Links:
    """Synchronous Links resource."""

    def __init__(self, base_url: str, api_key: str, http: httpx.Client) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._http = http

    def _headers(self) -> dict[str, str]:
        return _build_auth_headers(self._api_key)

    def _json_headers(self) -> dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def _url(self, path: str, query: dict[str, str | None] | None = None) -> str:
        return _build_url(self._base_url, path, query)

    def _request(self, method: str, url: str, **kwargs: Any) -> Any:
        try:
            response = self._http.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            raise ShrtnrError(0, str(exc)) from exc
        return parse_json_response(response)

    def _request_text(self, method: str, url: str, **kwargs: Any) -> str:
        try:
            response = self._http.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            raise ShrtnrError(0, str(exc)) from exc
        return parse_text_response(response)

    def get(self, id: int, *, range: TimelineRange | None = None) -> Link:
        """Get a link by ID. Optional range scopes the click-count window."""
        url = self._url(f"/_/api/links/{id}", {"range": range})
        return Link.from_dict(self._request("GET", url, headers=self._headers()))

    def list(self, *, owner: str | None = None, range: TimelineRange | None = None) -> list[Link]:
        """List all links. Filter by owner or click-count range."""
        url = self._url("/_/api/links", {"owner": owner, "range": range})
        data = self._request("GET", url, headers=self._headers())
        return [Link.from_dict(x) for x in (data or [])]

    def create(
        self,
        *,
        url: str,
        label: str | None = None,
        slug_length: int | None = None,
        expires_at: int | None = None,
        allow_duplicate: bool | None = None,
    ) -> Link:
        """Create a new short link."""
        body: dict[str, Any] = {"url": url}
        if label is not None:
            body["label"] = label
        if slug_length is not None:
            body["slug_length"] = slug_length
        if expires_at is not None:
            body["expires_at"] = expires_at
        if allow_duplicate is not None:
            body["allow_duplicate"] = allow_duplicate
        req_url = self._url("/_/api/links")
        return Link.from_dict(
            self._request("POST", req_url, headers=self._json_headers(), json=body)
        )

    def update(
        self,
        id: int,
        *,
        url: str | None = None,
        label: str | None = UNSET,
        expires_at: int | None = UNSET,
    ) -> Link:
        """Update a link's URL, label, or expiry.

        Pass ``None`` for *label* or *expires_at* to clear the field.
        Omitting a parameter leaves the field unchanged.
        """
        body: dict[str, Any] = {}
        if url is not None:
            body["url"] = url
        if label is not UNSET:
            body["label"] = label
        if expires_at is not UNSET:
            body["expires_at"] = expires_at
        req_url = self._url(f"/_/api/links/{id}")
        return Link.from_dict(
            self._request("PUT", req_url, headers=self._json_headers(), json=body)
        )

    def disable(self, id: int) -> Link:
        """Disable a link (stops redirecting)."""
        url = self._url(f"/_/api/links/{id}/disable")
        return Link.from_dict(self._request("POST", url, headers=self._headers()))

    def enable(self, id: int) -> Link:
        """Re-enable a disabled link."""
        url = self._url(f"/_/api/links/{id}/enable")
        return Link.from_dict(self._request("POST", url, headers=self._headers()))

    def delete(self, id: int) -> DeletedResult:
        """Permanently delete a link."""
        url = self._url(f"/_/api/links/{id}")
        return DeletedResult.from_dict(self._request("DELETE", url, headers=self._headers()))

    def analytics(self, id: int, *, range: TimelineRange | None = None) -> ClickStats:
        """Get click analytics for a link."""
        url = self._url(f"/_/api/links/{id}/analytics", {"range": range})
        return ClickStats.from_dict(self._request("GET", url, headers=self._headers()))

    def timeline(self, id: int, *, range: TimelineRange | None = None) -> TimelineData:
        """Get click timeline for a link."""
        url = self._url(f"/_/api/links/{id}/timeline", {"range": range})
        return TimelineData.from_dict(self._request("GET", url, headers=self._headers()))

    def qr(self, id: int, *, slug: str | None = None, size: str | None = None) -> str:
        """Get the QR code SVG for a link. Returns the SVG string."""
        query: dict[str, str | None] = {}
        if slug is not None:
            query["slug"] = slug
        if size is not None:
            query["size"] = size
        url = self._url(f"/_/api/links/{id}/qr", query or None)
        return self._request_text("GET", url, headers=self._headers())

    def bundles(self, id: int) -> _list[Bundle]:
        """List bundles that contain this link."""
        url = self._url(f"/_/api/links/{id}/bundles")
        data = self._request("GET", url, headers=self._headers())
        return [Bundle.from_dict(x) for x in (data or [])]


class AsyncLinks:
    """Asynchronous Links resource."""

    def __init__(self, base_url: str, api_key: str, http: httpx.AsyncClient) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._http = http

    def _headers(self) -> dict[str, str]:
        return _build_auth_headers(self._api_key)

    def _json_headers(self) -> dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def _url(self, path: str, query: dict[str, str | None] | None = None) -> str:
        return _build_url(self._base_url, path, query)

    async def _request(self, method: str, url: str, **kwargs: Any) -> Any:
        try:
            response = await self._http.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            raise ShrtnrError(0, str(exc)) from exc
        return parse_json_response(response)

    async def _request_text(self, method: str, url: str, **kwargs: Any) -> str:
        try:
            response = await self._http.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            raise ShrtnrError(0, str(exc)) from exc
        return parse_text_response(response)

    async def get(self, id: int, *, range: TimelineRange | None = None) -> Link:
        """Get a link by ID. Optional range scopes the click-count window."""
        url = self._url(f"/_/api/links/{id}", {"range": range})
        return Link.from_dict(await self._request("GET", url, headers=self._headers()))

    async def list(
        self, *, owner: str | None = None, range: TimelineRange | None = None
    ) -> list[Link]:
        """List all links. Filter by owner or click-count range."""
        url = self._url("/_/api/links", {"owner": owner, "range": range})
        data = await self._request("GET", url, headers=self._headers())
        return [Link.from_dict(x) for x in (data or [])]

    async def create(
        self,
        *,
        url: str,
        label: str | None = None,
        slug_length: int | None = None,
        expires_at: int | None = None,
        allow_duplicate: bool | None = None,
    ) -> Link:
        """Create a new short link."""
        body: dict[str, Any] = {"url": url}
        if label is not None:
            body["label"] = label
        if slug_length is not None:
            body["slug_length"] = slug_length
        if expires_at is not None:
            body["expires_at"] = expires_at
        if allow_duplicate is not None:
            body["allow_duplicate"] = allow_duplicate
        req_url = self._url("/_/api/links")
        return Link.from_dict(
            await self._request("POST", req_url, headers=self._json_headers(), json=body)
        )

    async def update(
        self,
        id: int,
        *,
        url: str | None = None,
        label: str | None = UNSET,
        expires_at: int | None = UNSET,
    ) -> Link:
        """Update a link's URL, label, or expiry.

        Pass ``None`` for *label* or *expires_at* to clear the field.
        Omitting a parameter leaves the field unchanged.
        """
        body: dict[str, Any] = {}
        if url is not None:
            body["url"] = url
        if label is not UNSET:
            body["label"] = label
        if expires_at is not UNSET:
            body["expires_at"] = expires_at
        req_url = self._url(f"/_/api/links/{id}")
        return Link.from_dict(
            await self._request("PUT", req_url, headers=self._json_headers(), json=body)
        )

    async def disable(self, id: int) -> Link:
        """Disable a link (stops redirecting)."""
        url = self._url(f"/_/api/links/{id}/disable")
        return Link.from_dict(await self._request("POST", url, headers=self._headers()))

    async def enable(self, id: int) -> Link:
        """Re-enable a disabled link."""
        url = self._url(f"/_/api/links/{id}/enable")
        return Link.from_dict(await self._request("POST", url, headers=self._headers()))

    async def delete(self, id: int) -> DeletedResult:
        """Permanently delete a link."""
        url = self._url(f"/_/api/links/{id}")
        return DeletedResult.from_dict(await self._request("DELETE", url, headers=self._headers()))

    async def analytics(self, id: int, *, range: TimelineRange | None = None) -> ClickStats:
        """Get click analytics for a link."""
        url = self._url(f"/_/api/links/{id}/analytics", {"range": range})
        return ClickStats.from_dict(await self._request("GET", url, headers=self._headers()))

    async def timeline(self, id: int, *, range: TimelineRange | None = None) -> TimelineData:
        """Get click timeline for a link."""
        url = self._url(f"/_/api/links/{id}/timeline", {"range": range})
        return TimelineData.from_dict(await self._request("GET", url, headers=self._headers()))

    async def qr(self, id: int, *, slug: str | None = None, size: str | None = None) -> str:
        """Get the QR code SVG for a link. Returns the SVG string."""
        query: dict[str, str | None] = {}
        if slug is not None:
            query["slug"] = slug
        if size is not None:
            query["size"] = size
        url = self._url(f"/_/api/links/{id}/qr", query or None)
        return await self._request_text("GET", url, headers=self._headers())

    async def bundles(self, id: int) -> _list[Bundle]:
        """List bundles that contain this link."""
        url = self._url(f"/_/api/links/{id}/bundles")
        data = await self._request("GET", url, headers=self._headers())
        return [Bundle.from_dict(x) for x in (data or [])]
