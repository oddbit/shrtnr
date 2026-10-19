# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Config resource: sync and async implementations."""

from __future__ import annotations

# The resource class shares the model's name, so the model is aliased to keep
# the ``get`` return annotation pointing at the dataclass and not the resource.
from .._base import (
    _AsyncResource,
    _SyncResource,
)
from ..models import Config as ConfigModel


class Config(_SyncResource):
    """Synchronous Config resource."""

    def get(self) -> ConfigModel:
        """Get the origin this deployment hands short URLs out on.

        Build short URLs as ``f"{config.short_origin}/{slug}"`` so they match
        the copy button, the QR code and the redirects on a deployment that
        answers on several domains.
        """
        url = self._url("/_/api/config")
        return ConfigModel.from_dict(self._request("GET", url, headers=self._headers()))


class AsyncConfig(_AsyncResource):
    """Asynchronous Config resource."""

    async def get(self) -> ConfigModel:
        """Get the origin this deployment hands short URLs out on.

        Build short URLs as ``f"{config.short_origin}/{slug}"`` so they match
        the copy button, the QR code and the redirects on a deployment that
        answers on several domains.
        """
        url = self._url("/_/api/config")
        return ConfigModel.from_dict(await self._request("GET", url, headers=self._headers()))
