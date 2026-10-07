"""120-day soak: scanner volume at low / typical / high profiles, housekeeping every night, and after every
night the invariants of storage.md section 7 hold.

member_ticks and scan_log have their limits and their volume divided by the same factor (same days to
DEGRADED, same squeeze, same hot window), so the simulation runs in seconds. events, the ops tables and the
alerts log run at real volume and real limits.

The alerts routine keeps only the newest 200 rows, so at the storage.md high end (35 alerts a day) it drops rows
between two nightly runs. Every apply run copies all current alerts_log rows into the backups (backup only,
SPEC 12.4), so each row the routine drops must already be backed up: the soak counts the drops and asserts that
none of them is unbacked, at every profile (and that the high profile really does drop rows). Housekeeping
itself must never lose a row it saw. Those copies never take a row off main (SPEC 12.6): a log that is not
DEGRADED loses main rows only by retention or a listed pending main trim.

The git soak checks the history invariant on a local bare remote: 14 days by default, 120 with RADAR_SOAK=1.
Both tests carry the `soak` marker: CI runs them in their own job (SPEC 12.3).
"""
from __future__ import annotations

import dataclasses
import glob
import gzip
import hashlib
import json
import os
import random
import subprocess
from datetime import date, datetime, time, timedelta, timezone

import pytest

from radar.config import PATHS
from radar.storage import gitops
from radar.storage import housekeeping as hk
from radar.storage import housekeeping_job as job
from radar.storage import tables as T
from radar.storage.synth import PROFILES, append_jsonl, scanner_write, session_day_rows, trading_days

UTC = timezone.utc
SCALE = {"member_ticks": 50, "scan_log": 6}
START = date(2026, 10, 1)            # covers Thanksgiving, both half days, Christmas and New Year
DAYS = 120
PARTITION_MAX_BYTES = 50 * 1024 * 1024
ROUTINE_CAP = 200                     # the alerts routine keeps the newest 200 rows
ROUTINE_DROPS_HAPPEN = {"low": False, "typical": False, "high": True}   # all of them backed up beforehand
SCANNER_TABLES = ("member_ticks", "events", "scan_log")


@pytest.fixture
def scaled(monkeypatch):
    specs = tuple(dataclasses.replace(s, max_bytes=s.max_bytes // SCALE[s.name], max_rows=s.max_rows // SCALE[s.name])
                  if s.name in SCALE else s for s in T.TABLES)
    monkeypatch.setattr(hk, "TABLES", specs)
    monkeypatch.setattr(hk, "BY_NAME", {s.name: s for s in specs})
    return {s.name: s for s in specs}


def morning_after(d: date) -> datetime:
    return datetime.combine(d + timedelta(days=1), time(3, 30), tzinfo=UTC)


def routine_append(main: str, alerts: list[dict]) -> list[dict]:
    """The alerts routine: newest first, capped at ROUTINE_CAP rows. Returns the rows that fell off."""
    path = os.path.join(main, T.ALERTS_LOG_PATH)
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    merged = list(reversed(alerts)) + doc["alerts"]
    doc["alerts"] = merged[:ROUTINE_CAP]
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=2)
    return merged[ROUTINE_CAP:]


Stored = list[tuple[str, datetime, str]]      # (pk, ts, canonical JSON) per row


class Backups:
    """Partition rows on disk; each distinct file content is parsed once, and `verify` reruns only after a
    partition or its manifest entry changed (an unchanged set of files verifies the same way)."""

    def __init__(self, specs: dict[str, T.TableSpec]) -> None:
        self.specs = specs
        self._parsed: dict[str, Stored] = {}
        self._verified: str | None = None

    def scan(self, root: str) -> tuple[dict[str, Stored], str]:
        out: dict[str, Stored] = {}
        state = hashlib.sha256(hk.canon(hk.load_manifest(root)[0]["partitions"]).encode())
        for path in sorted(glob.glob(os.path.join(root, "backups", "*", "*.jsonl.gz"))):
            with open(path, "rb") as f:
                blob = f.read()
            key = hashlib.sha256(blob).hexdigest()
            state.update(f"{os.path.basename(path)}:{key}".encode())
            table = os.path.basename(os.path.dirname(path))
            if key not in self._parsed:
                spec = self.specs[table]
                # partition lines are canonical, so the line itself is the row's canonical JSON
                self._parsed[key] = [(hk.pk_of(spec, r), hk.parse_ts(r[spec.ts]), line)
                                     for line in hk.jsonl_lines(gzip.decompress(blob).decode("utf-8"))
                                     for r in (json.loads(line),)]
            out.setdefault(table, []).extend(self._parsed[key])
        return out, state.hexdigest()

    def verify(self, root: str, state: str) -> None:
        if state != self._verified:
            assert hk.verify(root)["problems"] == []
            self._verified = state


