"""Table engine: classification, archive/verify/trim, retention, crash recovery, manifest, query tooling."""
from __future__ import annotations

import dataclasses
import gzip
import hashlib
import json
import os
import random
import shutil
from datetime import date, datetime, timedelta, timezone

import pytest

from radar.config import PATHS
from radar.storage import housekeeping as hk
from radar.storage import tables as T
from radar.storage.synth import alert_row, dumps, event_row, gen_member_ticks, scan_row

UTC = timezone.utc
AS_OF = datetime(2026, 9, 26, 3, 30, tzinfo=UTC)          # Sat 03:30Z = Fri 23:30 EDT, after the 9/25 session
STEPS = ["partitions_written", "backups_purged", "manifest_written", "hot_trimmed", "ops_written"]


# ------------------------------------------------------------------ helpers

@pytest.fixture
def small_limits(monkeypatch):
    """Scale limits down so tests run in seconds; the logic is identical."""
    over = {"member_ticks": dict(max_rows=2000, max_bytes=1 * T.MiB),
            "events": dict(max_rows=300, max_bytes=256 * T.KiB, external_max_bytes=200 * T.KiB),
            "scan_log": dict(max_rows=400)}
    specs = tuple(dataclasses.replace(s, **over.get(s.name, {})) for s in T.TABLES)
    monkeypatch.setattr(hk, "TABLES", specs)
    monkeypatch.setattr(hk, "BY_NAME", {s.name: s for s in specs})
    return {s.name: s for s in specs}


def write_jsonl(path, rows, mode="w"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode + "b") as f:
        for r in rows:
            f.write((dumps(r) + "\n").encode())


def read_jsonl(path):
    if not os.path.exists(path):
        return []
    with open(path, "rb") as f:
        return [json.loads(x) for x in hk.jsonl_lines(f.read().decode()) if x.strip()]


def digest(root, exclude=("ops/",)):
    out = {}
    for d, _, files in os.walk(root):
        for fn in files:
            rel = os.path.relpath(os.path.join(d, fn), root).replace("\\", "/")
            if rel.startswith(".git") or any(rel.startswith(e) for e in exclude):
                continue
            with open(os.path.join(d, fn), "rb") as f:
                out[rel] = hashlib.sha256(f.read()).hexdigest()
    return out


def backup_rows(root, table):
    rows = []
    bdir = os.path.join(root, "backups", table)
    if os.path.isdir(bdir):
        for fn in sorted(os.listdir(bdir)):
            if fn.endswith(".jsonl.gz"):
                with open(os.path.join(bdir, fn), "rb") as f:
                    rows += [json.loads(x) for x in hk.jsonl_lines(gzip.decompress(f.read()).decode())]
    return rows


def mt_rows(start, days, members=20, ticks=4, seed=1):
    return gen_member_ticks(start, days=days, names=members, ticks_per_day=ticks, seed=seed)


def seed_side_tables(root, start, days):
    rng = random.Random(5)
    ev, sc = [], []
    d = start
    for _ in range(days):
        if d.weekday() < 5:
            t = d.replace(hour=14, minute=0, tzinfo=UTC)
            ev += [event_row(t, "NVDA", "ENTER", rng), event_row(t + timedelta(minutes=45), "NVDA", "EXIT", rng)]
            sc += [scan_row(t + timedelta(minutes=5 * i), rng) for i in range(3)]
        d += timedelta(days=1)
    write_jsonl(os.path.join(root, PATHS["events"]), ev)
    write_jsonl(os.path.join(root, PATHS["scan_log"]), sc)


def pk(row, spec):
    return "|".join(str(row[k]) for k in spec.pk)


def write_alerts(main, alerts, **extra):
    os.makedirs(os.path.join(main, "alerts"), exist_ok=True)
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "w", encoding="utf-8", newline="\n") as f:
        json.dump({"alerts": alerts, **extra}, f, indent=2)


@pytest.fixture
def history_fixture(tmp_path, small_limits):
    """Hot member_ticks 2026-06-01..08-14 archived once at as_of 2026-08-15, then 08-17..09-25 appended."""
    root = str(tmp_path / "data")
    first = mt_rows(datetime(2026, 6, 1, tzinfo=UTC), 55)
    write_jsonl(os.path.join(root, PATHS["member_ticks"]), first)
    seed_side_tables(root, datetime(2026, 6, 1, tzinfo=UTC), 110)
    rep = hk.run(root, now=datetime(2026, 8, 15, 3, 30, tzinfo=UTC), run_id="hk-first", repeats=1)
    assert rep["tables"]["member_ticks"]["status"] == "DEGRADED"
    second = mt_rows(datetime(2026, 8, 17, tzinfo=UTC), 30, seed=2)
    write_jsonl(os.path.join(root, PATHS["member_ticks"]), second, mode="a")
    return root, first + second


# ------------------------------------------------------------------ registry

def test_registry_matches_spec_section_6():
    assert {s.name: (s.path, s.pk, s.ts, s.branch) for s in T.TABLES} == {
        "member_ticks": ("radar/member_ticks.jsonl", ("tick", "ticker"), "tick", "data"),
        "events": ("radar/events.jsonl", ("id",), "ts", "data"),
        "scan_log": ("radar/scan_log.jsonl", ("tick", "run_id"), "tick", "data"),
        "table_metrics": ("ops/table_metrics.jsonl", ("run_id", "table"), "measured_at", "data"),
        "housekeeping_runs": ("ops/housekeeping_runs.jsonl", ("run_id",), "started_at", "data"),
        "alerts_log": ("alerts/log.json", ("ts", "ticker"), "ts", "main"),
    }
    assert T.BY_NAME["alerts_log"].max_rows == 180
    assert T.SNAPSHOT_GUARDS == {
        "radar/state.json": 256 * T.KiB, "radar/engine.json": 256 * T.KiB,
        "radar/baselines.json.gz": 2 * T.MiB, "radar/baselines_extra.json.gz": 2 * T.MiB,
        "ops/health.json": 64 * T.KiB, "backups/manifest.json": 256 * T.KiB,
    }


