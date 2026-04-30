# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Bundles resource: sync and async implementations."""

from __future__ import annotations

# `Bundles.list` / `AsyncBundles.list` shadow the builtin inside class scope,
# which trips mypy when other methods declare `list[X]` return types. Aliasing
# the builtin here lets those methods keep the PEP 585 `list[X]` style without
# resolving to the method.
from builtins import list as _list
from typing import Any, Literal

import httpx

from .._base import (
    _build_auth_headers,
    _build_url,
    parse_json_response,
)
from ..errors import ShrtnrError
from ..models import (
    AddedResult,
    Bundle,
    BundleAccent,
    BundleWithSummary,
    ClickStats,
    DeletedResult,
    Link,
    RemovedResult,
    TimelineRange,
)


class Bundles:
    """Synchronous Bundles resource."""

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

    def get(self, id: int, *, range: TimelineRange | None = None) -> BundleWithSummary:
        """Get a bundle by ID with aggregated click summary."""
        url = self._url(f"/_/api/bundles/{id}", {"range": range})
        return BundleWithSummary.from_dict(self._request("GET", url, headers=self._headers()))

    def list(
        self,
        *,
        archived: Literal["true", "1", "only", "all"] | None = None,
        range: TimelineRange | None = None,
    ) -> list[BundleWithSummary]:
        """List bundles. Filter by archived status and click-count range."""
        url = self._url("/_/api/bundles", {"archived": archived, "range": range})
        data = self._request("GET", url, headers=self._headers())
        return [BundleWithSummary.from_dict(x) for x in (data or [])]

    def create(
        self,
        *,
        name: str,
        description: str | None = None,
        icon: str | None = None,
        accent: BundleAccent | None = None,
    ) -> Bundle:
        """Create a new bundle."""
        body: dict[str, Any] = {"name": name}
        if description is not None:
            body["description"] = description
        if icon is not None:
            body["icon"] = icon
        if accent is not None:
            body["accent"] = accent
        url = self._url("/_/api/bundles")
        return Bundle.from_dict(self._request("POST", url, headers=self._json_headers(), json=body))

    def update(
        self,
        id: int,
        *,
        name: str | None = None,
        description: str | None = None,
        icon: str | None = None,
        accent: BundleAccent | None = None,
    ) -> Bundle:
        """Update a bundle's name, description, icon, or accent."""
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        if icon is not None:
            body["icon"] = icon
        if accent is not None:
            body["accent"] = accent
        url = self._url(f"/_/api/bundles/{id}")
        return Bundle.from_dict(self._request("PUT", url, headers=self._json_headers(), json=body))

    def delete(self, id: int) -> DeletedResult:
        """Permanently delete a bundle."""
        url = self._url(f"/_/api/bundles/{id}")
        return DeletedResult.from_dict(self._request("DELETE", url, headers=self._headers()))

    def archive(self, id: int) -> Bundle:
        """Archive a bundle."""
        url = self._url(f"/_/api/bundles/{id}/archive")
        return Bundle.from_dict(self._request("POST", url, headers=self._headers()))

    def unarchive(self, id: int) -> Bundle:
        """Unarchive a bundle."""
        url = self._url(f"/_/api/bundles/{id}/unarchive")
        return Bundle.from_dict(self._request("POST", url, headers=self._headers()))

    def analytics(self, id: int, *, range: TimelineRange | None = None) -> ClickStats:
        """Get click analytics for a bundle."""
        url = self._url(f"/_/api/bundles/{id}/analytics", {"range": range})
        return ClickStats.from_dict(self._request("GET", url, headers=self._headers()))

    def links(self, id: int) -> _list[Link]:
        """List links in a bundle."""
        url = self._url(f"/_/api/bundles/{id}/links")
        data = self._request("GET", url, headers=self._headers())
        return [Link.from_dict(x) for x in (data or [])]

    def add_link(self, id: int, link_id: int) -> AddedResult:
        """Add a link to a bundle."""
        url = self._url(f"/_/api/bundles/{id}/links")
        return AddedResult.from_dict(
            self._request("POST", url, headers=self._json_headers(), json={"link_id": link_id})
        )

    def remove_link(self, id: int, link_id: int) -> RemovedResult:
        """Remove a link from a bundle."""
        url = self._url(f"/_/api/bundles/{id}/links/{link_id}")
        return RemovedResult.from_dict(self._request("DELETE", url, headers=self._headers()))


