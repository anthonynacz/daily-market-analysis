"""main:alerts/log.json through the GitHub REST contents API (storage.md section 3.2, phase B).

`ContentsStore` has the same read -> (bytes, version) / write_cas(bytes, version) -> bool shape as
housekeeping.DirStore. The version is the file's blob sha: a PUT carrying a stale sha is refused with
409 or 422, which makes the write a compare-and-swap, so an alert the routine appends between our
read and our write is never lost (the trim re-reads and retries).
"""
from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable

from radar.storage.housekeeping import StoreError

API_ROOT = "https://api.github.com"
TRANSIENT_STATUS = frozenset({429, 500, 502, 503, 504})
CAS_CONFLICT_STATUS = frozenset({409, 422})

# (method, url, headers, body, timeout_s) -> (status, lower-cased headers, body)
Transport = Callable[[str, str, dict[str, str], bytes | None, float], tuple[int, dict[str, str], bytes]]


class ContentsApiError(StoreError):
    pass


def urllib_transport(method: str, url: str, headers: dict[str, str], body: bytes | None,
                     timeout: float) -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, e.read()


class GitHubApi:
    """Minimal REST client: JSON in and out, transient failures (network, 429, 5xx, rate limit) retried."""

    def __init__(self, token: str | None, *, transport: Transport = urllib_transport, api_root: str = API_ROOT,
                 tries: int = 3, timeout_s: float = 20.0, sleep: Callable[[float], None] = time.sleep):
        self.token, self.transport, self.api_root = token, transport, api_root.rstrip("/")
        self.tries, self.timeout_s, self.sleep = tries, timeout_s, sleep

    def request(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict | list | None]:
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                   "User-Agent": "momentum-radar-housekeeping"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        last = ""
        for attempt in range(1, self.tries + 1):
            try:
                status, resp_headers, raw = self.transport(method, self.api_root + path, headers, body, self.timeout_s)
            except OSError as e:          # URLError, timeouts, resets
                last = f"{method} {path}: {e}"
            else:
                if not _transient(status, resp_headers):
                    return status, _json_or_none(raw)
                last = f"{method} {path}: HTTP {status}"
            if attempt < self.tries:
                self.sleep(2.0 ** attempt)
        raise ContentsApiError(last)


def _transient(status: int, headers: dict[str, str]) -> bool:
    rate_limited = status == 403 and (headers.get("x-ratelimit-remaining") == "0" or "retry-after" in headers)
    return status in TRANSIENT_STATUS or rate_limited


def _json_or_none(raw: bytes) -> dict | list | None:
    try:
        return json.loads(raw.decode("utf-8")) if raw else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def _message(body: object) -> str:
    return str(body.get("message", "")) if isinstance(body, dict) else ""


class ContentsStore:
    """Files of one branch through the contents API, with sha compare-and-swap writes.

    After a refused write it waits `conflict_backoff_s` before the caller re-reads: right after a commit the
    contents API can still serve the previous sha for a moment, and an immediate re-read would lose again.
    """

    def __init__(self, api: GitHubApi, repo: str, *, branch: str = "main",
                 commit_message: str = "Housekeeping: trim alerts log (rows backed up on the data branch)",
                 conflict_backoff_s: float = 2.0):
        self.api, self.repo, self.branch, self.commit_message = api, repo, branch, commit_message
        self.conflict_backoff_s = conflict_backoff_s

    def _path(self, rel: str) -> str:
        return f"/repos/{self.repo}/contents/{urllib.parse.quote(rel)}"

    def read(self, rel: str) -> tuple[bytes | None, str | None]:
        status, body = self.api.request("GET", f"{self._path(rel)}?ref={urllib.parse.quote(self.branch)}")
        if status == 404:
            return None, None
        if status != 200 or not isinstance(body, dict) or body.get("type") != "file":
            raise ContentsApiError(f"GET {rel}@{self.branch}: HTTP {status} {_message(body)}".strip())
        sha = body["sha"]
        if body.get("encoding") == "base64":
            return base64.b64decode(body.get("content") or ""), sha
        # Files over 1 MB come back without content; the blob API still serves them.
        status, blob = self.api.request("GET", f"/repos/{self.repo}/git/blobs/{sha}")
        if status != 200 or not isinstance(blob, dict) or blob.get("encoding") != "base64":
            raise ContentsApiError(f"GET blob {sha} of {rel}: HTTP {status} {_message(blob)}".strip())
        return base64.b64decode(blob.get("content") or ""), sha

    def write_cas(self, rel: str, data: bytes, expected_version: str | None) -> bool:
        payload = {"message": self.commit_message, "content": base64.b64encode(data).decode("ascii"),
                   "branch": self.branch}
        if expected_version:
            payload["sha"] = expected_version
        status, body = self.api.request("PUT", self._path(rel), payload)
        if status in (200, 201):
            return True
        if status in CAS_CONFLICT_STATUS:
            self.api.sleep(self.conflict_backoff_s)
            return False
        raise ContentsApiError(f"PUT {rel}@{self.branch}: HTTP {status} {_message(body)}".strip())