def hot_rows(spec: T.TableSpec, root: str) -> Stored:
    ht = hk.read_hot_bytes(spec, hk.read_file(os.path.join(root, spec.path)))
    return [(r.pk, r.ts, hk.canon(r.row)) for r in ht.rows]


def check_invariants(specs: dict, data: str, main: str, now: datetime, cache: Backups,
                     generated: dict[str, dict[str, tuple[datetime, str]]], report: dict) -> None:
    cutoff = hk.retention_cutoff(now.date())
    backups, state = cache.scan(data)
    for name, spec in specs.items():
        root = main if spec.branch == "main" else data
        hot = hot_rows(spec, root)
        stored = backups.get(name, []) + hot
        # no row older than the cutoff anywhere
        assert all(ts >= cutoff for _, ts, _ in stored), (name, now)
        # hot tables within their limits
        size = os.path.getsize(os.path.join(root, spec.path))
        assert len(hot) <= spec.max_rows and size <= spec.byte_limit, (name, now, len(hot), size)
        # backups and hot together hold every generated row not older than the cutoff; on the data branch they
        # are disjoint, while every alerts_log row left on main is also in the backups, identical (SPEC 12.4)
        if spec.branch == "main":
            bak = {k: line for k, _, line in backups.get(name, [])}
            assert len(bak) == len(backups.get(name, [])) and len({k for k, _, _ in hot}) == len(hot), (name, now)
            assert all(bak.get(k) == line for k, _, line in hot), (name, now)
        else:
            keys = [k for k, _, _ in stored]
            assert len(keys) == len(set(keys)), (name, now)
        if name in generated:
            want = {k: c for k, (ts, c) in generated[name].items() if ts >= cutoff}
            assert {k: line for k, _, line in stored} == want, (name, now)
    # every partition under 50 MB at real volume
    for e in hk.load_manifest(data)[0]["partitions"].values():
        assert e["bytes"] * SCALE.get(e["table"], 1) < PARTITION_MAX_BYTES, e
    cache.verify(data, state)
    assert not report["partition_errors"] and report["outcome"] == "ok"


@pytest.mark.soak
@pytest.mark.parametrize("profile", ["low", "typical", "high"])
def test_soak_120_days(profile, scaled, tmp_path):
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    os.makedirs(os.path.join(main, "alerts"))
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "w", encoding="utf-8") as f:
        json.dump({"alerts": []}, f)
    rng, cache = random.Random(profile), Backups(scaled)
    generated: dict[str, dict[str, tuple[datetime, str]]] = {n: {} for n in (*SCANNER_TABLES, "alerts_log")}
    alerts_spec = scaled["alerts_log"]

    def record(name: str, rows: list[dict]) -> None:
        spec = scaled[name]
        generated[name].update({hk.pk_of(spec, r): (hk.parse_ts(r[spec.ts]), hk.canon(r)) for r in rows})

    archived_runs, routine_drops, unbacked_drops, main_trims = 0, 0, [], 0
    for d, session in trading_days(START, DAYS):
        if session is not None:
            day = session_day_rows(session, PROFILES[profile], rng, mt_scale=SCALE["member_ticks"],
                                   scan_scale=SCALE["scan_log"])
            for name in SCANNER_TABLES:
                rows = getattr(day, name)
                append_jsonl(data, PATHS[name], rows)
                record(name, rows)
            record("alerts_log", day.alerts)
            backed_up = {k: line for k, _, line in cache.scan(data)[0].get("alerts_log", [])}
            for r in routine_append(main, day.alerts):     # dropped by the routine's 200-row cap
                routine_drops += 1
                key = hk.pk_of(alerts_spec, r)
                if backed_up.get(key) != hk.canon(r):      # ... before any backup held it
                    generated["alerts_log"].pop(key)
                    unbacked_drops.append((d.isoformat(), key))
        now = morning_after(d)
        on_main = {k: ts for k, ts, _ in hot_rows(alerts_spec, main)}
        listed = {e["pk"] for e in hk.load_pending(data)[0].get("alerts_log", [])}
        rep = hk.run(data, hk.DirStore(main), now=now, run_id=f"hk-{d:%Y%m%d}", trigger="schedule", repeats=1)
        archived_runs += any(t["archive_rows"] for t in rep["tables"].values())
        check_invariants(scaled, data, main, now, cache, generated, rep)
        # SPEC 12.6: a log that is not DEGRADED loses main rows only by retention or a listed pending trim (never
        # because the backup-only copies hold them), and once the trim lands no listed row is left on main
        left = {k for k, _, _ in hot_rows(alerts_spec, main)}
        cutoff = hk.retention_cutoff(now.date())
        if rep["tables"]["alerts_log"]["status"] != "DEGRADED":
            assert all(k in listed or on_main[k] < cutoff for k in set(on_main) - left), (profile, now)
        main_trims += bool(set(on_main) - left)
        assert left.isdisjoint(e["pk"] for e in hk.load_pending(data)[0].get("alerts_log", [])), (profile, now)
    assert unbacked_drops == [], unbacked_drops[:5]       # SPEC 12.4: the nightly backup-only copy closes the gap
    assert bool(routine_drops) == ROUTINE_DROPS_HAPPEN[profile], routine_drops
    assert main_trims                    # main was trimmed (retention at least) and the rules above were checked
    if profile != "low":
        assert archived_runs >= 3        # the archive path, not only retention, was exercised