def test_write_p95_from_git_prev():
    rng = random.Random(1)
    t0 = datetime(2026, 9, 25, 14, 0, tzinfo=UTC)
    rows = [scan_row(t0 + timedelta(minutes=5 * i), rng, stage_commit_ms=100 + i) for i in range(60)]
    assert T.write_p95_ms(rows) == 100 + 10 + round(0.95 * 49)          # newest 50 rows only
    assert T.write_p95_ms(rows[:9]) is None                              # fewer than 10 samples
    none = [{**r, "git_prev": {**r["git_prev"], "status": "none"}} for r in rows]
    assert T.write_p95_ms(none) is None                                  # first ticks carry no timing


def test_scanner_request_limits_match_the_registry():
    """The tick raises the on-demand request at 1.25 x max_bytes of the per-tick tables (SPEC section 8)."""
    tick = pytest.importorskip("radar.tick")
    assert tick.HOT_MAX_BYTES == {s.name: s.max_bytes for s in T.TABLES if s.per_tick}


@pytest.mark.parametrize("as_of,expected", [
    (date(2026, 9, 27), datetime(2026, 6, 27, tzinfo=UTC)),
    (date(2026, 5, 31), datetime(2026, 2, 28, tzinfo=UTC)),
    (date(2024, 5, 31), datetime(2024, 2, 29, tzinfo=UTC)),
    (date(2026, 1, 15), datetime(2025, 10, 15, tzinfo=UTC)),
    (date(2026, 11, 30), datetime(2026, 8, 30, tzinfo=UTC)),
])
def test_retention_cutoff_calendar_months(as_of, expected):
    assert hk.retention_cutoff(as_of) == expected


# ------------------------------------------------------------------ archive / trim

def test_small_tables_untouched(tmp_path, small_limits):
    root = str(tmp_path)
    write_jsonl(os.path.join(root, PATHS["member_ticks"]), mt_rows(datetime(2026, 9, 14, tzinfo=UTC), 10))
    before = digest(root)
    rep = hk.run(root, now=AS_OF, repeats=1)
    assert rep["tables"]["member_ticks"]["status"] in ("OK", "WARN")
    assert digest(root, exclude=("ops/", "backups/manifest.json")) == before
    assert not os.path.exists(os.path.join(root, "backups/member_ticks"))


def test_volume_triggers_archive_and_trim(tmp_path, small_limits):
    root = str(tmp_path)
    rows = mt_rows(datetime(2026, 9, 8, tzinfo=UTC), 14)          # 14 trading days x 80 rows = 1120
    rows += mt_rows(datetime(2026, 8, 3, tzinfo=UTC), 14, seed=9)  # older block -> 2240 rows > 2000
    write_jsonl(os.path.join(root, PATHS["member_ticks"]), rows)
    spec = small_limits["member_ticks"]
    rep = hk.run(root, now=AS_OF, repeats=1)
    t = rep["tables"]["member_ticks"]
    assert t["status"] == "DEGRADED" and any(r.startswith("rows") for r in t["reasons"])
    hot, bak = read_jsonl(os.path.join(root, spec.path)), backup_rows(root, "member_ticks")
    assert len(hot) <= spec.target_ratio * spec.max_rows
    assert {pk(r, spec) for r in hot}.isdisjoint({pk(r, spec) for r in bak})
    assert {pk(r, spec) for r in hot} | {pk(r, spec) for r in bak} == {pk(r, spec) for r in rows}
    floor = AS_OF - timedelta(hours=spec.min_hot_hours)
    assert all(hk.parse_ts(r["tick"]) < floor for r in bak)       # nothing from the last session was archived
    assert hk.verify(root)["problems"] == []
    m = hk.load_manifest(root)[0]["partitions"]
    assert set(m) == {"member_ticks/2026-08", "member_ticks/2026-09"}
    assert sum(e["rows"] for e in m.values()) == len(bak)


def test_write_path_latency_degrades_big_per_tick_tables_only(tmp_path, small_limits):
    root = str(tmp_path)
    spec = small_limits["member_ticks"]
    rows = mt_rows(datetime(2026, 9, 8, tzinfo=UTC), 12, members=32)   # 1536 rows, >= 50% of max_bytes
    write_jsonl(os.path.join(root, spec.path), rows)
    rng = random.Random(2)
    t0 = datetime(2026, 9, 25, 14, 0, tzinfo=UTC)
    write_jsonl(os.path.join(root, PATHS["scan_log"]),
                [scan_row(t0 + timedelta(minutes=5 * i), rng, stage_commit_ms=900) for i in range(20)])
    assert os.path.getsize(os.path.join(root, spec.path)) >= 0.5 * spec.max_bytes
    rep = hk.run(root, now=AS_OF, repeats=1)
    assert any(r.startswith("write_p95_ms") for r in rep["tables"]["member_ticks"]["reasons"])
    assert rep["tables"]["member_ticks"]["status"] == "DEGRADED"
    assert not any(r.startswith("write_p95_ms") for r in rep["tables"]["scan_log"]["reasons"])  # small table


