# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Shared HTTP plumbing for sync and async shrtnr clients.

Both clients speak the same auth, parse the same responses, and raise the
same errors. Everything here is the core that would be duplicated between
:class:`Shrtnr` and :class:`AsyncShrtnr` if written twice.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from .errors import ShrtnrError

DEFAULT_TIMEOUT = 30.0


class _UnsetType:
    """Sentinel distinguishing 'not provided' from an explicit ``None``."""

    _instance: _UnsetType | None = None

    def __new__(cls) -> _UnsetType:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self) -> str:
        return "UNSET"


UNSET: Any = _UnsetType()


def _build_auth_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


def _build_url(base_url: str, path: str, query: dict[str, str | None] | None = None) -> str:
    url = f"{base_url.rstrip('/')}{path}"
    if not query:
        return url
    params = "&".join(f"{k}={quote(str(v), safe='')}" for k, v in query.items() if v is not None)
    return f"{url}?{params}" if params else url


def url_encode(value: str) -> str:
    """Percent-encode a path segment (no safe characters)."""
    return quote(value, safe="")


def _raise_from_response(response: httpx.Response) -> None:
    server_message = f"HTTP {response.status_code}"
    try:
        body: Any = response.json()
        if isinstance(body, dict) and isinstance(body.get("error"), str):
            server_message = body["error"]
    except Exception:
        pass
    raise ShrtnrError(response.status_code, server_message)


def parse_json_response(response: httpx.Response) -> Any:
    """Parse a JSON response or raise ShrtnrError on non-2xx."""
    if not response.is_success:
        _raise_from_response(response)
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


def parse_text_response(response: httpx.Response) -> str:
    """Parse a text response or raise ShrtnrError on non-2xx."""
    if not response.is_success:
        _raise_from_response(response)
    return response.text