class AsyncBundles:
    """Asynchronous Bundles resource."""

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

    async def get(self, id: int, *, range: TimelineRange | None = None) -> BundleWithSummary:
        """Get a bundle by ID with aggregated click summary."""
        url = self._url(f"/_/api/bundles/{id}", {"range": range})
        return BundleWithSummary.from_dict(await self._request("GET", url, headers=self._headers()))

    async def list(
        self,
        *,
        archived: Literal["true", "1", "only", "all"] | None = None,
        range: TimelineRange | None = None,
    ) -> list[BundleWithSummary]:
        """List bundles. Filter by archived status and click-count range."""
        url = self._url("/_/api/bundles", {"archived": archived, "range": range})
        data = await self._request("GET", url, headers=self._headers())
        return [BundleWithSummary.from_dict(x) for x in (data or [])]

    async def create(
        self,
        *,
        name: str,
        description: str | None = None,
        icon: str | None = None,
        accent: BundleAccent | None = None,
    ) -> Bundle:
        """Create a new bundle."""
        body: dict[str, Any] = {"name": name}
        if description is not None:
            body["description"] = description
        if icon is not None:
            body["icon"] = icon
        if accent is not None:
            body["accent"] = accent
        url = self._url("/_/api/bundles")
        return Bundle.from_dict(
            await self._request("POST", url, headers=self._json_headers(), json=body)
        )

    async def update(
        self,
        id: int,
        *,
        name: str | None = None,
        description: str | None = None,
        icon: str | None = None,
        accent: BundleAccent | None = None,
    ) -> Bundle:
        """Update a bundle's name, description, icon, or accent."""
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        if icon is not None:
            body["icon"] = icon
        if accent is not None:
            body["accent"] = accent
        url = self._url(f"/_/api/bundles/{id}")
        return Bundle.from_dict(
            await self._request("PUT", url, headers=self._json_headers(), json=body)
        )

    async def delete(self, id: int) -> DeletedResult:
        """Permanently delete a bundle."""
        url = self._url(f"/_/api/bundles/{id}")
        return DeletedResult.from_dict(await self._request("DELETE", url, headers=self._headers()))

    async def archive(self, id: int) -> Bundle:
        """Archive a bundle."""
        url = self._url(f"/_/api/bundles/{id}/archive")
        return Bundle.from_dict(await self._request("POST", url, headers=self._headers()))

    async def unarchive(self, id: int) -> Bundle:
        """Unarchive a bundle."""
        url = self._url(f"/_/api/bundles/{id}/unarchive")
        return Bundle.from_dict(await self._request("POST", url, headers=self._headers()))

    async def analytics(self, id: int, *, range: TimelineRange | None = None) -> ClickStats:
        """Get click analytics for a bundle."""
        url = self._url(f"/_/api/bundles/{id}/analytics", {"range": range})
        return ClickStats.from_dict(await self._request("GET", url, headers=self._headers()))

    async def links(self, id: int) -> _list[Link]:
        """List links in a bundle."""
        url = self._url(f"/_/api/bundles/{id}/links")
        data = await self._request("GET", url, headers=self._headers())
        return [Link.from_dict(x) for x in (data or [])]

    async def add_link(self, id: int, link_id: int) -> AddedResult:
        """Add a link to a bundle."""
        url = self._url(f"/_/api/bundles/{id}/links")
        return AddedResult.from_dict(
            await self._request(
                "POST", url, headers=self._json_headers(), json={"link_id": link_id}
            )
        )

    async def remove_link(self, id: int, link_id: int) -> RemovedResult:
        """Remove a link from a bundle."""
        url = self._url(f"/_/api/bundles/{id}/links/{link_id}")
        return RemovedResult.from_dict(await self._request("DELETE", url, headers=self._headers()))