def test_events_squeeze_aims_below_the_browser_ceiling(tmp_path):
    """events is bound by the 512 KiB browser ceiling, not its 1 MiB max_bytes: trimming to half of 1 MiB would
    leave it at the ceiling, DEGRADED again the next day."""
    root = str(tmp_path)
    spec = T.BY_NAME["events"]
    rng, rows, t = random.Random(8), [], AS_OF - timedelta(days=16)
    while t < AS_OF - timedelta(days=4):
        rows.append(event_row(t, rng.choice(["NVDA", "TSLA", "AMD"]), "ENTER", rng))
        t += timedelta(minutes=10)
    write_jsonl(os.path.join(root, spec.path), rows)
    size = os.path.getsize(os.path.join(root, spec.path))
    assert spec.external_max_bytes < size < spec.max_bytes and len(rows) < spec.max_rows
    rep = hk.run(root, now=AS_OF, repeats=1)
    t = rep["tables"]["events"]
    assert t["status"] == "DEGRADED" and [r.split()[0] for r in t["reasons"]] == ["client_bytes"]
    assert spec.byte_limit == spec.external_max_bytes and t["bytes_after"] <= spec.target_ratio * spec.byte_limit
    assert len(backup_rows(root, "events")) + t["rows_after"] == len(rows)


def test_rerun_is_idempotent(history_fixture):
    root, _ = history_fixture
    hk.run(root, now=AS_OF, run_id="hk-x", repeats=1)
    d1 = digest(root)
    rep2 = hk.run(root, now=AS_OF, run_id="hk-x", repeats=1)
    assert digest(root) == d1
    assert rep2["partitions_written"] == [] and rep2["partitions_deleted"] == []
    assert all(t["archive_rows"] == 0 and t["purge_rows"] == 0 for t in rep2["tables"].values())


def test_month_partition_appended_twice_has_no_duplicates(tmp_path, small_limits):
    root = str(tmp_path)
    spec = small_limits["member_ticks"]
    a = mt_rows(datetime(2026, 9, 1, tzinfo=UTC), 6)
    write_jsonl(os.path.join(root, spec.path), a)
    hk.run(root, now=AS_OF, force_tables=["member_ticks"], repeats=1)
    n1 = len(backup_rows(root, "member_ticks"))
    # second archive into the SAME month, overlapping: re-insert already-archived rows plus new older rows
    b = mt_rows(datetime(2026, 9, 1, tzinfo=UTC), 6) + mt_rows(datetime(2026, 9, 9, tzinfo=UTC), 3, seed=4)
    write_jsonl(os.path.join(root, spec.path), b, mode="a")
    hk.run(root, now=AS_OF, force_tables=["member_ticks"], repeats=1)
    bak = backup_rows(root, "member_ticks")
    keys = [pk(r, spec) for r in bak]
    assert len(keys) == len(set(keys))
    assert len(bak) >= n1
    assert hk.verify(root)["problems"] == []


def test_retention_purges_hot_and_backups(history_fixture):
    root, all_rows = history_fixture
    cutoff = hk.retention_cutoff(AS_OF.date())                     # 2026-06-26
    hk.run(root, now=AS_OF, repeats=1)
    m = hk.load_manifest(root)[0]["partitions"]
    assert not any(k.endswith("/2026-05") for k in m)
    for table in ("member_ticks", "events", "scan_log"):
        spec = T.BY_NAME[table]
        for r in backup_rows(root, table) + read_jsonl(os.path.join(root, spec.path)):
            assert hk.parse_ts(r[spec.ts]) >= cutoff, (table, r[spec.ts])
    june = m["member_ticks/2026-06"]
    assert june["min_ts"] >= "2026-06-26" and june["rows"] > 0
    spec = T.BY_NAME["member_ticks"]
    alive = {pk(r, spec) for r in all_rows if hk.parse_ts(r["tick"]) >= cutoff}
    have = {pk(r, spec) for r in backup_rows(root, "member_ticks") + read_jsonl(os.path.join(root, spec.path))}
    assert alive == have                                           # every unexpired row survives somewhere


@pytest.mark.parametrize("step", STEPS)
def test_crash_at_each_step_then_rerun_converges(history_fixture, tmp_path, monkeypatch, step):
    root, all_rows = history_fixture
    clean = str(tmp_path / "clean")
    shutil.copytree(root, clean)
    hk.run(clean, now=AS_OF, run_id="hk-z", repeats=1)
    expected = digest(clean)

    def boom(s):
        if s == step:
            raise hk.SimulatedCrash(s)
    monkeypatch.setattr(hk, "checkpoint", boom)
    with pytest.raises(hk.SimulatedCrash):
        hk.run(root, now=AS_OF, run_id="hk-z", repeats=1)
    spec = T.BY_NAME["member_ticks"]
    cutoff = hk.retention_cutoff(AS_OF.date())
    alive = {pk(r, spec) for r in all_rows if hk.parse_ts(r["tick"]) >= cutoff}
    have = {pk(r, spec) for r in backup_rows(root, "member_ticks") + read_jsonl(os.path.join(root, spec.path))}
    assert alive <= have                                           # no unexpired row missing after the crash
    monkeypatch.setattr(hk, "checkpoint", lambda s: None)
    hk.run(root, now=AS_OF, run_id="hk-z", repeats=1)
    assert digest(root) == expected
    assert hk.verify(root)["problems"] == []


# ------------------------------------------------------------------ errors and repairs

def test_corrupt_partition_blocks_that_table_only(history_fixture):
    root, _ = history_fixture
    p = os.path.join(root, "backups/member_ticks/2026-07.jsonl.gz")
    with open(p, "r+b") as f:
        f.seek(40)
        f.write(b"\x00garbage\x00")
    hot_before = digest(root)[PATHS["member_ticks"]]
    rep = hk.run(root, now=AS_OF, repeats=1)
    assert rep["tables"]["member_ticks"]["status"] == "ERROR"
    assert "member_ticks" in rep["partition_errors"]
    assert digest(root)[PATHS["member_ticks"]] == hot_before      # not trimmed
    assert rep["tables"]["events"]["status"] != "ERROR"


