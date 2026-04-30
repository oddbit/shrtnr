# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Sync and async top-level shrtnr clients."""

from __future__ import annotations

from types import TracebackType

import httpx

from ._base import DEFAULT_TIMEOUT
from .resources.bundles import AsyncBundles, Bundles
from .resources.links import AsyncLinks, Links
from .resources.slugs import AsyncSlugs, Slugs


class Shrtnr:
    """Synchronous shrtnr API client.

    Construct with the shrtnr deployment's base URL and an API key from the
    admin dashboard. Use as a context manager to close the underlying HTTP
    connection pool deterministically::

        with Shrtnr(base_url="https://s.example.com", api_key="sk_...") as client:
            link = client.links.get(42)
            client.bundles.archive(7)
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: str,
        timeout: float = DEFAULT_TIMEOUT,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._owns_client = http_client is None
        self._http = http_client if http_client is not None else httpx.Client(timeout=timeout)

        self.links = Links(self._base_url, self._api_key, self._http)
        self.slugs = Slugs(self._base_url, self._api_key, self._http)
        self.bundles = Bundles(self._base_url, self._api_key, self._http)

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
        """Close the underlying HTTP client."""
        if self._owns_client:
            self._http.close()


class AsyncShrtnr:
    """Asynchronous shrtnr API client.

    Construct with the shrtnr deployment's base URL and an API key from the
    admin dashboard. Use as an async context manager::

        async with AsyncShrtnr(base_url="https://s.example.com", api_key="sk_...") as client:
            link = await client.links.get(42)
            await client.bundles.archive(7)
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: str,
        timeout: float = DEFAULT_TIMEOUT,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._owns_client = http_client is None
        self._http = http_client if http_client is not None else httpx.AsyncClient(timeout=timeout)

        self.links = AsyncLinks(self._base_url, self._api_key, self._http)
        self.slugs = AsyncSlugs(self._base_url, self._api_key, self._http)
        self.bundles = AsyncBundles(self._base_url, self._api_key, self._http)

    # ---- context manager ----

    async def __aenter__(self) -> AsyncShrtnr:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Close the underlying async HTTP client."""
        if self._owns_client:
            await self._http.aclose()
