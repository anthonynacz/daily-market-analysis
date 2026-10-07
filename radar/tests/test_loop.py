"""radar.loop scheduling on a fake clock, tick isolation, failure handling and the git hand-off (SPEC 4.9)."""
from __future__ import annotations

import argparse
import io
import json
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.error
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

from radar import calendar_nyse as cal
from radar import delta, gitsync
from radar import loop as loop_mod
from radar.config import PATHS, RUNTIME
from radar.tests.test_gitsync import clone, remote, rows, sh  # noqa: F401 - remote is a fixture
from radar.tests.test_tick import check_scan_row, check_state
from radar.tick import SOURCE_HEALTH_FILE, iso, parse_tick_id, read_json, write_json_atomic

REPO_ROOT = Path(__file__).resolve().parents[2]
MON = cal.session_for(date(2026, 9, 28))          # EDT
EST_DAY = cal.session_for(date(2026, 11, 2))
HALF = cal.session_for(date(2026, 11, 27))


def at(value: str) -> float:
    return float(parse_tick_id(value))


class Clock:
    def __init__(self, start: str):
        self.t = at(start)
        self.naps: list[float] = []
        self.hooks: list = []

    def __call__(self) -> float:
        return self.t

    def sleep(self, s: float) -> None:
        assert s >= 0
        self.naps.append(s)
        self.t += s
        for hook in self.hooks:
            hook(self.t)