def test_stray_file_in_backups_freezes_its_table(history_fixture):
    root, _ = history_fixture
    stray = os.path.join(root, "backups/scan_log/notes.jsonl.gz")
    os.makedirs(os.path.dirname(stray), exist_ok=True)
    with open(stray, "wb") as f:
        f.write(gzip.compress(b"x"))
    rep = hk.run(root, now=AS_OF, repeats=1)
    assert rep["tables"]["scan_log"]["status"] == "ERROR"
    assert rep["tables"]["member_ticks"]["status"] != "ERROR"
    assert any("notes.jsonl.gz" in p for p in hk.verify(root)["problems"])


def test_manifest_rebuilt_from_files(history_fixture):
    root, _ = history_fixture
    before = hk.load_manifest(root)[0]["partitions"]
    os.remove(os.path.join(root, T.MANIFEST_PATH))
    rebuilt, problem = hk.load_manifest(root)
    assert problem is None
    repairs, errors = hk.reconcile_manifest(root, rebuilt, AS_OF, "hk-r", hk.retention_cutoff(date(2026, 8, 15)))
    after = rebuilt["partitions"]
    assert not errors and len(repairs) == len(before) and set(after) == set(before)
    fields = ("sha256", "content_sha256", "rows", "min_ts", "max_ts")
    for k in before:
        assert {x: before[k][x] for x in fields} == {x: after[k][x] for x in fields}
    rep = hk.run(root, now=AS_OF, repeats=1)          # a real run repairs, reports it, and proceeds
    assert rep["manifest_repairs"] and hk.verify(root)["problems"] == []


def test_unreadable_manifest_is_rebuilt(history_fixture):
    root, _ = history_fixture
    with open(os.path.join(root, T.MANIFEST_PATH), "wb") as f:
        f.write(b"{truncated")
    rep = hk.run(root, now=AS_OF, repeats=1)
    assert "unreadable" in rep["manifest_repairs"][0]
    assert not rep["partition_errors"] and hk.verify(root)["problems"] == []


def test_unparseable_lines_are_kept(tmp_path, small_limits):
    root = str(tmp_path)
    spec = small_limits["member_ticks"]
    write_jsonl(os.path.join(root, spec.path), mt_rows(datetime(2026, 8, 3, tzinfo=UTC), 30))
    with open(os.path.join(root, spec.path), "ab") as f:
        f.write(b"{not json\n")
    rep = hk.run(root, now=AS_OF, repeats=1)
    with open(os.path.join(root, spec.path), "rb") as f:
        assert b"{not json" in f.read()
    assert rep["tables"]["member_ticks"]["bad_rows"] == 1


LINE_BREAKERS = (" ", " ", "\x85")   # str.splitlines() breaks on them; json.dumps leaves them literal


def test_jsonl_lines_splits_on_newline_only():
    text = "".join(dumps({"k": f"a{ch}b"}) + "\n" for ch in LINE_BREAKERS)
    assert [json.loads(x)["k"] for x in hk.jsonl_lines(text)] == [f"a{ch}b" for ch in LINE_BREAKERS]
    assert hk.jsonl_lines("") == [] and hk.jsonl_lines("a\n\nb") == ["a", "", "b"]   # inner blank line kept


def test_unicode_line_separators_in_alerts_are_archived_intact(tmp_path):
    """STO-1: partition lines are canonical JSON with ensure_ascii=False, so U+2028, U+2029 and U+0085 sit in them
    literally. Splitting on those made write_partition_verified raise PartitionCorrupt and fail the whole job."""
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    rng = random.Random(4)
    alerts = [alert_row(AS_OF - timedelta(hours=8 * (i + 1)), rng.choice(["NVDA", "TSLA", "AMD"]), rng)
              for i in range(185)]                                  # newest first; 185 rows > max_rows
    for i, ch in enumerate(LINE_BREAKERS):
        alerts[-1 - i]["headline"] = f"a{ch}b"                      # among the oldest rows: archived
    write_alerts(main, alerts)                                       # json.dump stores them as   escapes
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, force_tables=["alerts_log"], repeats=1)
    assert rep["outcome"] == "ok" and not rep["partition_errors"]
    assert rep["main_trim"]["alerts_log"]["status"] == "trimmed"
    spec = T.BY_NAME["alerts_log"]
    index = {hk.pk_of(spec, r): hk.canon(r) for r in backup_rows(data, "alerts_log")}
    assert all(index[hk.pk_of(spec, a)] == hk.canon(a) for a in alerts[-3:])
    assert hk.verify(data)["problems"] == []
    with open(os.path.join(main, T.ALERTS_LOG_PATH), encoding="utf-8") as f:
        left = {hk.pk_of(spec, a) for a in json.load(f)["alerts"]}
    assert not left & {hk.pk_of(spec, a) for a in alerts[-3:]}


def test_unicode_line_separators_in_jsonl_rows_survive_a_trim(tmp_path):
    """STO-1: a hot JSONL row holding U+2029 / U+0085 is one row, not two unparseable fragments that the trim
    rewrites with a newline between them (destroying the row and keeping the fragments forever)."""
    root = str(tmp_path)
    spec = T.BY_NAME["events"]
    rng = random.Random(6)
    old = {**event_row(AS_OF - timedelta(days=40), "AMD", "EXIT", rng), "detail": "old\x85row"}
    young = {**event_row(AS_OF - timedelta(days=2), "NVDA", "ENTER", rng), "detail": "young row"}
    plain = [event_row(AS_OF - timedelta(days=d), "TSLA", "ENTER", rng) for d in (35, 3)]
    write_jsonl(os.path.join(root, spec.path), [old, plain[0], plain[1], young])
    rep = hk.run(root, now=AS_OF, force_tables=["events"], repeats=1)
    t = rep["tables"]["events"]
    assert t["bad_rows"] == 0 and t["rows"] == 4 and t["archive_rows"] == 2 and t["rows_after"] == 2
    with open(os.path.join(root, spec.path), "rb") as f:
        assert f.read().decode("utf-8") == dumps(plain[1]) + "\n" + dumps(young) + "\n"   # exact lines kept
    assert backup_rows(root, "events") == [old, plain[0]]
    assert hk.verify(root)["problems"] == []


