# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Slugs resource: sync and async implementations."""

from __future__ import annotations

from .._base import (
    _AsyncResource,
    _SyncResource,
    url_encode,
)
from ..models import Link, RemovedResult, Slug


class Slugs(_SyncResource):
    """Synchronous Slugs resource."""

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


class AsyncSlugs(_AsyncResource):
    """Asynchronous Slugs resource."""

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