def parse_cmd(cmd: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    for opt in ("--data-dir", "--pending-dir", "--tick-id"):
        ap.add_argument(opt)
    for flag in ("--warmup", "--final", "--ignore-calendar"):
        ap.add_argument(flag, action="store_true")
    return ap.parse_args(cmd[1:])


class FakeTick:
    """Stands in for the tick subprocess: records what the loop prepared, then writes a delta like the real
    tick (scan_log row, state.json, and engine.json carried from the worktree)."""

    def __init__(self, clock: Clock, *, durations: dict[str, float] | None = None, results: dict[str, str] | None = None,
                 on_run=None):
        self.clock, self.durations, self.results, self.on_run = clock, durations or {}, results or {}, on_run
        self.runs: list[SimpleNamespace] = []

    def __call__(self, cmd: list[str], timeout_s: float, env: dict[str, str], stop=None) -> dict:
        a = parse_cmd(cmd)
        data = Path(a.data_dir)
        engine = json.loads((data / PATHS["engine"]).read_bytes())
        self.runs.append(SimpleNamespace(tick_id=a.tick_id, warmup=a.warmup, final=a.final, ignore=a.ignore_calendar,
                                         at=self.clock(), loop=engine["loop"], ops=engine.get("ops"), env=env,
                                         timeout=timeout_s, stop=stop, source_health=engine.get("source_health")))
        if self.on_run:
            self.on_run(a)
        self.clock.t += self.durations.get(a.tick_id, 20)
        status = self.results.get(a.tick_id, "ok")
        if status in ("timeout", "error"):
            return {"status": status, "message": "boom", "duration_ms": 1234}
        state = {"schema": 1, "tick_id": a.tick_id, "status": status, "members": [], "heating": [],
                 "health": {"published_late": engine["loop"]["published_late"]}}       # as Tick._health does
        delta.write_delta(a.pending_dir, a.tick_id, {PATHS["scan_log"]: [{"tick": a.tick_id}]},
                          {PATHS["state"]: state, PATHS["engine"]: engine}, kind="warmup" if a.warmup else "tick",
                          summary={"status": status, "members": 0, "entered": [], "exited": []})
        return {"status": status, "message": "", "members": 0, "entered": [], "exited": [], "duration_ms": 20_000}

    @property
    def ids(self) -> list[str]:
        return [r.tick_id for r in self.runs]


class Publisher:
    """Stands in for gitsync.publish: applies and drops every pending delta, like a push that landed. The
    first `fail` calls are rejected pushes that leave everything pending."""

    def __init__(self, error: Exception | None = None, fail: int = 0):
        self.calls: list[tuple[float, list[str]]] = []
        self.error, self.fail = error, fail

    def __call__(self, repo, pending_root, *, budget_s: float) -> gitsync.PublishResult:
        if self.error:
            raise self.error
        if self.fail:
            self.fail -= 1
            self.calls.append((budget_s, []))
            return gitsync.PublishResult(status="failed", attempts=5, detail="push rejected")
        names = []
        for d in delta.list_pending(pending_root):
            delta.apply_delta(d, repo)
            names.append(d.name)
            delta.remove(d)
        self.calls.append((budget_s, names))
        n = len(self.calls)
        if not names:
            return gitsync.PublishResult()
        return gitsync.PublishResult(status="ok", attempts=1, stage_ms=n, commit_ms=2, push_ms=300, pushed=names)


@pytest.fixture(autouse=True)
def no_git_config(monkeypatch):
    monkeypatch.setattr(gitsync, "configure", lambda repo: None)


def make(tmp_path: Path, start: str, *, engine: dict | None = None, state: dict | None = None, env: dict | None = None,
         durations=None, results=None, publish=None, dispatch=None, on_run=None, **kw):
    data, pending = tmp_path / "data", tmp_path / "pending"
    (data / "radar").mkdir(parents=True, exist_ok=True)
    if engine is not None:
        (data / PATHS["engine"]).write_bytes(delta.json_bytes(engine))
    if state is not None:
        (data / PATHS["state"]).write_bytes(delta.json_bytes(state))
    clock = Clock(start)
    fake = FakeTick(clock, durations=durations, results=results, on_run=on_run)
    pub = publish or Publisher()
    lp = loop_mod.Loop(data, pending, clock=clock, sleep=clock.sleep, run_tick=fake, publish=pub,
                       dispatch=dispatch or (lambda *a: pytest.fail("unexpected dispatch")),
                       env=env if env is not None else {"PATH": "x"}, tick_cmd=("tick",), **kw)
    return lp, clock, fake, pub


# ---------------------------------------------------------------- the plan

@pytest.mark.parametrize("session, warm, first, last_regular, final_run, n", [
    (MON, "2026-09-28T13:10:00Z", "2026-09-28T13:35:50Z", "2026-09-28T19:55:00Z", "2026-09-28T20:00:50Z", 78),
    (EST_DAY, "2026-11-02T14:10:00Z", "2026-11-02T14:35:50Z", "2026-11-02T20:55:00Z", "2026-11-02T21:00:50Z", 78),
    (HALF, "2026-11-27T14:10:00Z", "2026-11-27T14:35:50Z", "2026-11-27T17:55:00Z", "2026-11-27T18:00:50Z", 42),
])
def test_plan_session(session, warm, first, last_regular, final_run, n):
    warmup, ticks = loop_mod.plan_session(session)
    assert warmup.warmup and iso(warmup.tick_epoch) == warm == iso(warmup.run_at)
    assert len(ticks) == n and iso(ticks[0].run_at) == first and iso(ticks[-2].tick_epoch) == last_regular
    assert ticks[-1].final and ticks[-1].tick_epoch == session.close_epoch and iso(ticks[-1].run_at) == final_run
    assert not any(t.final for t in ticks[:-1])
    assert all(t.run_at - t.tick_epoch == RUNTIME["tick_offset_s"] for t in ticks[:-1])


def test_next_slot_skips_after_an_overrun_and_always_keeps_the_final_tick():
    _, ticks = loop_mod.plan_session(MON)
    slot, skipped = loop_mod.next_slot(ticks, at("2026-09-28T14:07:30Z"), int(at("2026-09-28T14:00:00Z")))
    assert (iso(slot.tick_epoch), skipped) == ("2026-09-28T14:10:00Z", 1)
    slot, skipped = loop_mod.next_slot(ticks, at("2026-09-28T20:07:00Z"), int(at("2026-09-28T19:50:00Z")))
    assert slot.final and skipped == 1                                  # late, but it runs
    assert loop_mod.next_slot(ticks, at("2026-09-28T20:07:00Z"), MON.close_epoch) == (None, 0)
    slot, skipped = loop_mod.next_slot(ticks, at("2026-09-28T12:33:00Z"), None)
    assert iso(slot.tick_epoch) == "2026-09-28T13:35:00Z" and skipped == 0


# ---------------------------------------------------------------- a whole session

def test_full_session_from_the_starter_cron(tmp_path):
    lp, clock, fake, pub = make(tmp_path, "2026-09-28T12:33:20Z", env={"GITHUB_TOKEN": "t", "GH_TOKEN": "t",
                                                                       "ACTIONS_RUNTIME_TOKEN": "t", "PATH": "x"},
                                retire_min=1000)
    assert lp.run() == 0
    runs = fake.runs
    assert len(runs) == 79 and runs[0].warmup and iso(runs[0].at) == "2026-09-28T13:10:00Z"
    assert fake.ids[1] == "2026-09-28T13:35:00Z" and iso(runs[1].at) == "2026-09-28T13:35:50Z"
    assert all(r.at - parse_tick_id(r.tick_id) == 50 for r in runs[1:])
    assert runs[-1].final and runs[-1].tick_id == "2026-09-28T20:00:00Z" and not any(r.final for r in runs[:-1])
    assert all(r.env == {"PATH": "x"} and r.timeout == RUNTIME["tick_timeout_s"] for r in runs)
    assert max(clock.naps) <= loop_mod.NAP_S                            # a SIGTERM is noticed within 5 s

    first, second, last = runs[1].loop, runs[2].loop, runs[-1].loop
    assert first["ticks_today"] == 1 and first["ticks_skipped"] == 0 and first["session"] == "2026-09-28"
    assert first["started_at"] == "2026-09-28T12:33:20Z" and first["last_tick"] == "2026-09-28T13:35:00Z"
    assert first["next_tick_at"] == "2026-09-28T13:40:50Z" and last["next_tick_at"] is None
    assert first["git_prev"] == {"stage": 1, "commit": 2, "push": 300, "attempts": 1, "status": "ok"}  # the warmup's push
    assert second["git_prev"]["stage"] == 2 and last["ticks_today"] == 78 and last["ticks_skipped"] == 0
    assert last["write_ms"][-1] == 78 + 2 and last["published_late"] == 0
    assert all(callable(r.stop) and r.stop() is False for r in runs)    # the tick can be stopped

    assert [b for b, _ in pub.calls] == [RUNTIME["push_budget_s"]] * 78 + [RUNTIME["final_push_budget_s"]]
    assert all(len(names) == 1 for _, names in pub.calls) and delta.list_pending(lp.pending) == []
    engine = json.loads((lp.data / PATHS["engine"]).read_bytes())
    assert engine["loop"]["last_tick"] == "2026-09-28T20:00:00Z"


def test_an_est_half_day_ends_at_the_early_close(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-11-27T13:07:00Z", retire_min=1000)
    lp.run()
    assert fake.ids[0] == "2026-11-27T14:10:00Z" and fake.runs[0].warmup
    assert fake.ids[-1] == "2026-11-27T18:00:00Z" and fake.runs[-1].final and len(fake.runs) == 43


def test_overrun_skips_the_missed_boundary_and_counts_it(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T13:50:00Z", durations={"2026-09-28T14:00:00Z": 400}, retire_min=40)
    lp.run()
    assert "2026-09-28T14:05:00Z" not in fake.ids
    after = fake.runs[fake.ids.index("2026-09-28T14:10:00Z")]
    assert iso(after.at) == "2026-09-28T14:10:50Z" and after.loop["ticks_skipped"] == 1


def test_final_tick_runs_even_after_an_overrun_past_the_close(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T19:40:00Z", durations={"2026-09-28T19:55:00Z": 700})
    lp.run()
    assert fake.ids == ["2026-09-28T19:40:00Z", "2026-09-28T19:45:00Z", "2026-09-28T19:50:00Z",
                        "2026-09-28T19:55:00Z", "2026-09-28T20:00:00Z"]
    assert fake.runs[-1].final and iso(fake.runs[-1].at) == "2026-09-28T20:07:30Z"
    assert fake.runs[-1].loop["ticks_skipped"] == 0


def test_the_loop_retires_before_a_tick_past_its_age_limit(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T12:33:00Z")          # retire at 18:03
    lp.run()
    assert fake.ids[-1] == "2026-09-28T18:00:00Z" and not any(r.final for r in fake.runs)


def test_successor_resumes_the_counters_of_the_session(tmp_path):
    prev = {"schema": 1, "loop": {"session": "2026-09-28", "ticks_today": 55, "ticks_skipped": 1,
                                  "last_tick": "2026-09-28T18:00:00Z", "write_ms": [7, 8],
                                  "git_prev": {"stage": 9, "commit": 9, "push": 9, "attempts": 2, "status": "resynced"}}}
    lp, _, fake, _ = make(tmp_path, "2026-09-28T18:20:10Z", engine=prev, retire_min=10)
    lp.run()
    first = fake.runs[0]
    assert first.tick_id == "2026-09-28T18:20:00Z" and not first.warmup
    assert first.loop["ticks_today"] == 56 and first.loop["ticks_skipped"] == 4      # 18:05, 18:10, 18:15 missed
    assert first.loop["git_prev"]["status"] == "resynced" and first.loop["write_ms"] == [7, 8]


def test_counters_of_another_session_are_not_carried(tmp_path):
    prev = {"schema": 1, "loop": {"session": "2026-09-25", "ticks_today": 78, "ticks_skipped": 3,
                                  "last_tick": "2026-09-25T20:00:00Z"}}
    lp, _, fake, _ = make(tmp_path, "2026-09-28T13:36:00Z", engine=prev, retire_min=5)
    lp.run()
    assert fake.ids[0] == "2026-09-28T13:40:00Z" and fake.runs[0].loop["ticks_today"] == 1
    assert fake.runs[0].loop["ticks_skipped"] == 0


def test_a_run_after_the_final_tick_exits_at_once(tmp_path):
    prev = {"schema": 1, "loop": {"session": "2026-09-28", "ticks_today": 78, "last_tick": "2026-09-28T20:00:00Z"}}
    lp, _, fake, _ = make(tmp_path, "2026-09-28T20:01:30Z", engine=prev)
    assert lp.run() == 0 and fake.runs == []


def test_no_session_today_means_no_tick(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-11-26T15:07:00Z")            # Thanksgiving
    assert lp.run() == 0 and fake.runs == []


def test_once_runs_a_single_tick_with_the_calendar_ignored(tmp_path):
    lp, _, fake, pub = make(tmp_path, "2026-10-03T15:02:10Z", once=True)
    assert lp.run() == 0
    (only,) = fake.runs
    assert only.tick_id == "2026-10-03T15:00:00Z" and only.ignore and not only.final and not only.warmup
    assert len(pub.calls) == 1


def test_no_push_applies_the_deltas_locally(tmp_path):
    publisher = Publisher(error=AssertionError("must not publish"))
    lp, _, fake, _ = make(tmp_path, "2026-10-03T15:02:10Z", once=True, push=False, publish=publisher)
    lp.run()
    assert json.loads((lp.data / PATHS["state"]).read_bytes())["tick_id"] == "2026-10-03T15:00:00Z"
    assert delta.list_pending(lp.pending) == []


# ---------------------------------------------------------------- stopping

def test_sigterm_while_waiting_stops_the_loop(tmp_path):
    lp, clock, fake, _ = make(tmp_path, "2026-09-28T13:36:00Z")
    stop_at = at("2026-09-28T13:52:00Z")
    clock.hooks.append(lambda t: t >= stop_at and not lp.stop and lp.request_stop(signal.SIGTERM, None))
    assert lp.run() == 0
    assert fake.ids == ["2026-09-28T13:40:00Z", "2026-09-28T13:45:00Z", "2026-09-28T13:50:00Z"]
    assert clock.t - stop_at <= loop_mod.NAP_S


def test_sigterm_during_a_tick_leaves_its_delta_for_the_flush_step(tmp_path):
    lp, _, fake, pub = make(tmp_path, "2026-09-28T13:36:00Z", on_run=lambda a: lp.request_stop(signal.SIGTERM, None))
    lp.run()
    assert len(fake.runs) == 1 and pub.calls == [] and len(delta.list_pending(lp.pending)) == 1


def test_signal_handlers_set_the_stop_flag(tmp_path):
    lp, *_ = make(tmp_path, "2026-09-28T13:36:00Z")
    saved = signal.getsignal(signal.SIGTERM), signal.getsignal(signal.SIGINT)
    try:
        loop_mod.install_signal_handlers(lp)
        signal.raise_signal(signal.SIGTERM)
        assert lp.stop
    finally:
        signal.signal(signal.SIGTERM, saved[0])
        signal.signal(signal.SIGINT, saved[1])


# ---------------------------------------------------------------- failures

PREV_STATE = {"schema": 1, "generated_at": "2026-09-28T14:30:51Z", "tick_id": "2026-09-28T14:30:00Z",
              "last_bar": "2026-09-28T14:30:00Z", "status": "ok", "message": "",
              "session": {"date": "2026-09-28", "phase": "regular", "open": "2026-09-28T13:30:00Z",
                          "close": "2026-09-28T20:00:00Z", "half_day": False},
              "next_tick_at": "2026-09-28T14:35:50Z", "params_version": "radar-sm-1",
              "source": {"name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": "2026-09-28T14:30:51Z"},
              "market": {"mode": "normal", "dir": None, "spy_chg_day_pct": 0.1, "spy_z30": 0.2, "breadth30": 0.5},
              "counts": {"universe": 5, "stage_b": 2, "members": 1, "heating": 0, "entered_today": 1, "exited_today": 0},
              "members": [{"ticker": "NVDA"}], "heating": [], "recent_exits": [], "sector_banners": [],
              "health": {"ticks_today": 12, "ticks_skipped": 0, "last_tick_ms": 900, "loop_run_id": "local",
                         "loop_started_at": "2026-09-28T12:33:00Z", "published_late": 0},
              "disclaimer": "Educational analysis of what is moving now, not a forecast and not financial advice."}


@pytest.mark.parametrize("status, word", [("timeout", "timed out"), ("error", "failed")])
def test_a_tick_that_wrote_nothing_is_logged_and_the_snapshot_republished(tmp_path, status, word):
    lp, _, fake, pub = make(tmp_path, "2026-09-28T14:34:00Z", state=PREV_STATE, results={"2026-09-28T14:35:00Z": status},
                            retire_min=3)
    lp.run()
    assert fake.ids == ["2026-09-28T14:35:00Z"] and len(pub.calls[0][1]) == 1
    state = json.loads((lp.data / PATHS["state"]).read_bytes())
    check_state(state)
    assert state["status"] == "error" and state["message"] == f"The last scan {word}. Stocks already on the radar are held, not dropped."
    assert state["members"] == [{"ticker": "NVDA"}] and state["tick_id"] == PREV_STATE["tick_id"]
    assert state["next_tick_at"] == "2026-09-28T14:40:50Z" and state["health"]["last_tick_ms"] == 1234
    assert state["health"]["ticks_today"] == 1
    (row,) = [json.loads(line) for line in (lp.data / PATHS["scan_log"]).read_text(encoding="utf-8").splitlines()]
    check_scan_row(row)
    assert row["tick"] == "2026-09-28T14:35:00Z" and row["status"] == "error" and row["session"] == "2026-09-28"
    assert row["phase"] == "regular" and row["lag_s"] == 50 and row["members"] == 1 and row["ms"]["total"] == 1234
    assert row["errors"] == [f"{status}: boom"]
    engine = json.loads((lp.data / PATHS["engine"]).read_bytes())
    assert engine["loop"]["last_tick"] == "2026-09-28T14:35:00Z"      # the loop's bookkeeping survives
    timed_out = status == "timeout"                                     # a killed tick counts as a failed call
    assert state["source"]["consecutive_failures"] == int(timed_out)
    assert state["source"]["status"] == ("down" if timed_out else "ok")


def test_a_failed_warmup_logs_without_touching_the_snapshot(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T13:09:00Z", state=PREV_STATE, results={"2026-09-28T13:10:00Z": "error"},
                          retire_min=10)
    lp.run()
    assert fake.runs[0].warmup
    assert json.loads((lp.data / PATHS["state"]).read_bytes()) == PREV_STATE
    assert "error: boom" in (lp.data / PATHS["scan_log"]).read_text(encoding="utf-8")


def test_an_error_result_with_a_delta_is_not_logged_twice(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T14:34:00Z", retire_min=3)
    fake.results = {"2026-09-28T14:35:00Z": "degraded"}
    lp.run()
    assert (lp.data / PATHS["scan_log"]).read_text(encoding="utf-8").count("\n") == 1


def test_a_publish_error_is_reported_on_the_next_tick(tmp_path):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T14:34:00Z", publish=Publisher(error=gitsync.GitError("index.lock")),
                          retire_min=8)
    lp.run()
    assert fake.runs[1].loop["git_prev"] == {"stage": 0, "commit": 0, "push": 0, "attempts": 0, "status": "failed"}
    assert fake.runs[1].loop["published_late"] == 1


def test_published_late_counts_the_earlier_scans_a_commit_delivers(tmp_path):
    """E2E-4: after two failed pushes the third commit carries three scans; its state.json says two were
    late, never that anything is still waiting."""
    lp, _, fake, pub = make(tmp_path, "2026-09-28T14:34:00Z", publish=Publisher(fail=2), retire_min=13)
    lp.run()
    assert fake.ids == ["2026-09-28T14:35:00Z", "2026-09-28T14:40:00Z", "2026-09-28T14:45:00Z"]
    assert [len(names) for _, names in pub.calls] == [0, 0, 3] and delta.list_pending(lp.pending) == []
    assert [r.loop["published_late"] for r in fake.runs] == [0, 1, 2]
    state = json.loads((lp.data / PATHS["state"]).read_bytes())
    assert state["tick_id"] == "2026-09-28T14:45:00Z" and state["health"] == {"published_late": 2}


# ---------------------------------------------------------------- source health of a tick that wrote nothing

HEALTHY = {"schema": 1, "name": "yahoo", "status": "ok", "consecutive_failures": 0, "last_ok_at": "2026-09-28T14:30:51Z",
           "workers": 16, "breaker": {"open": False, "opened_at": None, "calls": 0, "good_probes": 0}}
FIVE_MIN = ["2026-09-28T14:35:00Z", "2026-09-28T14:40:00Z", "2026-09-28T14:45:00Z"]


def engine_doc(lp) -> dict:
    return json.loads((lp.data / PATHS["engine"]).read_bytes())


def test_timed_out_ticks_open_the_breaker(tmp_path):
    """RT-1/E2E-1/DATA-2: a tick killed by the timeout saves no health of its own, so the loop counts it as a
    failed call; BREAKER_TRIP of them in a row switch the next tick to the Nasdaq fallback."""
    lp, clock, fake, _ = make(tmp_path, "2026-09-28T14:34:00Z", state=PREV_STATE,
                              engine={"schema": 1, "source_health": HEALTHY},
                              results={i: "timeout" for i in FIVE_MIN}, retire_min=18)
    lp.run()
    assert fake.ids == FIVE_MIN + ["2026-09-28T14:50:00Z"]
    assert [r.source_health["consecutive_failures"] for r in fake.runs] == [0, 1, 2, 3]
    assert [r.source_health["breaker"]["open"] for r in fake.runs] == [False, False, False, True]
    opened = fake.runs[-1].source_health
    assert opened["name"] == "nasdaq" and opened["status"] == "down" and opened["workers"] == 16
    assert opened["breaker"] == {"open": True, "opened_at": "2026-09-28T14:46:10Z", "calls": 0, "good_probes": 0}
    logged = [json.loads(line) for line in (lp.data / PATHS["scan_log"]).read_text(encoding="utf-8").splitlines()]
    assert [r["source"] for r in logged[:3]] == ["yahoo", "yahoo", "nasdaq"]


def test_the_killed_ticks_own_health_is_merged_before_counting_the_timeout(tmp_path):
    """The fetcher writes <pending>/source_health.json after every call; the loop merges it, then deletes it."""
    side = {**HEALTHY, "status": "down", "consecutive_failures": 2, "workers": 4}

    def tick_reached_two_failures(a):
        write_json_atomic(Path(a.pending_dir) / SOURCE_HEALTH_FILE, side)

    lp, _, _, _ = make(tmp_path, "2026-09-28T14:34:00Z", state=PREV_STATE,
                       engine={"schema": 1, "source_health": {**HEALTHY, "kept": True}},
                       results={FIVE_MIN[0]: "timeout"}, retire_min=3, on_run=tick_reached_two_failures)
    lp.run()
    h = engine_doc(lp)["source_health"]
    assert h["consecutive_failures"] == 3 and h["breaker"]["open"] is True and h["workers"] == 4 and h["kept"] is True
    assert not (lp.pending / SOURCE_HEALTH_FILE).exists()


def test_a_failed_tick_keeps_its_health_without_counting_and_a_stale_side_file_is_ignored(tmp_path):
    side = {**HEALTHY, "status": "degraded", "consecutive_failures": 1}
    stale = {**HEALTHY, "consecutive_failures": 9}
    (tmp_path / "pending").mkdir()
    write_json_atomic(tmp_path / "pending" / SOURCE_HEALTH_FILE, stale)      # left by an earlier tick
    lp, _, _, _ = make(tmp_path, "2026-09-28T14:34:00Z", state=PREV_STATE, engine={"schema": 1, "source_health": HEALTHY},
                       results={FIVE_MIN[0]: "error"}, retire_min=3)
    lp.run()
    assert engine_doc(lp)["source_health"] == HEALTHY                       # nothing new from this tick
    lp, _, _, _ = make(tmp_path / "2", "2026-09-28T14:34:00Z", state=PREV_STATE,
                       engine={"schema": 1, "source_health": HEALTHY}, results={FIVE_MIN[0]: "error"}, retire_min=3,
                       on_run=lambda a: write_json_atomic(Path(a.pending_dir) / SOURCE_HEALTH_FILE, side))
    lp.run()
    assert engine_doc(lp)["source_health"] == side                          # a crash is not a timeout: not counted


def fam(failures: int, is_open: bool = False) -> dict:
    return {"status": "ok", "consecutive_failures": failures,
            "breaker": {"open": is_open, "opened_at": None, "calls": 0, "good_probes": 0}}


def test_a_timeout_raises_the_worst_family_that_is_still_closed():
    now = "2026-09-28T14:40:20Z"
    h = {"name": "yahoo", "status": "degraded", "consecutive_failures": 2, "last_ok_at": None,
         "families": {"chart": fam(2), "crumb": fam(1)}}
    out = loop_mod.health_after_timeout(h, now)
    assert out["families"]["chart"] == {"status": "down", "consecutive_failures": 3,
                                        "breaker": {"open": True, "opened_at": now, "calls": 0, "good_probes": 0}}
    assert out["families"]["crumb"] == fam(1) and h["families"]["chart"] == fam(2)        # the input is not changed
    assert (out["name"], out["status"], out["consecutive_failures"]) == ("nasdaq", "down", 3)
    assert out["breaker"] == out["families"]["chart"]["breaker"]                          # as health_state() derives it
    out = loop_mod.health_after_timeout({"families": {"chart": fam(5, True), "crumb": fam(0)}}, now)
    assert out["families"]["chart"] == fam(5, True) and out["families"]["crumb"]["consecutive_failures"] == 1
    assert out["families"]["crumb"]["breaker"]["open"] is False and out["name"] == "nasdaq"
    out = loop_mod.health_after_timeout({"name": "yahoo", "consecutive_failures": 2, "breaker": {"open": False}}, now)
    assert out["breaker"]["open"] is True and out["name"] == "nasdaq"                      # the flat format
    out = loop_mod.health_after_timeout(None, now)
    assert out["consecutive_failures"] == 1 and out["breaker"] == {}


def test_the_loop_trips_the_breaker_at_the_fetchers_count():
    """The loop stays stdlib-only, so it keeps its own copy of the trip count; the record it writes must
    restore into the real fetcher as an open breaker."""
    from radar import fetch
    assert loop_mod.BREAKER_TRIP == fetch.BREAKER_TRIP
    h = fetch.Fetcher(transport=object()).health_state()
    for _ in range(fetch.BREAKER_TRIP):
        assert fetch.Fetcher(health=h, transport=object()).health_state()["name"] == "yahoo"
        h = loop_mod.health_after_timeout(h, "2026-09-28T14:40:20Z")
    restored = fetch.Fetcher(health=h, transport=object()).health_state()
    assert restored["name"] == "nasdaq" and restored["consecutive_failures"] == fetch.BREAKER_TRIP
    assert restored["families"]["chart"]["breaker"]["opened_at"] == "2026-09-28T14:40:20Z"


# ---------------------------------------------------------------- the tick subprocess

def py(code: str) -> list[str]:
    return [sys.executable, "-c", code]


def test_subprocess_timeout():
    res = loop_mod.run_tick_subprocess(py("import time; time.sleep(30)"), 0.5, dict(os.environ))
    assert res["status"] == "timeout" and res["duration_ms"] < 20_000


def test_subprocess_result_is_the_last_json_line():
    res = loop_mod.run_tick_subprocess(py("print('progress'); print('{\"status\": \"ok\", \"members\": 3}'); print('bye')"),
                                       30, dict(os.environ))
    assert res["status"] == "ok" and res["members"] == 3 and res["duration_ms"] >= 0


def test_subprocess_stop_request_terminates_the_tick():
    t0 = time.monotonic()
    res = loop_mod.run_tick_subprocess(py("import time; time.sleep(60)"), 30, dict(os.environ),
                                       stop=lambda: time.monotonic() - t0 > 0.3)
    assert res["status"] == "stopped" and res["duration_ms"] < 5_000


def test_a_stop_request_ends_a_running_tick_within_seconds(tmp_path, monkeypatch):
    """RT-2: on a cancel the runner signals the loop (exec in the workflow); the loop must not wait 270 s
    for its tick, and must leave no tick running behind it."""
    procs = []

    class Recording(subprocess.Popen):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw)
            procs.append(self)

    monkeypatch.setattr(loop_mod.subprocess, "Popen", Recording)
    (tmp_path / "data" / "radar").mkdir(parents=True)
    lp = loop_mod.Loop(tmp_path / "data", tmp_path / "pending", push=False, env=dict(os.environ),
                       tick_cmd=(sys.executable, "-c", "import time; time.sleep(60)"))
    timer = threading.Timer(0.5, lp.request_stop, args=(signal.SIGTERM, None))
    timer.start()
    t0 = time.monotonic()
    try:
        lp._run(loop_mod.Slot(int(at("2026-09-28T14:35:00Z")), int(at("2026-09-28T14:35:50Z"))), None)
    finally:
        timer.cancel()
    assert time.monotonic() - t0 < 5
    (proc,) = procs
    assert proc.poll() is not None and delta.list_pending(lp.pending) == []


def test_subprocess_crash_is_an_error():
    res = loop_mod.run_tick_subprocess(py("import sys; print('{\"status\": \"ok\"}'); sys.exit(3)"), 30, dict(os.environ))
    assert res["status"] == "error" and res["message"] == "the scan exited with code 3"
    res = loop_mod.run_tick_subprocess(py("pass"), 30, dict(os.environ))
    assert res["status"] == "error" and res["message"] == "the scan printed no result"


def test_tokens_are_scrubbed_from_the_tick_environment():
    env = {"GITHUB_TOKEN": "a", "GH_TOKEN": "b", "ACTIONS_RUNTIME_TOKEN": "c", "ACTIONS_ID_TOKEN_REQUEST_URL": "d",
           "GITHUB_RUN_ID": "7", "PATH": "p"}
    assert loop_mod.scrubbed_env(env) == {"GITHUB_RUN_ID": "7", "PATH": "p"}


# ---------------------------------------------------------------- housekeeping request

HK = {"schema": 1, "ops": {"hk_dispatched_at": None, "hk_request": {"reason": "events over 1.25x the size limit",
                                                                     "at": "2026-09-28T13:00:00Z"}}}


def test_housekeeping_is_dispatched_at_most_every_six_hours(tmp_path):
    calls = []
    lp, _, fake, _ = make(tmp_path, "2026-09-28T13:20:00Z", engine=HK, retire_min=1000,
                          env={"GITHUB_TOKEN": "tok", "GITHUB_REPOSITORY": "owner/repo"},
                          dispatch=lambda repo, token, reason: calls.append((repo, token, reason)) or "ok")
    lp.run()
    assert calls == [("owner/repo", "tok", "events over 1.25x the size limit")] * 2
    stamps = sorted({r.ops.get("hk_dispatched_at") for r in fake.runs})
    assert stamps == ["2026-09-28T13:20:00Z", "2026-09-28T19:20:50Z"]
    assert fake.runs[0].ops["hk_dispatch_result"] == "ok"
    assert "GITHUB_TOKEN" not in fake.runs[0].env


@pytest.mark.parametrize("kw", [{"env": {}}, {"env": {"GITHUB_TOKEN": "tok"}, "push": False}])
def test_no_dispatch_without_a_token_or_when_not_pushing(tmp_path, kw):
    lp, _, fake, _ = make(tmp_path, "2026-09-28T13:36:00Z", engine=HK, retire_min=5, **kw)
    lp.run()
    assert fake.runs and fake.runs[0].ops.get("hk_dispatched_at") is None


def test_dispatch_request(monkeypatch):
    seen = {}

    class Response(io.BytesIO):
        status = 204

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def urlopen(req, timeout):
        seen.update(url=req.full_url, method=req.get_method(), body=json.loads(req.data), timeout=timeout,
                    headers={k.lower(): v for k, v in req.header_items()})
        return Response()

    monkeypatch.setattr(loop_mod.urllib.request, "urlopen", urlopen)
    assert loop_mod.dispatch_housekeeping("owner/repo", "tok", "scan_log over") == "ok"
    assert seen["url"] == "https://api.github.com/repos/owner/repo/actions/workflows/radar-housekeeping.yml/dispatches"
    assert seen["method"] == "POST" and seen["headers"]["authorization"] == "Bearer tok"
    assert seen["body"] == {"ref": "main", "inputs": {"mode": "apply", "squash": "skip", "reason": "scanner: scan_log over"}}

    def denied(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(loop_mod.urllib.request, "urlopen", denied)
    assert loop_mod.dispatch_housekeeping("owner/repo", "tok", "x") == "http 403"


# ---------------------------------------------------------------- real subprocess ticks and a real remote

FAKE_TICK = """
import argparse, json, os
from pathlib import Path
from radar import delta
ap = argparse.ArgumentParser()
for opt in ("--data-dir", "--pending-dir", "--tick-id"):
    ap.add_argument(opt)
for flag in ("--warmup", "--final", "--ignore-calendar"):
    ap.add_argument(flag, action="store_true")
a = ap.parse_args()
engine = json.loads((Path(a.data_dir) / "radar/engine.json").read_bytes())
secrets = sorted(k for k in os.environ if k in ("GITHUB_TOKEN", "GH_TOKEN") or k.startswith("ACTIONS_"))
row = {"tick": a.tick_id, "final": a.final, "git_prev": engine["loop"]["git_prev"], "secrets": secrets}
delta.write_delta(a.pending_dir, a.tick_id, {"radar/scan_log.jsonl": [row]},
                  {"radar/state.json": {"tick_id": a.tick_id}, "radar/engine.json": engine},
                  summary={"status": "ok", "members": 0, "entered": [], "exited": []})
print("fetching...")
print(json.dumps({"status": "ok", "message": "", "members": 0, "entered": [], "exited": []}))
"""


def test_loop_with_subprocess_ticks_pushes_every_tick(remote, tmp_path, monkeypatch):
    monkeypatch.undo()                                                   # real git config for this one
    work, pending = clone(remote, tmp_path / "work", bot=False), tmp_path / "pending"
    clock = Clock("2026-09-28T19:40:00Z")
    env = {**os.environ, "PYTHONPATH": str(REPO_ROOT), "GITHUB_TOKEN": "secret", "ACTIONS_RUNTIME_TOKEN": "secret"}
    lp = loop_mod.Loop(work, pending, clock=clock, sleep=clock.sleep, env=env, tick_cmd=(sys.executable, "-c", FAKE_TICK),
                       dispatch=lambda *a: pytest.fail("no request pending"))
    assert lp.run() == 0
    logged = rows(remote)[1:]
    assert [r["tick"] for r in logged] == ["2026-09-28T19:40:00Z", "2026-09-28T19:45:00Z", "2026-09-28T19:50:00Z",
                                           "2026-09-28T19:55:00Z", "2026-09-28T20:00:00Z"]
    assert [r["final"] for r in logged] == [False] * 4 + [True]
    assert all(r["secrets"] == [] for r in logged)
    assert logged[0]["git_prev"]["status"] == "none" and logged[1]["git_prev"]["status"] == "ok"
    assert sh(remote, "rev-list", "--count", "data") == "6"
    assert sh(remote, "log", "-1", "--format=%s", "data") == "radar 20:00Z ok · 0 on radar (+0/-0)"
    assert sh(remote, "log", "-1", "--format=%an", "data") == gitsync.BOT_NAME
    assert delta.list_pending(pending) == []
    engine = json.loads(sh(remote, "show", "data:radar/engine.json"))
    assert engine["loop"]["last_tick"] == "2026-09-28T20:00:00Z" and engine["loop"]["ticks_today"] == 5