def test_snapshot_guards_are_reported_not_acted_on(tmp_path):
    root = str(tmp_path)
    big = {PATHS["state"]: 300 * T.KiB, PATHS["engine"]: 10 * T.KiB, PATHS["baselines"]: 2 * T.MiB + 1}
    for rel, size in big.items():
        os.makedirs(os.path.dirname(os.path.join(root, rel)), exist_ok=True)
        with open(os.path.join(root, rel), "wb") as f:
            f.write(b"x" * size)
    before = digest(root)
    rep = hk.run(root, now=AS_OF, repeats=1)
    with open(os.path.join(root, T.HEALTH_PATH), encoding="utf-8") as f:
        snaps = json.load(f)["snapshots"]
    assert {rel: g["status"] for rel, g in snaps.items()} == {
        "radar/state.json": "DEGRADED", "radar/engine.json": "OK", "radar/baselines.json.gz": "DEGRADED",
        "radar/baselines_extra.json.gz": "OK", "ops/health.json": "OK", "backups/manifest.json": "OK"}
    assert all(digest(root)[rel] == before[rel] for rel in big)
    assert "radar/state.json 300 KiB > 256 KiB" in hk.render_markdown(rep)


# ------------------------------------------------------------------ alerts log (main)

def test_alerts_log_two_phase(tmp_path, small_limits):
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    rng = random.Random(3)
    alerts, t = [], AS_OF - timedelta(days=60)
    while t < AS_OF:
        alerts.append(alert_row(t, rng.choice(["NVDA", "TSLA", "AMD"]), rng))
        t += timedelta(hours=5)
    alerts.reverse()                                                 # newest first, like the routine writes it
    write_alerts(main, alerts, note="keep me")
    before = digest(main)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, publish_data=lambda r: False, repeats=1)
    assert rep["tables"]["alerts_log"]["status"] == "DEGRADED" and rep["outcome"] == "publish_failed"
    assert digest(main) == before                                   # data push failed -> main untouched
    assert len(backup_rows(data, "alerts_log")) > 0                 # rows already safe on data (local)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, repeats=1)
    assert rep["main_trim"]["alerts_log"]["status"] == "trimmed"
    with open(os.path.join(main, T.ALERTS_LOG_PATH), encoding="utf-8") as f:
        after = json.load(f)
    spec = small_limits["alerts_log"]
    assert after["note"] == "keep me"
    assert len(after["alerts"]) <= spec.target_ratio * spec.max_rows
    assert after["alerts"] == sorted(after["alerts"], key=lambda a: a["ts"], reverse=True)
    assert after["alerts"][0]["ts"] == alerts[0]["ts"]
    kept = {a["ts"] + a["ticker"] for a in after["alerts"]}
    bak = {a["ts"] + a["ticker"] for a in backup_rows(data, "alerts_log")}
    # SPEC 12.4: the rows left on main are backed up too (backup only), so the backups hold every row
    assert bak == {a["ts"] + a["ticker"] for a in alerts} and kept <= bak


def test_alerts_trim_retries_on_concurrent_write(tmp_path):
    spec = T.BY_NAME["alerts_log"]
    main = str(tmp_path)
    rows = [{"ts": f"2026-07-0{i}T15:00:00Z", "ticker": "AMD"} for i in range(1, 6)]
    write_alerts(main, rows)
    store = hk.DirStore(main)
    real_write, calls = store.write_cas, {"n": 0}

    def racing_write(rel, data, ver):
        calls["n"] += 1
        if calls["n"] == 1:   # the routine appends a new alert between our read and our write
            with open(os.path.join(main, rel), encoding="utf-8") as f:
                cur = json.load(f)
            cur["alerts"].insert(0, {"ts": "2026-09-25T15:00:00Z", "ticker": "NEW"})
            write_alerts(main, cur["alerts"])
        return real_write(rel, data, ver)
    store.write_cas = racing_write
    res = hk.trim_main_table(store, spec, {f"{r['ts']}|AMD": {hk.canon(r)} for r in rows[:3]})
    assert res["status"] == "trimmed" and res["attempts"] == 2
    with open(os.path.join(main, spec.path), encoding="utf-8") as f:
        final = json.load(f)["alerts"]
    assert [a["ticker"] for a in final] == ["NEW", "AMD", "AMD"]


def test_duplicate_alert_versions_are_all_trimmed_and_the_winner_backed_up(tmp_path):
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    old = datetime(2026, 7, 20, 15, 0, tzinfo=UTC)
    first = {"ts": hk.iso(old), "ticker": "AMD", "v": "first"}
    second = {"ts": hk.iso(old), "ticker": "AMD", "v": "second"}
    write_alerts(main, [second, first])                              # newest first: `second` was written last
    hk.run(data, hk.DirStore(main), now=AS_OF, force_tables=["alerts_log"], repeats=1)
    with open(os.path.join(main, T.ALERTS_LOG_PATH), encoding="utf-8") as f:
        assert json.load(f)["alerts"] == []
    assert backup_rows(data, "alerts_log") == [second]


