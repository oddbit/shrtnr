# Copyright 2026 Oddbit (https://oddbit.id)
# SPDX-License-Identifier: Apache-2.0

"""Shared HTTP plumbing for sync and async shrtnr clients.

Both clients speak the same auth, parse the same responses, and raise the
same errors. Everything here is the core that would be duplicated between
:class:`Shrtnr` and :class:`AsyncShrtnr` if written twice.
"""

from __future__ import annotations

from typing import Any, Literal
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


def _build_request_headers(api_key: str) -> dict[str, str]:
    """Headers sent on every request.

    The API reads X-Client to record how a link or bundle was created:
    "sdk" when it is present, "api" otherwise (src/api/links.ts,
    src/api/bundles.ts).
    """
    return {"Authorization": f"Bearer {api_key}", "X-Client": "sdk"}


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


JsonShape = Literal["object", "array"]


def parse_json_response(response: httpx.Response, shape: JsonShape = "object") -> Any:
    """Parse a JSON response or raise ShrtnrError on non-2xx.

    ``shape`` names the container the caller can consume: ``"object"`` for a
    single resource (``SomeModel.from_dict``), ``"array"`` for a list to map
    over. A 2xx body of any other JSON type raises ShrtnrError here, before a
    model constructor turns it into a bare AttributeError or TypeError.
    """
    if not response.is_success:
        _raise_from_response(response)
    if response.status_code == 204:
        return None
    # An empty body on a non-204 2xx is the same "truncated body served with
    # a 200" case the non-JSON branch below covers (e.g. a CDN/proxy that
    # strips the body on some 2xx responses): treat it as invalid rather
    # than silently returning None, which every resource method's
    # `SomeModel.from_dict(...)` call would otherwise crash on with a bare
    # AttributeError instead of the documented ShrtnrError.
    if not response.content:
        raise ShrtnrError(response.status_code, "Empty response body")
    try:
        parsed = response.json()
    except Exception as exc:
        raise ShrtnrError(response.status_code, f"Invalid JSON response: {exc}") from exc
    # A body that is valid JSON but of the wrong container type (a bare
    # scalar such as null, a number, a string or a bool; an array where a
    # single resource is expected; an object where a list is expected)
    # passes the empty-body check above (4 bytes for `null`) and the parse
    # above unchanged. Left alone it reached the resource method, where
    # `SomeModel.from_dict([])` failed with a bare AttributeError and a
    # dict on a list() endpoint iterated its keys. The transport cannot
    # infer the expected container from the response, so the caller names
    # it and the mismatch raises here with the documented error type.
    if shape == "array":
        if not isinstance(parsed, list):
            raise ShrtnrError(response.status_code, "Response body is not a JSON array")
    elif not isinstance(parsed, dict):
        raise ShrtnrError(response.status_code, "Response body is not a JSON object")
    return parsed


def parse_text_response(response: httpx.Response) -> str:
    """Parse a text response or raise ShrtnrError on non-2xx."""
    if not response.is_success:
        _raise_from_response(response)
    return response.text


class _SyncResource:
    """Construction and the request path shared by the sync resources.

    Links, Bundles and Slugs differ only in the endpoints they call. Keeping
    the transport here means an httpx exception-hierarchy surprise, a retry
    policy, a header or a timeout lands once instead of in six method bodies
    that have to stay byte-identical.
    """

    def __init__(self, base_url: str, api_key: str, http: httpx.Client) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._http = http

    def _headers(self) -> dict[str, str]:
        return _build_request_headers(self._api_key)

    def _json_headers(self) -> dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def _url(self, path: str, query: dict[str, str | None] | None = None) -> str:
        return _build_url(self._base_url, path, query)

    def _send(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        # httpx.InvalidURL isn't a RequestError subclass, and it is raised
        # synchronously from request-building before any I/O, so catch it too
        # or a malformed base_url escapes as a raw httpx exception instead of
        # the ShrtnrError(0, ...) this SDK documents.
        try:
            return self._http.request(method, url, **kwargs)
        except (httpx.RequestError, httpx.InvalidURL) as exc:
            raise ShrtnrError(0, str(exc)) from exc

    def _request(self, method: str, url: str, *, shape: JsonShape = "object", **kwargs: Any) -> Any:
        return parse_json_response(self._send(method, url, **kwargs), shape)

    def _request_text(self, method: str, url: str, **kwargs: Any) -> str:
        return parse_text_response(self._send(method, url, **kwargs))


class _AsyncResource:
    """Async twin of :class:`_SyncResource`."""

    def __init__(self, base_url: str, api_key: str, http: httpx.AsyncClient) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._http = http

    def _headers(self) -> dict[str, str]:
        return _build_request_headers(self._api_key)

    def _json_headers(self) -> dict[str, str]:
        return {**self._headers(), "Content-Type": "application/json"}

    def _url(self, path: str, query: dict[str, str | None] | None = None) -> str:
        return _build_url(self._base_url, path, query)

    async def _send(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        # See _SyncResource._send for why InvalidURL is caught alongside
        # RequestError.
        try:
            return await self._http.request(method, url, **kwargs)
        except (httpx.RequestError, httpx.InvalidURL) as exc:
            raise ShrtnrError(0, str(exc)) from exc

    async def _request(
        self, method: str, url: str, *, shape: JsonShape = "object", **kwargs: Any
    ) -> Any:
        return parse_json_response(await self._send(method, url, **kwargs), shape)

    async def _request_text(self, method: str, url: str, **kwargs: Any) -> str:
        return parse_text_response(await self._send(method, url, **kwargs))
