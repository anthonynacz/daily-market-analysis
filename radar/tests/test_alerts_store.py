"""main:alerts/log.json through the contents API: compare-and-swap on the blob sha, retries, two-phase trim.

The HTTP layer is a fake GitHub (no network): it keeps one branch of files, answers GET/PUT like the REST
contents API (409 on a stale sha, 422 on a missing one) and can inject failures.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import random
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, unquote, urlparse

import pytest

from radar.storage import housekeeping as hk
from radar.storage import housekeeping_job as job
from radar.storage import tables as T
from radar.storage.alerts_store import ContentsApiError, ContentsStore, GitHubApi
from radar.storage.synth import alert_row

UTC = timezone.utc
AS_OF = datetime(2026, 9, 26, 3, 30, tzinfo=UTC)
REPO = "owner/repo"
PATH = T.ALERTS_LOG_PATH


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


class FakeGitHub:
    """Transport for GitHubApi: one branch of files, the REST contents semantics the store relies on."""

    def __init__(self, files: dict[str, bytes] | None = None, *, branch: str = "main", large_bytes: int = 1_000_000):
        self.files = dict(files or {})
        self.branch, self.large_bytes = branch, large_bytes
        self.calls: list[tuple[str, str, dict, dict | None]] = []
        self.fail: list[int | Exception] = []     # consumed one per request before it is served
        self.on_put = None                         # hook(fake) run just before a PUT is judged

    def __call__(self, method: str, url: str, headers: dict, body: bytes | None, timeout: float):
        payload = json.loads(body) if body else None
        self.calls.append((method, url, headers, payload))
        if self.fail:
            f = self.fail.pop(0)
            if isinstance(f, Exception):
                raise f
            extra = {"x-ratelimit-remaining": "0"} if f == 403 else {}
            return f, extra, b'{"message": "injected"}'
        u = urlparse(url)
        if u.path.startswith(f"/repos/{REPO}/git/blobs/"):
            sha = u.path.rsplit("/", 1)[1]
            data = next((d for d in self.files.values() if blob_sha(d) == sha), None)
            if data is None:
                return 404, {}, b'{"message": "Not Found"}'
            return 200, {}, self._json({"sha": sha, "encoding": "base64", "content": self._b64(data)})
        rel = unquote(u.path.split("/contents/", 1)[1])
        if method == "GET":
            assert parse_qs(u.query) == {"ref": [self.branch]}
            data = self.files.get(rel)
            if data is None:
                return 404, {}, b'{"message": "Not Found"}'
            meta = {"type": "file", "path": rel, "sha": blob_sha(data), "size": len(data)}
            if len(data) > self.large_bytes:                     # the API omits content above 1 MB
                return 200, {}, self._json({**meta, "encoding": "none", "content": ""})
            return 200, {}, self._json({**meta, "encoding": "base64", "content": self._b64(data)})
        assert method == "PUT" and payload["branch"] == self.branch
        if self.on_put:
            hook, self.on_put = self.on_put, None
            hook(self)
        current = self.files.get(rel)
        if current is not None and "sha" not in payload:
            return 422, {}, b'{"message": "Invalid request. \\"sha\\" wasn\'t supplied."}'
        if current is not None and payload["sha"] != blob_sha(current):
            return 409, {}, self._json({"message": f"{rel} does not match {payload['sha']}"})
        self.files[rel] = base64.b64decode(payload["content"])
        return (201 if current is None else 200), {}, self._json({"content": {"sha": blob_sha(self.files[rel])}})

    @staticmethod
    def _b64(data: bytes) -> str:
        enc = base64.b64encode(data).decode()
        return "\n".join(enc[i:i + 60] for i in range(0, len(enc), 60)) + "\n"   # GitHub wraps at 60 chars

    @staticmethod
    def _json(obj: dict) -> bytes:
        return json.dumps(obj).encode()

    def puts(self) -> int:
        return sum(1 for m, *_ in self.calls if m == "PUT")


def make_store(fake: FakeGitHub, sleeps: list[float] | None = None) -> ContentsStore:
    record = sleeps.append if sleeps is not None else (lambda s: None)
    return ContentsStore(GitHubApi("tok", transport=fake, sleep=record), REPO)


def alerts_doc(rows: list[dict], **extra) -> bytes:
    return (json.dumps({"alerts": rows, **extra}, indent=2) + "\n").encode()


def old_alerts(n: int, *, days: int = 60) -> list[dict]:
    """n alerts spread over the last `days` days, newest first (the routine's order)."""
    rng, step = random.Random(3), timedelta(days=days) / n
    return [alert_row(AS_OF - step * (i + 1), rng.choice(["NVDA", "TSLA", "AMD"]), rng) for i in range(n)]


def data_backup_rows(data: str) -> list[dict]:
    rows = []
    bdir = os.path.join(data, "backups", "alerts_log")
    for fn in sorted(os.listdir(bdir)) if os.path.isdir(bdir) else []:
        rows += hk.read_partition(os.path.join(bdir, fn), T.BY_NAME["alerts_log"])
    return rows


# ------------------------------------------------------------------ the store

def test_read_returns_bytes_and_blob_sha_and_sends_auth():
    doc = alerts_doc([{"ts": "2026-09-25T15:00:00Z", "ticker": "AMD"}])
    fake = FakeGitHub({PATH: doc})
    data, sha = make_store(fake).read(PATH)
    assert data == doc and sha == blob_sha(doc)
    method, url, headers, _ = fake.calls[0]
    assert method == "GET" and url == f"https://api.github.com/repos/{REPO}/contents/alerts/log.json?ref=main"
    assert headers["Authorization"] == "Bearer tok" and headers["X-GitHub-Api-Version"] == "2022-11-28"


def test_missing_file_reads_as_none():
    assert make_store(FakeGitHub()).read(PATH) == (None, None)


def test_large_file_is_read_through_the_blob_api():
    doc = alerts_doc([{"ts": "2026-09-25T15:00:00Z", "ticker": "AMD", "pad": "x" * 2000}])
    fake = FakeGitHub({PATH: doc}, large_bytes=1000)
    assert make_store(fake).read(PATH) == (doc, blob_sha(doc))
    assert "/git/blobs/" in fake.calls[1][1]


def test_write_cas_succeeds_only_on_the_current_sha():
    doc = alerts_doc([])
    fake, sleeps = FakeGitHub({PATH: doc}), []
    store = make_store(fake, sleeps)
    assert store.write_cas(PATH, b"stale", "0" * 40) is False          # 409: someone committed since our read
    assert store.write_cas(PATH, b"no-sha", None) is False             # 422: the file exists, no sha supplied
    assert fake.files[PATH] == doc and sleeps == [2.0, 2.0]            # backs off before the caller re-reads
    assert store.write_cas(PATH, b"new", blob_sha(doc)) is True
    assert fake.files[PATH] == b"new"
    assert store.write_cas("alerts/other.json", b"{}", None) is True   # creating a file needs no sha


def test_transient_failures_are_retried_then_raise():
    doc = alerts_doc([])
    fake, sleeps = FakeGitHub({PATH: doc}), []
    fake.fail = [502, OSError("connection reset"), 403]                 # 403 with x-ratelimit-remaining: 0
    with pytest.raises(ContentsApiError):
        make_store(fake, sleeps).read(PATH)
    assert sleeps == [2.0, 4.0]
    fake.fail = [503]
    assert make_store(fake).read(PATH)[0] == doc                        # one blip, then served


def test_permission_error_is_not_a_conflict():
    fake = FakeGitHub({PATH: alerts_doc([])})
    real = fake.__call__

    def forbid(method, url, headers, body, timeout):
        if method == "PUT":
            return 403, {"x-ratelimit-remaining": "4999"}, b'{"message": "Resource not accessible by integration"}'
        return real(method, url, headers, body, timeout)
    store = ContentsStore(GitHubApi("tok", transport=forbid, sleep=lambda s: None), REPO)
    with pytest.raises(ContentsApiError, match="not accessible"):
        store.write_cas(PATH, b"x", blob_sha(fake.files[PATH]))


# ------------------------------------------------------------------ trim through the API

def test_trim_retries_after_a_409_and_keeps_the_routines_new_alert():
    rows = [{"ts": f"2026-07-0{i}T15:00:00Z", "ticker": "AMD"} for i in range(5, 0, -1)]   # newest first
    fake = FakeGitHub({PATH: alerts_doc(rows, note="keep me")})

    def routine_appends(f: FakeGitHub) -> None:        # lands between our GET and our PUT
        doc = json.loads(f.files[PATH])
        doc["alerts"].insert(0, {"ts": "2026-09-25T15:00:00Z", "ticker": "NEW"})
        f.files[PATH] = alerts_doc(doc["alerts"], note="keep me")
    fake.on_put = routine_appends
    remove = {f"{r['ts']}|AMD": {hk.canon(r)} for r in rows[-3:]}          # the three oldest were backed up
    res = hk.trim_main_table(make_store(fake), T.BY_NAME["alerts_log"], remove)
    assert res == {"status": "trimmed", "removed": 3, "attempts": 2}
    final = json.loads(fake.files[PATH])
    assert [a["ticker"] for a in final["alerts"]] == ["NEW", "AMD", "AMD"] and final["note"] == "keep me"


def test_trim_gives_up_after_five_conflicts_without_raising():
    rows = [{"ts": "2026-07-01T15:00:00Z", "ticker": "AMD"}]
    fake = FakeGitHub({PATH: alerts_doc(rows)})
    real = fake.__call__

    def always_stale(method, url, headers, body, timeout):
        if method == "PUT":
            fake.calls.append((method, url, headers, None))
            return 409, {}, b'{"message": "does not match"}'
        return real(method, url, headers, body, timeout)
    store = ContentsStore(GitHubApi("tok", transport=always_stale, sleep=lambda s: None), REPO)
    res = hk.trim_main_table(store, T.BY_NAME["alerts_log"], {"2026-07-01T15:00:00Z|AMD": {hk.canon(rows[0])}})
    assert res == {"status": "conflict", "removed": 0, "attempts": 5} and fake.puts() == 5


def test_two_phase_main_untouched_until_the_data_push_is_confirmed(tmp_path):
    data = str(tmp_path / "data")
    alerts = old_alerts(200)
    fake = FakeGitHub({PATH: alerts_doc(alerts)})
    rep = hk.run(data, make_store(fake), now=AS_OF, publish_data=lambda r: False, repeats=1)
    assert rep["tables"]["alerts_log"]["status"] == "DEGRADED" and rep["outcome"] == "publish_failed"
    assert fake.puts() == 0 and rep["main_trim"] == {}
    assert data_backup_rows(data)                                        # rows already safe on the data side

    rep = hk.run(data, make_store(fake), now=AS_OF, repeats=1)
    assert rep["main_trim"]["alerts_log"]["status"] == "trimmed" and fake.puts() == 1
    after = json.loads(fake.files[PATH])["alerts"]
    spec = T.BY_NAME["alerts_log"]
    assert len(after) <= spec.target_ratio * spec.max_rows
    assert after == sorted(after, key=lambda a: a["ts"], reverse=True) and after[0] == alerts[0]
    kept = {hk.pk_of(spec, a) for a in after}
    backed = {hk.pk_of(spec, a) for a in data_backup_rows(data)}
    # SPEC 12.4: the rows left on main are backed up too (backup only), so the backups hold every row
    assert backed == {hk.pk_of(spec, a) for a in alerts} and kept <= backed


def test_a_run_without_main_writes_defers_the_trim_to_the_next_nightly_run(tmp_path):
    """STO-3 / SPEC 12.4: a daytime run reads main and backs it up, but never PUTs; the nightly run trims."""
    data = str(tmp_path / "data")
    alerts = old_alerts(200)
    fake = FakeGitHub({PATH: alerts_doc(alerts)})
    before = fake.files[PATH]
    rep = hk.run(data, make_store(fake), now=AS_OF, main_writes=False, repeats=1)
    t = rep["tables"]["alerts_log"]
    assert t["status"] == "DEGRADED" and t["archive_rows"] > 0 and rep["outcome"] == "ok"
    assert rep["main_trim"]["alerts_log"]["status"] == "deferred"
    assert fake.puts() == 0 and fake.files[PATH] == before and {m for m, *_ in fake.calls} == {"GET"}
    spec = T.BY_NAME["alerts_log"]
    assert {hk.pk_of(spec, a) for a in data_backup_rows(data)} == {hk.pk_of(spec, a) for a in alerts}
    result = job.JobResult("apply", job.SquashDecision(False, "squash=skip"), report=rep,
                           publish={"status": "pushed", "sha": "a" * 40, "attempts": 1, "previous_head": "b" * 40})
    assert job.exit_code(result, AS_OF) == 0
    assert "**Main (alerts/log.json):** deferred, 0 rows removed" in job.render_summary(result, AS_OF)

    rep = hk.run(data, make_store(fake), now=AS_OF + timedelta(days=1), repeats=1)
    assert rep["main_trim"]["alerts_log"]["status"] == "trimmed" and fake.puts() == 1
    assert not [p for p in rep["partitions_written"] if p.startswith("alerts_log/")]   # nothing new to back up
    after = json.loads(fake.files[PATH])["alerts"]
    assert len(after) <= spec.target_ratio * spec.max_rows and after[0] == alerts[0]


def test_main_api_failure_is_reported_and_fails_the_job(tmp_path):
    data = str(tmp_path / "data")
    fake = FakeGitHub({PATH: alerts_doc(old_alerts(200))})
    store = make_store(fake)

    def publish_then_break(report: dict) -> bool:
        fake.fail = [502, 502, 502]                                      # main is down by the time phase B runs
        return True
    rep = hk.run(data, store, now=AS_OF, publish_data=publish_then_break, repeats=1)
    trim = rep["main_trim"]["alerts_log"]
    assert trim["status"] == "error" and "502" in trim["detail"]
    result = job.JobResult("apply", job.SquashDecision(False, "squash=skip"), report=rep,
                           publish={"status": "pushed", "sha": "a" * 40, "attempts": 1, "previous_head": "b" * 40})
    assert job.exit_code(result, AS_OF) == 1
    assert "error, 0 rows removed" in job.render_summary(result, AS_OF)


def test_main_unreachable_freezes_the_alerts_log_but_not_the_data_branch(tmp_path):
    data = str(tmp_path / "data")
    fake = FakeGitHub({PATH: alerts_doc(old_alerts(200))})
    fake.fail = [502, 502, 502]                                          # the GET for planning never succeeds
    rep = hk.run(data, make_store(fake), now=AS_OF, repeats=1)
    t = rep["tables"]["alerts_log"]
    assert t["status"] == "ERROR" and "main:alerts/log.json unreadable" in t["error"] and t["archive_rows"] == 0
    assert rep["outcome"] == "ok" and rep["main_trim"] == {} and fake.puts() == 0
    assert os.path.exists(os.path.join(data, T.HEALTH_PATH))            # the data-branch tables were processed
    result = job.JobResult("apply", job.SquashDecision(False, "squash=skip"), report=rep,
                           publish={"status": "pushed", "sha": "a" * 40, "attempts": 1, "previous_head": "b" * 40})
    assert job.exit_code(result, AS_OF) == 1


def test_dry_run_only_reads_main(tmp_path):
    fake = FakeGitHub({PATH: alerts_doc(old_alerts(200))})
    rep = hk.run(str(tmp_path / "data"), make_store(fake), now=AS_OF, mode="dry-run", repeats=1)
    assert rep["tables"]["alerts_log"]["archive_rows"] > 0
    assert {m for m, *_ in fake.calls} == {"GET"}
    assert not os.path.exists(tmp_path / "data")