def test_unreadable_alerts_log_is_frozen(tmp_path):
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    os.makedirs(os.path.join(main, "alerts"))
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "wb") as f:
        f.write(b'{"alerts": [')
    before = digest(main)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, force_tables=["alerts_log"], repeats=1)
    assert rep["tables"]["alerts_log"]["status"] == "ERROR" and "invalid JSON" in rep["tables"]["alerts_log"]["error"]
    assert digest(main) == before and rep["main_trim"] == {}


def routine_cap(main, new, cap=200):
    """The alerts routine: prepend the new alerts (newest first) and keep the newest `cap`; returns the drops."""
    with open(os.path.join(main, T.ALERTS_LOG_PATH), encoding="utf-8") as f:
        merged = list(reversed(new)) + json.load(f)["alerts"]
    write_alerts(main, merged[:cap])
    return merged[cap:]


def test_every_run_backs_up_the_alerts_log_so_the_routine_cap_drops_only_backed_up_rows(tmp_path):
    """STO-2 / SPEC 12.4: a WARN log (170 rows, not DEGRADED) is copied to the backups in full while main stays
    untouched. The routine then adds 40 alerts and cuts the log to 200 rows: every row it drops is backed up."""
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    rng = random.Random(7)
    alerts = [alert_row(AS_OF - timedelta(hours=2 * (i + 1)), rng.choice(["NVDA", "TSLA", "AMD"]), rng)
              for i in range(170)]
    write_alerts(main, alerts)
    before = digest(main)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, trigger="schedule", repeats=1)
    t = rep["tables"]["alerts_log"]
    assert t["status"] == "WARN" and t["archive_rows"] == 0 and t["backup_only_rows"] == 170
    assert digest(main) == before and rep["main_trim"] == {}        # backup only: main is not written
    assert "Backed up and kept hot (backup only): alerts_log 170 rows" in hk.render_markdown(rep)

    new = [alert_row(AS_OF + timedelta(hours=10, minutes=i), "NEW", rng) for i in range(40)]
    dropped = routine_cap(main, new)
    assert len(dropped) == 10
    window = (AS_OF - timedelta(days=60), AS_OF + timedelta(days=2))
    backed = {hk.canon(r) for r in hk.query(data, "alerts_log", *window)}         # backups only (no main store)
    assert {hk.canon(r) for r in dropped} <= backed

    rep = hk.run(data, hk.DirStore(main), now=AS_OF + timedelta(days=1), trigger="schedule", repeats=1)
    assert rep["tables"]["alerts_log"]["status"] == "DEGRADED"
    assert rep["main_trim"]["alerts_log"]["status"] == "trimmed"
    assert {hk.canon(r) for r in hk.query(data, "alerts_log", *window)} == {hk.canon(r) for r in alerts + new}
    assert hk.verify(data)["problems"] == []


def main_alerts(main):
    with open(os.path.join(main, T.ALERTS_LOG_PATH), encoding="utf-8") as f:
        return json.load(f)["alerts"]


def pending_file(data):
    path = os.path.join(data, T.PENDING_MAIN_TRIM_PATH)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)["tables"]


def test_an_ok_alerts_log_keeps_its_rows_on_main_until_retention(tmp_path):
    """INT-2 / SPEC 12.6: the backup-only copies never heal main. An OK log keeps rows older than hot_days on main
    night after night (they used to leave after 30 days); only retention (3 months) takes them off."""
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    rng = random.Random(9)
    spec = T.BY_NAME["alerts_log"]
    alerts = [alert_row(AS_OF - timedelta(days=i + 1), "AMD", rng) for i in range(60)]   # 60 rows: OK
    write_alerts(main, alerts)
    before = digest(main)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, trigger="schedule", repeats=1)
    assert rep["tables"]["alerts_log"]["status"] == "OK" and digest(main) == before
    assert sorted(map(hk.canon, backup_rows(data, "alerts_log"))) == sorted(map(hk.canon, alerts))
    expired_nights = 0
    for night in range(1, 41):
        now = AS_OF + timedelta(days=night)
        on_main = main_alerts(main)
        rep = hk.run(data, hk.DirStore(main), now=now, trigger="schedule", repeats=1)
        t = rep["tables"]["alerts_log"]
        alive = [a for a in alerts if hk.parse_ts(a["ts"]) >= hk.retention_cutoff(now.date())]
        assert t["status"] == "OK" and t["heal_rows"] == t["archive_rows"] == 0, (night, t)
        assert t["purge_rows"] == len(on_main) - len(alive), night
        assert main_alerts(main) == alive, night                       # older than hot_days, still on main
        assert rep["pending_main_trim"] == {} and pending_file(data) is None
        if len(alive) == len(alerts):
            assert digest(main) == before, night                       # not even rewritten
        expired_nights += len(alive) < len(on_main)
    assert expired_nights and 0 < len(main_alerts(main)) < len(alerts)   # retention did run on main ...
    assert all(hk.parse_ts(a["ts"]) < now - timedelta(days=spec.hot_days) for a in main_alerts(main))  # hot_days not
    assert {hk.canon(a) for a in alive} <= set(map(hk.canon, backup_rows(data, "alerts_log")))