# ------------------------------------------------------------------ git soak (history invariant)

def sh(cwd: str, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def configure(repo: str) -> None:
    for k, v in (("user.email", "bot@example.invalid"), ("user.name", "bot"), ("core.autocrlf", "false")):
        sh(repo, "config", k, v)


@pytest.fixture
def remote(tmp_path):
    bare = str(tmp_path / "remote.git")
    sh(str(tmp_path), "init", "-q", "--bare", bare)
    seed = str(tmp_path / "seed")
    sh(str(tmp_path), "init", "-q", "-b", "data", seed)
    configure(seed)
    with open(os.path.join(seed, "README.md"), "w") as f:
        f.write("data branch\n")
    sh(seed, "add", "-A")
    sh(seed, "commit", "-q", "-m", "init")
    sh(seed, "push", "-q", bare, "data")
    return bare


def tick_writer(rows: list[dict]):
    def apply(repo: str, attempt: int) -> str:
        append_jsonl(repo, PATHS["member_ticks"], rows)
        return "radar tick"
    return apply


def clone(bare: str, path: str, *extra: str) -> str:
    sh(os.path.dirname(path), "clone", "-q", "-c", "core.autocrlf=false", *extra, "-b", "data",
       "file://" + bare.replace("\\", "/"), path)
    configure(path)
    return path


@pytest.mark.soak
def test_git_soak_history_stays_short(scaled, remote, tmp_path):
    days = DAYS if os.environ.get("RADAR_SOAK") == "1" else 14
    start = date(2026, 11, 20)                   # Thanksgiving + half day inside the default 14 days
    scan = clone(remote, str(tmp_path / "scan"), "--depth", "1")
    hkrepo = clone(remote, str(tmp_path / "hk"))
    main = str(tmp_path / "main")
    os.makedirs(os.path.join(main, "alerts"))
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "w", encoding="utf-8") as f:
        json.dump({"alerts": []}, f)
    rng = random.Random(11)
    writes_since_squash, squashes, blocked_night = 1, 0, start + timedelta(days=4)
    for d, session in trading_days(start, days):
        if session is not None:
            day = session_day_rows(session, PROFILES["typical"], rng, mt_scale=SCALE["member_ticks"])
            half = len(day.member_ticks) // 2
            for chunk in (day.member_ticks[:half], day.member_ticks[half:]):   # two scanner ticks a day
                res = scanner_write(scan, tick_writer(chunk), sleep=lambda s: None)
                assert res["status"] == "pushed"
                writes_since_squash += 1
            routine_append(main, day.alerts)
        busy = (lambda: "1 radar-scan.yml run(s) in progress") if d == blocked_night else (lambda: None)
        result = job.run_job(hkrepo, hk.DirStore(main), now=morning_after(d), squash_policy="auto",
                             scanner_busy=busy, run_id=f"hk-{d:%Y%m%d}", repeats=1, sleep=lambda s: None)
        assert result.publish["status"] == "pushed", result.publish
        assert result.publish["squashed"] == (d != blocked_night)
        if result.publish["squashed"]:
            writes_since_squash, squashes = 1, squashes + 1
        else:
            writes_since_squash += 1
        assert gitops.commit_count(remote, gitops.REF) <= writes_since_squash
        assert hk.verify(hkrepo)["problems"] == []
    assert squashes == days - 1
    check = clone(remote, str(tmp_path / "check"))
    with open(os.path.join(check, ".gitattributes"), "rb") as f:
        assert f.read() == gitops.GITATTRIBUTES
