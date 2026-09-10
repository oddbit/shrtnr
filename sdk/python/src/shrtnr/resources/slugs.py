# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Slugs resource: sync and async implementations."""

from __future__ import annotations

from typing import Any

import httpx

from .._base import (
    _build_request_headers,
    _build_url,
    parse_json_response,
    url_encode,
)
from ..errors import ShrtnrError
from ..models import Link, RemovedResult, Slug


class Slugs:
    """Synchronous Slugs resource."""

    def __init__(self, base_url: str, api_key: str, http: httpx.Client) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._http = http

    def _headers(self) -> dict[str, str]:
        return _build_request_headers(self._api_key)

    def _json_headers(self) -> dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def _url(self, path: str) -> str:
        return _build_url(self._base_url, path)

    def _request(self, method: str, url: str, **kwargs: Any) -> Any:
        try:
            response = self._http.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            raise ShrtnrError(0, str(exc)) from exc
        return parse_json_response(response)

    def lookup(self, slug: str) -> Link:
        """Look up a link by its slug."""
        url = self._url(f"/_/api/slugs/{url_encode(slug)}")
        return Link.from_dict(self._request("GET", url, headers=self._headers()))

    def add(self, link_id: int, slug: str) -> Slug:
        """Add a custom slug to a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs")
        return Slug.from_dict(
            self._request("POST", url, headers=self._json_headers(), json={"slug": slug})
        )

    def disable(self, link_id: int, slug: str) -> Slug:
        """Disable a specific slug on a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs/{url_encode(slug)}/disable")
        return Slug.from_dict(self._request("POST", url, headers=self._headers()))

    def enable(self, link_id: int, slug: str) -> Slug:
        """Re-enable a disabled slug on a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs/{url_encode(slug)}/enable")
        return Slug.from_dict(self._request("POST", url, headers=self._headers()))

    def remove(self, link_id: int, slug: str) -> RemovedResult:
        """Remove a custom slug from a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs/{url_encode(slug)}")
        return RemovedResult.from_dict(self._request("DELETE", url, headers=self._headers()))


class AsyncSlugs:
    """Asynchronous Slugs resource."""

    def __init__(self, base_url: str, api_key: str, http: httpx.AsyncClient) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._http = http

    def _headers(self) -> dict[str, str]:
        return _build_request_headers(self._api_key)

    def _json_headers(self) -> dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def _url(self, path: str) -> str:
        return _build_url(self._base_url, path)

    async def _request(self, method: str, url: str, **kwargs: Any) -> Any:
        try:
            response = await self._http.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            raise ShrtnrError(0, str(exc)) from exc
        return parse_json_response(response)

    async def lookup(self, slug: str) -> Link:
        """Look up a link by its slug."""
        url = self._url(f"/_/api/slugs/{url_encode(slug)}")
        return Link.from_dict(await self._request("GET", url, headers=self._headers()))

    async def add(self, link_id: int, slug: str) -> Slug:
        """Add a custom slug to a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs")
        return Slug.from_dict(
            await self._request("POST", url, headers=self._json_headers(), json={"slug": slug})
        )

    async def disable(self, link_id: int, slug: str) -> Slug:
        """Disable a specific slug on a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs/{url_encode(slug)}/disable")
        return Slug.from_dict(await self._request("POST", url, headers=self._headers()))

    async def enable(self, link_id: int, slug: str) -> Slug:
        """Re-enable a disabled slug on a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs/{url_encode(slug)}/enable")
        return Slug.from_dict(await self._request("POST", url, headers=self._headers()))

    async def remove(self, link_id: int, slug: str) -> RemovedResult:
        """Remove a custom slug from a link."""
        url = self._url(f"/_/api/links/{link_id}/slugs/{url_encode(slug)}")
        return RemovedResult.from_dict(await self._request("DELETE", url, headers=self._headers()))