def test_a_deferred_daytime_archive_is_trimmed_by_the_next_nightly_run(tmp_path):
    """SPEC 12.6: a daytime forced archive of an OK log (main not written) lists its rows in
    ops/pending_main_trim.json; the next nightly run removes exactly those rows, then the list is cleared. Before,
    the nightly heal only removed the few that had meanwhile passed hot_days and left the rest on main."""
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    spec = T.BY_NAME["alerts_log"]
    t_day = datetime(2026, 10, 6, 15, 0, tzinfo=UTC)                    # Tuesday, inside 13:00-21:30 UTC
    rng = random.Random(10)
    alerts = [alert_row(t_day - timedelta(hours=6 * i + 3), f"T{i}", rng) for i in range(120)]   # 30 days, OK
    write_alerts(main, alerts)
    before, size = digest(main), os.path.getsize(os.path.join(main, T.ALERTS_LOG_PATH))
    rep = hk.run(data, hk.DirStore(main), now=t_day, force_tables=["alerts_log"], trigger="manual",
                 main_writes=False, repeats=1)
    t = rep["tables"]["alerts_log"]
    target = int(spec.target_ratio * spec.max_rows)                   # the squeeze goes down to 99 rows
    archived = alerts[target:]
    assert t["status"] == "OK" and t["archive_rows"] == len(archived) == 21 and digest(main) == before
    trim = rep["main_trim"]["alerts_log"]
    assert trim["status"] == "deferred" and trim["removed"] == 0
    assert "the 21 rows listed in ops/pending_main_trim.json" in trim["detail"] and "nightly" in trim["detail"]
    listed = pending_file(data)["alerts_log"]
    assert [(e["pk"], e["sha256"]) for e in listed] == [(hk.pk_of(spec, a), hk.row_sha(a)) for a in archived[::-1]]
    assert rep["pending_main_trim"] == {"alerts_log": 21}
    assert "Main trims listed in ops/pending_main_trim.json" in hk.render_markdown(rep)
    # the ops tables report what main still holds, not the deferred plan
    assert (t["rows_after"], t["bytes_after"]) == (120, size)
    with open(os.path.join(data, T.HEALTH_PATH), encoding="utf-8") as f:
        health = json.load(f)["tables"]["alerts_log"]
    assert (health["rows"], health["bytes"]) == (120, size)
    metric = [r for r in read_jsonl(os.path.join(data, "ops/table_metrics.jsonl")) if r["table"] == "alerts_log"][-1]
    assert (metric["rows_after"], metric["bytes_after"]) == (120, size)

    night = datetime(2026, 10, 7, 3, 30, tzinfo=UTC)
    rep = hk.run(data, hk.DirStore(main), now=night, trigger="schedule", repeats=1)
    t = rep["tables"]["alerts_log"]
    assert t["archive_rows"] == 0 and t["heal_rows"] == 21 and t["rows_after"] == target
    assert rep["main_trim"]["alerts_log"] == {"status": "trimmed", "removed": 21, "attempts": 1}
    assert main_alerts(main) == alerts[:target]
    assert not [p for p in rep["partitions_written"] if p.startswith("alerts_log/")]   # all backed up by day
    assert pending_file(data)["alerts_log"] == listed                 # kept until a run sees them gone from main

    after = digest(main)
    for d in range(1, 8):                     # a week of nights: rows pass hot_days, none leaves main
        rep = hk.run(data, hk.DirStore(main), now=night + timedelta(days=d), trigger="schedule", repeats=1)
        t = rep["tables"]["alerts_log"]
        assert t["heal_rows"] == t["archive_rows"] == t["purge_rows"] == 0 and rep["main_trim"] == {}
        assert rep["pending_main_trim"] == {} and pending_file(data) is None
    assert digest(main) == after
    assert any(hk.parse_ts(a["ts"]) < night + timedelta(days=7 - spec.hot_days) for a in main_alerts(main))
    window = (t_day - timedelta(days=40), t_day + timedelta(days=1))
    assert {hk.canon(r) for r in hk.query(data, "alerts_log", *window)} == {hk.canon(a) for a in alerts}
    assert hk.verify(data)["problems"] == []


def test_pending_main_trims_outlive_runs_that_cannot_use_them(tmp_path):
    """The list is kept by a run without main (data branch only) and by a run whose alerts log is frozen; an
    unreadable list is reported, ignored (main keeps the rows, nothing is lost) and removed; a listed row whose
    content changed on main is not removed."""
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    rng = random.Random(11)
    alerts = [alert_row(AS_OF - timedelta(days=i + 1), f"T{i}", rng) for i in range(50)]
    write_alerts(main, alerts)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, force_tables=["alerts_log"], main_writes=False, repeats=1)
    archived = rep["tables"]["alerts_log"]["archive_rows"]
    assert archived == 20 and rep["main_trim"]["alerts_log"]["status"] == "deferred"
    listed = pending_file(data)
    rep = hk.run(data, None, now=AS_OF + timedelta(hours=1), repeats=1)          # no main store
    assert pending_file(data) == listed and rep["pending_main_trim"] == {"alerts_log": archived}
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "rb") as f:
        good = f.read()
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "wb") as f:
        f.write(b'{"alerts": [')
    rep = hk.run(data, hk.DirStore(main), now=AS_OF + timedelta(hours=2), repeats=1)   # main unreadable: frozen
    assert rep["tables"]["alerts_log"]["status"] == "ERROR" and pending_file(data) == listed
    with open(os.path.join(main, T.ALERTS_LOG_PATH), "wb") as f:
        f.write(good)

    changed = {**alerts[-1], "headline": "edited by the routine"}             # the oldest listed row, new content
    write_alerts(main, alerts[:-1] + [changed])
    rep = hk.run(data, hk.DirStore(main), now=AS_OF + timedelta(hours=3), trigger="schedule", repeats=1)
    assert rep["tables"]["alerts_log"]["heal_rows"] == archived - 1
    assert main_alerts(main) == alerts[:30] + [changed]
    assert pending_file(data)["alerts_log"] == [e for e in listed["alerts_log"] if e["pk"] != hk.pk_of(
        T.BY_NAME["alerts_log"], changed)]

    with open(os.path.join(data, T.PENDING_MAIN_TRIM_PATH), "w", encoding="utf-8") as f:
        f.write("{truncated")
    before = digest(main)
    rep = hk.run(data, hk.DirStore(main), now=AS_OF + timedelta(hours=4), trigger="schedule", repeats=1)
    assert any("pending_main_trim.json unreadable" in r for r in rep["manifest_repairs"])
    assert rep["tables"]["alerts_log"]["heal_rows"] == 0 and digest(main) == before
    assert pending_file(data) is None and not rep["partition_errors"]


def test_backup_only_skips_a_frozen_alerts_log(tmp_path):
    data, main = str(tmp_path / "data"), str(tmp_path / "main")
    write_alerts(main, [alert_row(AS_OF - timedelta(days=1), "AMD", random.Random(1))])
    os.makedirs(os.path.join(data, "backups/alerts_log"))
    with open(os.path.join(data, "backups/alerts_log/2026-09.jsonl.gz"), "wb") as f:
        f.write(b"not a gzip file")
    rep = hk.run(data, hk.DirStore(main), now=AS_OF, repeats=1)
    t = rep["tables"]["alerts_log"]
    assert t["status"] == "ERROR" and t["backup_only_rows"] == 0 and rep["planned"]["partitions_write"] == []
    with open(os.path.join(data, "backups/alerts_log/2026-09.jsonl.gz"), "rb") as f:
        assert f.read() == b"not a gzip file"


# ------------------------------------------------------------------ dry-run, tooling, real volume

def test_dry_run_writes_nothing(history_fixture):
    root, _ = history_fixture
    before = digest(root, exclude=())
    rep = hk.run(root, now=AS_OF, mode="dry-run", repeats=1)
    assert digest(root, exclude=()) == before
    assert rep["planned"]["partitions_filter"] == ["member_ticks/2026-06"] or rep["planned"]["partitions_delete"]
    assert "| member_ticks |" in hk.render_markdown(rep)


def test_query_and_restore(history_fixture, tmp_path):
    root, all_rows = history_fixture
    hk.run(root, now=AS_OF, repeats=1)
    start, end = datetime(2026, 7, 1, tzinfo=UTC), datetime(2026, 9, 1, tzinfo=UTC)
    got = hk.query(root, "member_ticks", start, end, {"ticker": "NVDA"})
    spec = T.BY_NAME["member_ticks"]
    want = {pk(r, spec) for r in all_rows if r["ticker"] == "NVDA" and start <= hk.parse_ts(r["tick"]) < end}
    assert {pk(r, spec) for r in got} == want and len(got) == len(want)
    out = str(tmp_path / "restored.jsonl")
    info = hk.restore_month(root, "member_ticks", "2026-07", out)
    assert info["rows"] == len(read_jsonl(out)) > 0


def test_query_where_accepts_json_and_python_spellings(history_fixture, capsys):
    """STO-4: late=false / held_min=null (JSON) used to match nothing, silently."""
    root, _ = history_fixture
    start, end = datetime(2026, 6, 1, tzinfo=UTC), datetime(2026, 10, 1, tzinfo=UTC)
    q = lambda **where: hk.query(root, "events", start, end, where)   # noqa: E731
    rows = q()
    enters = [r for r in rows if r["held_min"] is None]
    assert rows and enters and len(enters) < len(rows) and all(r["late"] is False for r in rows)
    assert q(late="false") == q(late="False") == rows
    assert q(held_min="null") == q(held_min="None") == enters
    assert q(late="true") == q(late="0") == []
    assert q(ticker="NVDA") == q(ticker='"NVDA"') == rows
    with pytest.raises(SystemExit):
        hk.main(["query", "--help"])
    help_text = " ".join(capsys.readouterr().out.split())
    assert "late=false and late=False, held_min=null and held_min=None" in help_text


def test_cli_query_restore_verify(history_fixture, tmp_path, capsys):
    root, _ = history_fixture
    assert hk.main(["run", "--data-root", root, "--as-of", "2026-09-26T03:30:00Z"]) == 0
    capsys.readouterr()
    assert hk.main(["query", "--data-root", root, "--table", "member_ticks", "--from", "2026-07-01T00:00:00Z",
                    "--to", "2026-07-02T00:00:00Z", "--where", "ticker=NVDA"]) == 0
    lines = capsys.readouterr().out.splitlines()
    assert lines and all(json.loads(x)["ticker"] == "NVDA" and x.startswith('{"chg_5m_pct"') for x in lines)
    out = str(tmp_path / "m.jsonl")
    assert hk.main(["restore", "--data-root", root, "--table", "member_ticks", "--month", "2026-07", "--out", out]) == 0
    assert hk.main(["verify", "--data-root", root]) == 0
    with open(os.path.join(root, "backups/member_ticks/2026-07.jsonl.gz"), "ab") as f:
        f.write(b"tail")
    capsys.readouterr()
    assert hk.main(["verify", "--data-root", root]) == 2
    assert "sha256 mismatch" in capsys.readouterr().out
    assert hk.main(["restore", "--data-root", root, "--table", "member_ticks", "--month", "2026-07", "--out", out]) == 2


def test_real_thresholds_trigger_on_real_volume(tmp_path):
    """No scaling: 6 heavy sessions (72 names x 78 slots) exceed 8 MiB / 25k rows and are trimmed to target."""
    root = str(tmp_path)
    spec = T.BY_NAME["member_ticks"]
    rows = gen_member_ticks(datetime(2026, 9, 18, tzinfo=UTC), days=6, names=72, ticks_per_day=78)
    write_jsonl(os.path.join(root, spec.path), rows)
    rep = hk.run(root, now=AS_OF, repeats=1)
    t = rep["tables"]["member_ticks"]
    assert t["status"] == "DEGRADED", t
    assert {r.split()[0] for r in t["reasons"]} >= {"bytes", "rows"}
    assert t["rows_after"] <= spec.target_ratio * spec.max_rows
    assert t["bytes_after"] <= spec.target_ratio * spec.max_bytes
    assert hk.verify(root)["problems"] == []
